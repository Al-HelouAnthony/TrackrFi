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

export async function syncUserInstitutions(userId) {
  console.log(`Starting SimpleFin manual sync for user ${userId}...`);
  const client = await pool.connect();
  let syncSummary = [];
  
  try {
    const uniqueConnections = await client.query(`
      SELECT DISTINCT ON (simplefin_access_url) id, user_id, simplefin_access_url 
      FROM institutions 
      WHERE simplefin_access_url IS NOT NULL AND user_id = $1
    `, [userId]);
    
    for (const institution of uniqueConnections.rows) {
      const summary = await syncInstitution(client, institution);
      syncSummary = syncSummary.concat(summary);
    }
    console.log(`SimpleFin manual sync for user ${userId} completed.`);
    return syncSummary;
  } catch (error) {
    console.error(`SimpleFin manual sync error for user ${userId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function syncInstitution(client, institution) {
  try {
    const accessUrlObj = new URL(institution.simplefin_access_url);
    const authHeader = 'Basic ' + Buffer.from(`${accessUrlObj.username}:${accessUrlObj.password}`).toString('base64');
    
    // Remove credentials from the URL so fetch doesn't throw an error
    accessUrlObj.username = '';
    accessUrlObj.password = '';
    const cleanUrl = accessUrlObj.toString();
    
    const response = await fetch(`${cleanUrl}/accounts`, {
      headers: {
        'Authorization': authHeader
      }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    let summary = [];
    
    for (const sfAccount of data.accounts) {
      let target_institution_id = institution.id;
      let orgName = sfAccount.org ? sfAccount.org.name : 'Unknown';
      summary.push(`Found account: ${sfAccount.name} (${orgName})`);
      
      // Intelligently group accounts into their correct banks (e.g. CIBC vs RBC)
      if (sfAccount.org && sfAccount.org.name) {
        const existingInst = await client.query(
          'SELECT id, name FROM institutions WHERE user_id = $1 AND (name ILIKE $2 OR $2 ILIKE \'%\' || name || \'%\' OR logo ILIKE $3) LIMIT 1', 
          [institution.user_id, sfAccount.org.name, `%${sfAccount.org.domain || 'none'}%`]
        );
        
        if (existingInst.rows.length > 0) {
          target_institution_id = existingInst.rows[0].id;
          
          // Auto-heal ugly institution names
          if (existingInst.rows[0].name === sfAccount.org.name) {
            let cleanOrgName = sfAccount.org.name;
            try {
              const aiResponse = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: `Give me just the standard short abbreviation for this bank (e.g. CIBC, RBC, TD, BMO, Scotia). If none, just return a clean short name. No extra text.\nBank: "${sfAccount.org.name}"`
              });
              cleanOrgName = aiResponse.text.trim();
              if (cleanOrgName !== sfAccount.org.name) {
                await client.query('UPDATE institutions SET name = $1 WHERE id = $2', [cleanOrgName, target_institution_id]);
              }
            } catch(e) { console.error("AI org auto-heal failed", e); }
          }
        } else {
          let cleanOrgName = sfAccount.org.name;
          try {
            const aiResponse = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `Give me just the standard short abbreviation for this bank (e.g. CIBC, RBC, TD, BMO, Scotia). If none, just return a clean short name. No extra text.\nBank: "${sfAccount.org.name}"`
            });
            cleanOrgName = aiResponse.text.trim();
          } catch(e) { console.error("AI org rename failed", e); }

          const newInst = await client.query(
            'INSERT INTO institutions (user_id, name, logo, simplefin_access_url) VALUES ($1, $2, $3, $4) RETURNING id',
            [institution.user_id, cleanOrgName, 'https://logo.clearbit.com/' + (sfAccount.org.domain || 'bank.com'), institution.simplefin_access_url]
          );
          target_institution_id = newInst.rows[0].id;
        }
      }

      let accountId = null;
      const existingAccount = await client.query('SELECT id, name FROM accounts WHERE simplefin_account_id = $1', [sfAccount.id]);
      
      if (existingAccount.rows.length > 0) {
        accountId = existingAccount.rows[0].id;
        
        let cleanAccountName = existingAccount.rows[0].name;
        // Auto-heal ugly account names (or retry if they still have numbers/asterisks from a previous rate-limit failure)
        if (cleanAccountName === sfAccount.name || /[\d*]/.test(cleanAccountName)) {
          try {
            const aiResponse = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `Format this bank account name to be clean and simple. Remove any account numbers, asterisks, or random IDs. Just return the clean name. No extra text. Example input: "Everyday Checking *1234" -> Example output: "Everyday Checking".\nAccount: "${sfAccount.name}"`
            });
            cleanAccountName = aiResponse.text.trim();
          } catch(e) { console.error("AI account auto-heal failed", e); }
        }

        // Update balance and ensure it's attached to the correct institution and name
        await client.query('UPDATE accounts SET balance = $1, institution_id = $2, name = $3 WHERE id = $4', [sfAccount.balance, target_institution_id, cleanAccountName, accountId]);
      } else {
        // Detect account type based on name
        let accType = 'Checking';
        const lowerName = sfAccount.name.toLowerCase();
        if (lowerName.includes('savings')) accType = 'Savings';
        else if (lowerName.includes('credit') || lowerName.includes('visa') || lowerName.includes('mastercard')) accType = 'Credit';
        else if (lowerName.includes('loan') || lowerName.includes('mortgage')) accType = 'Loan';

        let cleanAccountName = sfAccount.name;
        try {
          const aiResponse = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Format this bank account name to be clean and simple. Remove any account numbers, asterisks, or random IDs. Just return the clean name. No extra text. Example input: "Everyday Checking *1234" -> Example output: "Everyday Checking".\nAccount: "${sfAccount.name}"`
          });
          cleanAccountName = aiResponse.text.trim();
        } catch(e) { console.error("AI account rename failed", e); }

        // Auto-create missing account
        const newAccount = await client.query(
          'INSERT INTO accounts (user_id, institution_id, name, type, balance, simplefin_account_id, currency, logo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [institution.user_id, target_institution_id, cleanAccountName, accType, sfAccount.balance, sfAccount.id, sfAccount.currency || 'CAD', 'https://logo.clearbit.com/' + (sfAccount.org?.domain || 'bank.com')]
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

        // Filter out transactions that already exist or are duplicates, but flag uncategorized ones for re-processing
        let pendingTransactions = [];
        for (const tx of transactions) {
          const existingTx = await client.query('SELECT id, category_id FROM transactions WHERE simplefin_transaction_id = $1', [tx.id]);
          
          const sfDate = new Date(tx.posted * 1000);
          const sfAmount = parseFloat(tx.amount); // negative means money left

          if (existingTx.rows.length > 0) {
            // If it exists but has no category, let's let the AI try to categorize it again
            if (existingTx.rows[0].category_id === null) {
              pendingTransactions.push({ ...tx, dbId: existingTx.rows[0].id, parsedDate: sfDate, parsedAmount: sfAmount, isUpdate: true });
            }
            continue;
          }
          
          // Deduplication: Smart Merge
          const potentialDuplicates = await client.query(`
            SELECT id, category_id FROM transactions 
            WHERE account_id = $1 
              AND simplefin_transaction_id IS NULL 
              AND amount = $2
              AND date >= $3::timestamp - INTERVAL '3 days'
              AND date <= $3::timestamp + INTERVAL '3 days'
            LIMIT 1
          `, [accountId, sfAmount, sfDate.toISOString()]);
          
          if (potentialDuplicates.rows.length > 0) {
            await client.query('UPDATE transactions SET simplefin_transaction_id = $1 WHERE id = $2', [tx.id, potentialDuplicates.rows[0].id]);
            // If the manual/email transaction doesn't have a category, re-categorize it!
            if (potentialDuplicates.rows[0].category_id === null) {
               pendingTransactions.push({ ...tx, dbId: potentialDuplicates.rows[0].id, parsedDate: sfDate, parsedAmount: sfAmount, isUpdate: true });
            }
            continue;
          }
          pendingTransactions.push({ ...tx, dbId: null, parsedDate: sfDate, parsedAmount: sfAmount, isUpdate: false });
        }

        if (pendingTransactions.length > 0) {
          // Batch AI categorization (max 100 per chunk to avoid massive context limits)
          const chunkSize = 100;
          for (let i = 0; i < pendingTransactions.length; i += chunkSize) {
            const chunk = pendingTransactions.slice(i, i + chunkSize);
            let aiCategorizations = {};

            try {
              const prompt = `Categorize these bank transactions.
Primary category codes: [${categoriesText}]
Subcategory codes: [${subcategoriesText}]

IMPORTANT:
1. merchant_name MUST be clean, simple, and ALL CAPS (strip store numbers).
2. If payment to a credit card or internal transfer, set is_ignored to true.

Transactions:
${chunk.map((tx, idx) => `[ID: ${idx}] Merchant raw: "${tx.description}", Amount: ${tx.parsedAmount}`).join("\n")}
`;
              const schemaProperties = {
                results: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      merchant_name: { type: Type.STRING },
                      plaid_primary_code: { type: Type.STRING },
                      plaid_detailed_code: { type: Type.STRING },
                      is_ignored: { type: Type.BOOLEAN },
                    }
                  }
                }
              };
              
              const aiResponse = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: prompt,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: { type: Type.OBJECT, properties: schemaProperties },
                },
              });
              
              const parsed = JSON.parse(aiResponse.text);
              if (parsed.results) {
                parsed.results.forEach(res => {
                  aiCategorizations[res.id] = res;
                });
              }
            } catch (err) {
              console.error("AI batch categorization failed", err);
            }

            // Insert or Update into DB
            for (let j = 0; j < chunk.length; j++) {
              const tx = chunk[j];
              const aiData = aiCategorizations[j] || {};
              
              let category_id = null;
              let subcategory_id = null;
              let cleanMerchantName = aiData.merchant_name || tx.description;
              let is_ignored = aiData.is_ignored || false;

              if (aiData.plaid_primary_code) {
                const userCatResult = await client.query(
                  "SELECT id FROM categories WHERE plaid_primary_code = $1 AND user_id = $2",
                  [aiData.plaid_primary_code, institution.user_id]
                );
                category_id = userCatResult.rows[0]?.id || null;
              }
              if (category_id && aiData.plaid_detailed_code) {
                const userSubcatResult = await client.query(
                  "SELECT id FROM subcategories WHERE plaid_detailed_code = $1 AND category_id = $2",
                  [aiData.plaid_detailed_code, category_id]
                );
                subcategory_id = userSubcatResult.rows[0]?.id || null;
              }

              if (tx.isUpdate) {
                await client.query(
                  `UPDATE transactions SET name = $1, category_id = $2, subcategory_id = $3, is_ignored = $4 WHERE id = $5`,
                  [cleanMerchantName, category_id, subcategory_id, is_ignored, tx.dbId]
                );
              } else {
                await client.query(
                  `INSERT INTO transactions (user_id, account_id, name, amount, date, category_id, subcategory_id, source, simplefin_transaction_id, is_ignored) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                  [institution.user_id, accountId, cleanMerchantName, tx.parsedAmount, tx.parsedDate, category_id, subcategory_id, 'Bank Sync', tx.id, is_ignored]
                );
              }
            }
          }
        }
      }
    }
    return summary;
  } catch (err) {
    console.error(`Failed to sync institution ${institution.id}:`, err.message);
    throw err;
  }
}
