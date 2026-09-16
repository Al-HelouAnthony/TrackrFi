import express from "express";
import pool from "../db.js";
const router = express.Router();
import authMiddleware from "../middleware/auth.js";

router.get("/budgets", authMiddleware, async (req, res) => {
  try {
    const budget = await pool.query(
      "SELECT bud.*, cat.name category_name FROM budgets bud left join categories cat on cat.id=bud.category_id WHERE bud.user_id = $1",
      [req.user.id],
    );
    res.json(budget.rows);
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/budgets", authMiddleware, async (req, res) => {
  try {
    const { amount, category, period } = req.body;
    if (amount === 0) {
      return res.status(400).json({ error: "Goal can't be 0." });
    }
    const categoryData = await pool.query(
      "select id from categories where user_id=$1 and name=$2",
      [req.user.id, category],
    );
    const category_id = categoryData.rows[0].id;
    const result = await pool.query(
      "insert into budgets(amount,category_id,period,user_id) values ($1,$2,$3,$4) on conflict (user_id, category_id) DO UPDATE SET amount = EXCLUDED.amount, period = EXCLUDED.period",
      [amount, category_id, period, req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/budgets/summary", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userDefaultCurrency = req.user.default_currency || "CAD";
    const period = req.query.period === 'yearly' ? 'yearly' : 'monthly';
    const truncPeriod = period === 'yearly' ? 'year' : 'month';

    // 1. Check if we actually need to fetch exchange rates to save performance
    const accountsRes = await pool.query("SELECT DISTINCT currency FROM accounts WHERE user_id = $1", [userId]);
    const needsConversion = accountsRes.rows.some(row => row.currency && row.currency !== userDefaultCurrency);
    
    let rates = {};
    if (needsConversion) {
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${userDefaultCurrency}`);
        const data = await response.json();
        rates = data.rates || {};
      } catch (err) {
        console.error("Exchange Rate API Failed:", err);
      }
    }

    // 2. This query dynamically joins accounts and uses the injected JSON rates to perfectly convert all currencies!
    const query = `
      WITH UserTarget AS (
        SELECT monthly_target FROM users WHERE id = $1
      ),
      CategorySpending AS (
        SELECT 
          cat.id AS category_id,
          cat.name AS category_name,
          cat.icon AS category_icon,
          cat.color AS category_color,
          COALESCE(b.period, 'none') AS budget_period,
          COALESCE(
            CASE 
              WHEN $4 = 'monthly' AND b.period = 'monthly' THEN b.amount
              WHEN $4 = 'yearly'  AND b.period = 'yearly' THEN b.amount
              WHEN $4 = 'yearly'  AND b.period = 'monthly' THEN b.amount * 12
              ELSE 0 
            END, 
          0) AS budgeted_amount,
          COALESCE(SUM(-t.amount / COALESCE(($2::jsonb->>(a.currency::text))::numeric, 1)) FILTER (WHERE t.date >= date_trunc($3, CURRENT_DATE)), 0) AS total_spent
        FROM categories cat
        LEFT JOIN budgets b ON b.category_id = cat.id
        LEFT JOIN transactions t ON t.category_id = cat.id AND t.exclude_from_monthly = false AND (t.is_ignored IS NULL OR t.is_ignored = false)
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE cat.user_id = $1 AND cat.type = 'expense'
        GROUP BY cat.id, b.period, b.amount
      ),
      SubcategorySpending AS (
        SELECT 
          sub.category_id,
          sub.id AS subcategory_id,
          sub.name AS subcategory_name,
          COALESCE(SUM(-t.amount / COALESCE(($2::jsonb->>(a.currency::text))::numeric, 1)) FILTER (WHERE t.date >= date_trunc($3, CURRENT_DATE)), 0) AS spent
        FROM subcategories sub
        LEFT JOIN transactions t ON t.subcategory_id = sub.id AND t.exclude_from_monthly = false AND (t.is_ignored IS NULL OR t.is_ignored = false)
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE sub.category_id IN (SELECT category_id FROM CategorySpending)
        GROUP BY sub.category_id, sub.id, sub.name
        HAVING COALESCE(SUM(-t.amount / COALESCE(($2::jsonb->>(a.currency::text))::numeric, 1)) FILTER (WHERE t.date >= date_trunc($3, CURRENT_DATE)), 0) <> 0
      )
      SELECT 
        (SELECT monthly_target FROM UserTarget) AS monthly_target,
        json_agg(
          json_build_object(
            'category_id', cs.category_id,
            'category_name', cs.category_name,
            'category_icon', cs.category_icon,
            'category_color', cs.category_color,
            'budget_period', cs.budget_period,
            'budgeted_amount', cs.budgeted_amount,
            'total_spent', cs.total_spent,
            'subcategories', (
              SELECT json_agg(
                json_build_object(
                  'id', ss.subcategory_id,
                  'name', ss.subcategory_name,
                  'spent', ss.spent
                )
              )
              FROM SubcategorySpending ss
              WHERE ss.category_id = cs.category_id
            )
          )
        ) AS categories
      FROM CategorySpending cs;
    `;

    const result = await pool.query(query, [userId, JSON.stringify(rates), truncPeriod, period]);

    res.json({
      default_currency: userDefaultCurrency,
      monthly_target: result.rows.length > 0 ? parseFloat(result.rows[0].monthly_target) * (period === 'yearly' ? 12 : 1) : 0,
      categories: result.rows.length > 0 && result.rows[0].categories ? result.rows[0].categories.map(row => ({
        ...row,
        budget_period: row.budget_period,
        budgeted_amount: parseFloat(row.budgeted_amount),
        total_spent: parseFloat(row.total_spent),
      })) : []
    });
    
  } catch (error) {
    console.error("Error fetching budget summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
