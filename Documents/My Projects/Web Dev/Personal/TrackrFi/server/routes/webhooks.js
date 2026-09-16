import express from "express";
import pool from "../db.js";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const router = express.Router();

router.get("/models", async (req, res) => {
  try {
    const response = await ai.models.list();
    const models = [];
    for await (const model of response) {
      models.push(model);
    }
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook Authentication Middleware
const verifyWebhookSecret = (req, res, next) => {
  const secret = req.headers["x-webhook-secret"];
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error("WEBHOOK_SECRET is not set in environment variables.");
    return res.status(500).json({ error: "Webhook configuration error." });
  }

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized webhook access." });
  }

  next();
};

// 1. Ingest Transaction Webhook
// Expected Payload:
// {
//   "account_id": "uuid-of-account",
//   "amount": 45.00,
//   "date": "2026-08-08", // optional, defaults to now
//   "name": "Starbucks",
//   "category_id": "uuid-of-category", // optional
//   "subcategory_id": "uuid-of-subcategory", // optional
//   "merchant_name": "Starbucks Coffee" // optional
// }
router.post("/transactions", verifyWebhookSecret, async (req, res) => {
  const {
    account_id,
    amount,
    date,
    name,
    category_id,
    subcategory_id,
    merchant_name,
  } = req.body;

  if (!account_id || amount === undefined || !name) {
    return res
      .status(400)
      .json({ error: "account_id, amount, and name are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verify account belongs to a user and get user_id
    const accountCheck = await client.query(
      "SELECT user_id, balance FROM accounts WHERE id = $1",
      [account_id],
    );
    if (accountCheck.rows.length === 0) {
      throw new Error(`Account ${account_id} not found.`);
    }

    const { user_id, balance: currentBalance } = accountCheck.rows[0];
    const transactionDate = date ? new Date(date) : new Date();

    // Insert Transaction
    const transactionResult = await client.query(
      `INSERT INTO transactions 
        (user_id, account_id, name, amount, date, category_id, subcategory_id, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user_id,
        account_id,
        merchant_name || name,
        amount,
        transactionDate,
        category_id || null,
        subcategory_id || null,
        "Manual", // Webhook counts as a manual/automation source rather than bank sync
      ],
    );

    // Update Account Balance
    // NOTE: For credit cards, 'amount' is usually positive for purchases.
    // For checking accounts, 'amount' is usually negative for purchases.
    // This logic assumes `amount` represents the net change to the balance (e.g. +50 for a deposit, -50 for a purchase).
    const newBalance = parseFloat(currentBalance) + parseFloat(amount);
    await client.query("UPDATE accounts SET balance = $1 WHERE id = $2", [
      newBalance,
      account_id,
    ]);

    await client.query("COMMIT");

    res.status(201).json({
      message: "Transaction logged and balance updated.",
      transaction: transactionResult.rows[0],
      new_balance: newBalance,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Webhook Transaction Error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to process webhook transaction." });
  } finally {
    client.release();
  }
});

// 2. Intelligent Email Parser Webhook
// Expected Payload:
// {
//   "account_id": "uuid-of-account",
//   "email_body": "Full text of the bank alert email..."
// }
router.post("/parse-email", verifyWebhookSecret, async (req, res) => {
  const { account_id, institution_id, email_body, email_subject, email_date } =
    req.body;

  if (!email_body || (!account_id && !institution_id)) {
    return res.status(400).json({
      error: "email_body and either account_id or institution_id are required.",
    });
  }

  const client = await pool.connect();

  try {
    let finalAccountId = account_id;
    let userId = null;
    let accountOptionsText = "";
    let validAccountIds = [];

    if (institution_id) {
      const accountsRes = await client.query(
        "SELECT id, name, type, user_id FROM accounts WHERE institution_id = $1",
        [institution_id],
      );
      if (accountsRes.rows.length === 0) {
        throw new Error(`No accounts found for institution ${institution_id}.`);
      }
      userId = accountsRes.rows[0].user_id;
      validAccountIds = accountsRes.rows.map((a) => a.id);
    } else {
      const accountCheck = await client.query(
        "SELECT user_id FROM accounts WHERE id = $1",
        [account_id],
      );
      if (accountCheck.rows.length === 0) {
        throw new Error(`Account ${account_id} not found.`);
      }
      userId = accountCheck.rows[0].user_id;
      validAccountIds = [account_id];
    }

    const allUserAccountsRes = await client.query(
      "SELECT id, name, type FROM accounts WHERE user_id = $1",
      [userId],
    );
    const accountList = allUserAccountsRes.rows
      .map((a) => `- Name: "${a.name}", Type: "${a.type}", ID: "${a.id}"`)
      .join("\n");
    accountOptionsText = `\n\nHere are all of the user's accounts in the app:\n${accountList}\n\nCRITICAL ROUTING TASK: You must determine WHICH account this transaction belongs to based on context. You MUST return the exact ID of the matching account in the "account_id" field. If you cannot confidently match one, return the ID of the first account in the list as a fallback.`;

    // 2. Fetch allowed categories for the AI to choose from
    const catResult = await client.query(
      "SELECT plaid_primary_code, name FROM template_categories",
    );
    const subcatResult = await client.query(
      "SELECT plaid_detailed_code, name FROM template_subcategories",
    );

    const categoriesText = catResult.rows
      .map((c) => `${c.name} (${c.plaid_primary_code})`)
      .join(", ");
    const subcategoriesText = subcatResult.rows
      .map((s) => `${s.name} (${s.plaid_detailed_code})`)
      .join(", ");

    // 3. Ask Gemini to parse the email
    const subjectInfo = email_subject
      ? `\nEmail Subject: ${email_subject}`
      : "";
    const dateInfo = email_date ? `\nEmail Date: ${email_date}` : "";

    const prompt = `Parse this bank transaction email. 
Extract the amount, merchant_name, date. 
Categorize this transaction strictly using one of these primary category codes: [${categoriesText}]
And one of these subcategory codes: [${subcategoriesText}]${accountOptionsText}
${subjectInfo}${dateInfo}
Email Body:
${email_body}

IMPORTANT INSTRUCTIONS:
1. The merchant_name MUST be clean, simple, easy to read (strip out random store numbers or locations), and formatted in ALL CAPS.
2. If this email is NOT a transaction alert (e.g. marketing or spam), set is_transaction to false.
3. TRANSFERS: If this transaction is a payment to the user's own credit card or an internal transfer between their accounts, you must identify the destination account from the account list and provide its ID in "target_account_id". You must also set "is_ignored" to true so it doesn't affect their budget. 
4. E-TRANSFERS TO FRIENDS: If the email indicates a transfer OUT to another person (e.g. an e-transfer to a friend or merchant), do NOT provide a "target_account_id" and set "is_ignored" to false because it should impact their budget.
`;

    // Define the schema based on whether we need the account_id from AI
    const schemaProperties = {
      is_transaction: {
        type: Type.BOOLEAN,
        description:
          "True if this is a genuine transaction alert. False if marketing, spam, or non-financial alert.",
      },
      merchant_name: { type: Type.STRING },
      amount: {
        type: Type.NUMBER,
        description: "Negative for purchases, positive for deposits.",
      },
      date: { type: Type.STRING, description: "YYYY-MM-DD format" },
      plaid_primary_code: { type: Type.STRING },
      plaid_detailed_code: { type: Type.STRING },
      account_id: {
        type: Type.STRING,
        description:
          "The UUID of the source account where the money left or entered.",
      },
      target_account_id: {
        type: Type.STRING,
        description:
          "The UUID of the destination account, ONLY if this is an internal transfer or credit card payment.",
      },
      is_ignored: {
        type: Type.BOOLEAN,
        description:
          "True ONLY for internal transfers (like paying off a credit card). False for normal purchases or e-transfers to friends.",
      },
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
        },
      },
    });

    const parsed = JSON.parse(response.text);

    if (parsed.is_transaction === false) {
      return res.status(200).json({
        message:
          "Email ignored: AI determined this is not a transaction alert.",
        ai_parsed_data: parsed,
      });
    }

    if (parsed.account_id) {
      finalAccountId = parsed.account_id;
    }

    // 4. Map the extracted codes to the user's actual database category IDs
    let category_id = null;
    let subcategory_id = null;
    let cleanMerchantName = (
      parsed.merchant_name || "UNKNOWN TRANSACTION"
    ).toUpperCase();

    if (parsed.plaid_primary_code) {
      const userCatResult = await client.query(
        "SELECT id FROM categories WHERE plaid_primary_code = $1 AND user_id = $2",
        [parsed.plaid_primary_code, userId],
      );
      category_id = userCatResult.rows[0]?.id || null;
    }

    if (category_id && parsed.plaid_detailed_code) {
      const userSubcatResult = await client.query(
        "SELECT id FROM subcategories WHERE plaid_detailed_code = $1 AND category_id = $2",
        [parsed.plaid_detailed_code, category_id],
      );
      subcategory_id = userSubcatResult.rows[0]?.id || null;
    }

    // 5. Insert Transaction & Update Balance
    await client.query("BEGIN");

    let transactionDate = new Date();
    if (email_date) {
      const eDate = new Date(email_date);
      if (!isNaN(eDate.getTime())) transactionDate = eDate;
    }
    if (parsed.date) {
      const pDate = new Date(parsed.date);
      if (!isNaN(pDate.getTime())) {
        transactionDate = pDate;
      }
    }

    const transactionResult = await client.query(
      `INSERT INTO transactions 
        (user_id, account_id, name, amount, date, category_id, subcategory_id, source, is_ignored)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        finalAccountId,
        cleanMerchantName,
        parsed.amount || 0,
        transactionDate,
        category_id,
        subcategory_id,
        "Bank Sync",
        parsed.is_ignored || false,
      ],
    );

    const updateRes = await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE id = $2 RETURNING balance",
      [parsed.amount || 0, finalAccountId],
    );
    const newBalance = updateRes.rows[0].balance;

    if (parsed.target_account_id && parsed.target_account_id !== "null") {
      const inverseAmount = (parsed.amount || 0) * -1;
      await client.query(
        "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
        [inverseAmount, parsed.target_account_id],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Email parsed, transaction logged and balance updated.",
      transaction: transactionResult.rows[0],
      new_balance: newBalance,
      ai_parsed_data: parsed,
      routed_to_account: finalAccountId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Webhook Email Parser Error:", err);
    res
      .status(500)
      .json({ error: err.message || "Failed to process webhook email." });
  } finally {
    client.release();
  }
});

export default router;
