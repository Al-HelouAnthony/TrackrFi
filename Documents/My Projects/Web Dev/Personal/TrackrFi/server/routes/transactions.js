import express from "express";
import authMiddleware from "../middleware/auth.js";
const router = express.Router();
import pool from "../db.js";

// GET /api/transactions - Fetch paginated transactions with optional category filter
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 9;
    const filter = req.query.filter === "all" ? "" : req.query.filter || "";
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const offset = (page - 1) * limit;

    const period = req.query.period || "1 month"; // Default to monthly if not provided
    function getDateRange(period) {
      const today = new Date();
      let fromDate = new Date();
      let toDate = new Date();

      if (period === "1 month") {
        fromDate.setMonth(today.getMonth() - 1);
        toDate = today;
      } else if (period === "3 month") {
        fromDate.setMonth(today.getMonth() - 3);
        toDate = today;
      } else if (period === "6 month") {
        fromDate.setMonth(today.getMonth() - 6);
        toDate = today;
      } else if (period === "1 year") {
        fromDate.setFullYear(today.getFullYear() - 1);
        toDate = today;
      } else if (period === "monthly") {
        fromDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
          0,
          0,
          0,
          0,
        );
        toDate = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          1,
          0,
          0,
          0,
          0,
        );
      } else if (period === "yearly") {
        fromDate = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
        toDate = new Date(today.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
      }
      if (period === "last month") {
        fromDate = new Date(
          today.getFullYear(),
          today.getMonth() - 1,
          1,
          0,
          0,
          0,
          0,
        );
        toDate = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
      }
      return { fDate: fromDate.toISOString(), tDate: toDate.toISOString() };
    }

    const spendPeriod = req.query.spendPeriod || req.query.period || "monthly";
    const truncUnit = spendPeriod === "yearly" ? "year" : "month";

    let queryText = `
      SELECT tr.*,sub.name as tag_name, cat.name AS category_name, cat.icon, cat.color, cat.plaid_primary_code, acc.name as account_name, acc.currency
      FROM transactions tr 
      LEFT JOIN categories cat ON cat.id = tr.category_id 
      left join accounts acc on acc.id = tr.account_id
      left join subcategories sub on sub.id = tr.subcategory_id
      WHERE tr.user_id = $1
        AND tr.date >= $2
        AND tr.date < $3
    `;
    let queryParams = [
      userId,
      getDateRange(period).fDate,
      getDateRange(period).tDate,
    ];

    if (filter !== "") {
      queryParams.push(filter);
      queryText += ` AND cat.name = $${queryParams.length}`;
    }

    queryText += ` ORDER BY tr.date DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const transactions = await pool.query(queryText, queryParams);

    let queryTextCount = `
      SELECT COUNT(*) 
      FROM transactions tr 
      LEFT JOIN categories cat ON cat.id = tr.category_id 
      WHERE tr.user_id = $1
        AND tr.date >= $2
        AND tr.date < $3
    `;
    let queryParamsCount = [
      userId,
      getDateRange(period).fDate,
      getDateRange(period).tDate,
    ];

    if (filter !== "") {
      queryParamsCount.push(filter);
      queryTextCount += ` AND cat.name = $${queryParamsCount.length}`;
    }

    const totalCountResult = await pool.query(queryTextCount, queryParamsCount);
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({ transactions: transactions.rows, pages: totalPages });
  } catch (err) {
    console.error("Transactions GET error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    let { name, amount, category, account, tag, is_ignored, date } = req.body;
    name = name.toUpperCase();
    const source = "Manual";
    const categoryData = await pool.query(
      "SELECT type, id from categories where name=$1 and user_id=$2",
      [category, req.user.id],
    );
    const category_id = categoryData.rows[0].id;
    const accountData = await pool.query(
      "SELECT id from accounts where name=$1 and user_id=$2",
      [account, req.user.id],
    );
    let subcategory_id = null;
    if (tag && tag !== "null") {
      const subCategoryData = await pool.query(
        "select id from subcategories where name=$1 and category_id=$2",
        [tag, category_id],
      );
      if (subCategoryData.rows.length > 0) {
        subcategory_id = subCategoryData.rows[0].id;
      }
    }

    if (categoryData.rows[0].type === "expense") {
      amount = -amount;
    }
    const account_id = accountData.rows[0].id;
    const budgetData = await pool.query(
      "select period from budgets where user_id=$1 and category_id=$2",
      [req.user.id, category_id],
    );
    let exclude_monthly = true;
    if (
      budgetData.rows.length === 0 ||
      budgetData.rows[0].period === "monthly"
    ) {
      exclude_monthly = false;
    }
    const result = await pool.query(
      "insert into transactions (user_id, category_id,name,amount,exclude_from_monthly,account_id,source, subcategory_id, is_ignored, date) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        req.user.id,
        category_id,
        name,
        amount,
        exclude_monthly,
        account_id,
        source,
        subcategory_id,
        is_ignored || false,
        date ? new Date(date) : new Date(),
      ],
    );
    if (account === "Wallet") {
      if (categoryData.rows[0].type === "expense") {
        await pool.query(
          "update accounts set balance= balance-$1 where name= 'Wallet' and user_id=$2",
          [-amount, req.user.id],
        );
      } else if (categoryData.rows[0].type === "income")
        await pool.query(
          "update accounts set balance= balance+$1 where name= 'Wallet' and user_id=$2",
          [amount, req.user.id],
        );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/", authMiddleware, async (req, res) => {
  try {
    let { id, name, amount, category, account, tag, is_ignored, date } = req.body;
    name = name.toUpperCase();
    const source = "Manual";
    const categoryData = await pool.query(
      "SELECT type, id from categories where name=$1 and user_id=$2",
      [category, req.user.id],
    );
    const category_id = categoryData.rows[0].id;
    const accountData = await pool.query(
      "SELECT id from accounts where name=$1 and user_id=$2",
      [account, req.user.id],
    );
    let subcategory_id = null;
    if (tag && tag !== "null") {
      const subCategoryData = await pool.query(
        "select id from subcategories where name=$1 and category_id=$2",
        [tag, category_id],
      );
      if (subCategoryData.rows.length > 0) {
        subcategory_id = subCategoryData.rows[0].id;
      }
    }
    if (categoryData.rows[0].type === "expense") {
      amount = -amount;
    }
    const account_id = accountData.rows[0].id;
    const budgetData = await pool.query(
      "select period from budgets where user_id=$1 and category_id=$2",
      [req.user.id, category_id],
    );
    let exclude_monthly = true;
    if (
      budgetData.rows.length === 0 ||
      budgetData.rows[0].period === "monthly"
    ) {
      exclude_monthly = false;
    }
    // --- LEDGER MATH FIX ---
    // 1. Fetch the OLD transaction FIRST, before we update it, to see what the amount and account used to be!
    const oldTxData = await pool.query(
      "SELECT t.amount, a.name AS account_name FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.id = $1 AND t.user_id = $2",
      [id, req.user.id],
    );

    await pool.query(
      "update transactions set name=$1, category_id=$2,amount=$3, exclude_from_monthly=$4,account_id=$5, subcategory_id=$8, is_ignored=$9, date=$10 where id=$6 and user_id=$7",
      [
        name,
        category_id,
        amount,
        exclude_monthly,
        account_id,
        id,
        req.user.id,
        subcategory_id,
        is_ignored || false,
        date ? new Date(date) : new Date(),
      ],
    );

    if (oldTxData.rows.length > 0) {
      const oldTx = oldTxData.rows[0];

      // 2. Revert the old amount from the OLD account (only if it was the Wallet)
      if (oldTx.account_name === "Wallet") {
        await pool.query(
          "UPDATE accounts SET balance = balance - $1 WHERE name = 'Wallet' AND user_id = $2",
          [oldTx.amount, req.user.id],
        );
      }

      // 3. Apply the new amount to the NEW account (only if it is the Wallet)
      if (account === "Wallet") {
        await pool.query(
          "UPDATE accounts SET balance = balance + $1 WHERE name = 'Wallet' AND user_id = $2",
          [amount, req.user.id],
        );
      }
    }
    // -----------------------

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.get("/spending", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userDefaultCurrency = req.user.default_currency || "CAD";

    const query = `
      SELECT 
        acc.currency,
        COALESCE(SUM(-tr.amount) FILTER (
          WHERE (cat.type = 'expense' OR (tr.category_id IS NULL AND tr.amount < 0))
            AND tr.exclude_from_monthly = false 
            AND (tr.is_ignored IS NULL OR tr.is_ignored = false)
            AND tr.date::DATE >= date_trunc('month', CURRENT_DATE)::DATE
        ), 0) AS current_month_spent,
        
        COALESCE(SUM(-tr.amount) FILTER (
          WHERE (cat.type = 'expense' OR (tr.category_id IS NULL AND tr.amount < 0))
            AND tr.exclude_from_monthly = false 
            AND (tr.is_ignored IS NULL OR tr.is_ignored = false)
            AND tr.date::DATE >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::DATE
            AND tr.date::DATE < date_trunc('month', CURRENT_DATE)::DATE
        ), 0) AS last_month_spent_to_date,
        COALESCE(SUM(-tr.amount) FILTER (
          WHERE (cat.type = 'expense' OR (tr.category_id IS NULL AND tr.amount < 0))
            AND (tr.is_ignored IS NULL OR tr.is_ignored = false)
            AND tr.date::DATE >= date_trunc('year', CURRENT_DATE)::DATE
        ), 0) AS current_year_spent,
        COALESCE(SUM(-tr.amount) FILTER (
          WHERE (cat.type = 'expense' OR (tr.category_id IS NULL AND tr.amount < 0))
            AND (tr.is_ignored IS NULL OR tr.is_ignored = false)
            AND tr.date::DATE >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year')::DATE
            AND tr.date::DATE < date_trunc('year', CURRENT_DATE)::DATE
        ), 0) AS last_year_spent_to_date
        
      FROM transactions tr
      LEFT JOIN categories cat ON tr.category_id = cat.id
      LEFT JOIN accounts acc ON tr.account_id = acc.id
      WHERE tr.user_id = $1
      GROUP BY acc.currency
    `;

    const result = await pool.query(query, [userId]);

    const needsConversion = result.rows.some(
      (row) => row.currency && row.currency !== userDefaultCurrency,
    );
    let rates = {};
    // 3. Only call the API if there is a foreign currency to prevent slowing down the app!
    if (needsConversion) {
      try {
        const response = await fetch(
          `https://open.er-api.com/v6/latest/${userDefaultCurrency}`,
        );
        const data = await response.json();
        rates = data.rates;
        // Example output: { "USD": 1, "CAD": 1.36, "EUR": 0.92 }
      } catch (apiError) {
        console.error("Exchange Rate API Failed:", apiError);
        // If the API goes down, 'rates' remains empty and defaults to 1:1 conversion
      }
    }
    const finalStats = {
      current_month_spent: 0,
      last_month_spent_to_date: 0,
      current_year_spent: 0,
      last_year_spent_to_date: 0,
    };
    // 4. Loop through each currency row and convert
    for (const row of result.rows) {
      const currency = row.currency || userDefaultCurrency;

      let exchangeRate = 1;
      // If it's a foreign currency and the API successfully gave us the rates
      if (currency !== userDefaultCurrency && rates?.[currency]) {
        // We DIVIDE to convert foreign back to base!
        // Example: 100 CAD / 1.36 = 73.52 USD
        exchangeRate = 1 / rates[currency];
      }
      finalStats.current_month_spent +=
        parseFloat(row.current_month_spent) * exchangeRate;
      finalStats.last_month_spent_to_date +=
        parseFloat(row.last_month_spent_to_date) * exchangeRate;
      finalStats.current_year_spent +=
        parseFloat(row.current_year_spent) * exchangeRate;
      finalStats.last_year_spent_to_date +=
        parseFloat(row.last_year_spent_to_date) * exchangeRate;
    }
    res.json(finalStats);
  } catch (err) {
    console.error("Spending GET error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/transactions/csv-import - Intelligently parse and import a CSV statement
router.post("/csv-import", authMiddleware, async (req, res) => {
  const { account_id, csv_text } = req.body;
  if (!account_id || !csv_text) {
    return res.status(400).json({ error: "account_id and csv_text are required." });
  }
  
  const userId = req.user.id;
  const client = await pool.connect();
  
  try {
    const accountCheck = await client.query("SELECT id FROM accounts WHERE id = $1 AND user_id = $2", [account_id, userId]);
    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ error: "Account not found." });
    }

    const catResult = await client.query("SELECT plaid_primary_code, name FROM template_categories");
    const subcatResult = await client.query("SELECT plaid_detailed_code, name FROM template_subcategories");

    const categoriesText = catResult.rows.map(c => `${c.name} (${c.plaid_primary_code})`).join(", ");
    const subcategoriesText = subcatResult.rows.map(s => `${s.name} (${s.plaid_detailed_code})`).join(", ");

    let parsedTransactions;
    // Trim and remove any potential UTF-8 BOM character that Notepad might have added
    let textTrimmed = csv_text.replace(/^\uFEFF/, '').trim();

    if (textTrimmed.startsWith("[") && textTrimmed.endsWith("]")) {
      try {
        parsedTransactions = JSON.parse(textTrimmed);
      } catch (err) {
        return res.status(400).json({ error: "Invalid JSON format provided." });
      }
    } else {
      return res.status(400).json({ error: "Please use ChatGPT or Gemini Web to convert your CSV to a .json file first, as detailed in the instructions." });
    }

    await client.query("BEGIN");
    let totalAmount = 0;

    for (const t of parsedTransactions) {
      let category_id = null;
      let subcategory_id = null;
      if (t.plaid_primary_code) {
        const userCatRes = await client.query("SELECT id FROM categories WHERE plaid_primary_code = $1 AND user_id = $2", [t.plaid_primary_code, userId]);
        category_id = userCatRes.rows[0]?.id || null;
      }
      if (category_id && t.plaid_detailed_code) {
        const userSubcatRes = await client.query("SELECT id FROM subcategories WHERE plaid_detailed_code = $1 AND category_id = $2", [t.plaid_detailed_code, category_id]);
        subcategory_id = userSubcatRes.rows[0]?.id || null;
      }

      let transactionDate = new Date();
      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) transactionDate = d;
      }

      const amt = parseFloat(t.amount || 0);
      totalAmount += amt;

      const merchantNameUpper = (t.merchant_name || "").toUpperCase();
      let is_ignored = false;
      
      // Smart Auto-Detection for internal transfers & credit card payments
      if (
        merchantNameUpper.includes("INTERNET TRANSFER") ||
        merchantNameUpper.includes("CREDIT CARD") ||
        merchantNameUpper.includes("PAYMENT") ||
        merchantNameUpper.includes("MASTERCARD") ||
        merchantNameUpper.includes("VISA") ||
        merchantNameUpper.includes("AMEX") ||
        t.plaid_primary_code === "LOAN_PAYMENTS"
      ) {
        is_ignored = true;
      }
      
      // Explicitly allow E-Transfers to friends to count towards the budget
      if (merchantNameUpper.includes("E-TRANSFER")) {
        is_ignored = false;
      }

      await client.query(
        `INSERT INTO transactions 
          (user_id, account_id, name, amount, date, category_id, subcategory_id, source, is_ignored)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, account_id, t.merchant_name || "Unknown Merchant", amt, transactionDate, category_id, subcategory_id, "CSV Import", is_ignored]
      );
    }

    await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [totalAmount, account_id]);
    await client.query("COMMIT");

    res.status(201).json({ message: "CSV Imported Successfully", count: parsedTransactions.length });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CSV Import Error:", err);
    res.status(500).json({ error: `Failed to process CSV import. Error: ${err.message}` });
  } finally {
    client.release();
  }
});
// DELETE /api/transactions/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First fetch the transaction to get its amount and account_id
    const txRes = await pool.query("SELECT amount, account_id FROM transactions WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    if (txRes.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    
    const { amount, account_id } = txRes.rows[0];
    
    // Delete the transaction
    await pool.query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    
    // Revert the balance change on the account
    // Since expense is saved as negative, subtracting a negative adds it back.
    if (account_id) {
      await pool.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, account_id]);
    }
    
    res.json({ message: "Transaction deleted successfully." });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    res.status(500).json({ error: "Server error deleting transaction." });
  }
});

export default router;
