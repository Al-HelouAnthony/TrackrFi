import pool from '../db.js';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function syncAllUsers() {
  console.log("Starting SimpleFin sync job...");
  const client = await pool.connect();
  
  try {
    // We group by simplefin_access_url to ensure we only sync each SimpleFin connection once,
    // even if it spans multiple banks/institutions in our database.
    const uniqueConnections = await client.query(`
      SELECT DISTINCT ON (simplefin_access_url) id, user_id, simplefin_access_url 
      FROM institutions 
      WHERE simplefin_access_url IS NOT NULL
    `);
    
    for (const institution of uniqueConnections.rows) {
      await syncInstitution(client, institution);
    }
    console.log("SimpleFin sync job completed successfully.");
  } catch (error) {
    console.error("SimpleFin sync error:", error);
  } finally {
    client.release();
  }
}

async function syncInstitution(client, institution) {
  try {
    const accessUrl = institution.simplefin_access_url;
    // According to SimpleFin docs, the accounts and transactions are at /accounts
    const response = await fetch(`${accessUrl}/accounts`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    
    for (const sfAccount of data.accounts) {
      let target_institution_id = institution.id;
      
      // Intelligently group accounts into their correct banks (e.g. CIBC vs RBC)
      if (sfAccount.org && sfAccount.org.name) {
        const existingInst = await client.query(
          'SELECT id FROM institutions WHERE user_id = $1 AND (name ILIKE $2 OR $2 ILIKE \'%\' || name || \'%\') LIMIT 1', 
          [institution.user_id, sfAccount.org.name]
        );
        
        if (existingInst.rows.length > 0) {
          target_institution_id = existingInst.rows[0].id;
        } else {
          const newInst = await client.query(
            'INSERT INTO institutions (user_id, name, logo, simplefin_access_url) VALUES ($1, $2, $3, $4) RETURNING id',
            [institution.user_id, sfAccount.org.name, 'https://logo.clearbit.com/' + (sfAccount.org.domain || 'bank.com'), institution.simplefin_access_url]
          );
          target_institution_id = newInst.rows[0].id;
        }
      }

      let accountId = null;
      const existingAccount = await client.query('SELECT id FROM accounts WHERE simplefin_account_id = $1', [sfAccount.id]);
      
      if (existingAccount.rows.length > 0) {
        accountId = existingAccount.rows[0].id;
        // Update balance and ensure it's attached to the correct institution
        await client.query('UPDATE accounts SET balance = $1, institution_id = $2 WHERE id = $3', [sfAccount.balance, target_institution_id, accountId]);
      } else {
        // Auto-create missing account
        const newAccount = await client.query(
          'INSERT INTO accounts (user_id, institution_id, name, type, balance, simplefin_account_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [institution.user_id, target_institution_id, sfAccount.name, 'Bank', sfAccount.balance, sfAccount.id]
        );
        accountId = newAccount.rows[0].id;
      }
      
      if (sfAccount.transactions && sfAccount.transactions.length > 0) {
        const transactions = sfAccount.transactions.reverse();
        
        // Fetch categories for AI
        const catResult = await client.query("SELECT plaid_primary_code, name FROM template_categories");
        const subcatResult = await client.query("SELECT plaid_detailed_code, name FROM template_subcategories");
        
        const categoriesText = catResult.rows.map((c) => `${c.name} (${c.plaid_primary_code})`).join(", ");
        const subcategoriesText = subcatResult.rows.map((s) => `${s.name} (${s.plaid_detailed_code})`).join(", ");

        for (const tx of transactions) {
          const existingTx = await client.query('SELECT id FROM transactions WHERE simplefin_transaction_id = $1', [tx.id]);
          if (existingTx.rows.length > 0) continue;
          
          const sfDate = new Date(tx.posted * 1000);
          const sfAmount = parseFloat(tx.amount); // negative means money left
          
          // Deduplication: Smart Merge
          const potentialDuplicates = await client.query(`
            SELECT id FROM transactions 
            WHERE account_id = $1 
              AND simplefin_transaction_id IS NULL 
              AND amount = $2
              AND date >= $3::timestamp - INTERVAL '3 days'
              AND date <= $3::timestamp + INTERVAL '3 days'
            LIMIT 1
          `, [accountId, sfAmount, sfDate.toISOString()]);
          
          if (potentialDuplicates.rows.length > 0) {
            await client.query('UPDATE transactions SET simplefin_transaction_id = $1 WHERE id = $2', [tx.id, potentialDuplicates.rows[0].id]);
            continue;
          }
          
          // Categorization
          let category_id = null;
          let subcategory_id = null;
          let cleanMerchantName = tx.description;
          let is_ignored = false;
          
          try {
            const prompt = `Categorize this bank transaction.
Merchant raw: "${tx.description}"
Amount: ${sfAmount} (negative means purchase/withdrawal)

Primary category codes: [${categoriesText}]
Subcategory codes: [${subcategoriesText}]

IMPORTANT:
1. merchant_name MUST be clean, simple, and ALL CAPS (strip store numbers).
2. If this is a payment to a credit card or an internal transfer, set is_ignored to true.
`;
            const schemaProperties = {
              merchant_name: { type: Type.STRING },
              plaid_primary_code: { type: Type.STRING },
              plaid_detailed_code: { type: Type.STRING },
              is_ignored: { type: Type.BOOLEAN },
            };
            
            const aiResponse = await ai.models.generateContent({
              model: 'gemini-3.6-flash-lite',
              contents: prompt,
              config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.OBJECT, properties: schemaProperties },
              },
            });
            const parsed = JSON.parse(aiResponse.text);
            cleanMerchantName = parsed.merchant_name || cleanMerchantName;
            is_ignored = parsed.is_ignored || false;
            
            if (parsed.plaid_primary_code) {
              const userCatResult = await client.query(
                "SELECT id FROM categories WHERE plaid_primary_code = $1 AND user_id = $2",
                [parsed.plaid_primary_code, institution.user_id]
              );
              category_id = userCatResult.rows[0]?.id || null;
            }
            if (category_id && parsed.plaid_detailed_code) {
              const userSubcatResult = await client.query(
                "SELECT id FROM subcategories WHERE plaid_detailed_code = $1 AND category_id = $2",
                [parsed.plaid_detailed_code, category_id]
              );
              subcategory_id = userSubcatResult.rows[0]?.id || null;
            }
          } catch(err) {
             console.error("AI categorization failed for", tx.description, err);
          }
          
          await client.query(
            `INSERT INTO transactions (user_id, account_id, name, amount, date, category_id, subcategory_id, source, simplefin_transaction_id, is_ignored) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [institution.user_id, accountId, cleanMerchantName, sfAmount, sfDate, category_id, subcategory_id, 'Bank Sync', tx.id, is_ignored]
          );
        }
      }
    }
  } catch (err) {
    console.error(`Failed to sync institution ${institution.id}:`, err.message);
  }
}
