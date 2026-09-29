import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, default_currency: user.default_currency },
    process.env.JWT_SECRET || "default_local_dev_secret_key_12345",
    { expiresIn: "7d" },
  );
};

// 0. Demo Login/Seed Route
router.post("/demo", async (req, res) => {
  try {
    const demoEmail = "demo@trackrfi.com";
    let userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [demoEmail]);
    
    // If the demo user doesn't exist, create and seed it!
    if (userCheck.rows.length === 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('demo', salt);
        
        const userRes = await client.query(
          `INSERT INTO users (email, password_hash, user_name, monthly_target, default_currency) 
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [demoEmail, passwordHash, 'Demo User', 4000.00, 'CAD']
        );
        const user = userRes.rows[0];
        const userId = user.id;

        // Copy Template Categories
        const catRes = await client.query('SELECT * FROM template_categories');
        const templateCats = catRes.rows;
        
        const catMap = {};
        for (const tc of templateCats) {
          const type = (tc.name === 'Income' || tc.name === 'Transfer In') ? 'income' : 'expense';
          const insertCat = await client.query(
            `INSERT INTO categories (user_id, name, plaid_primary_code, icon, color, type) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [userId, tc.name, tc.plaid_primary_code, tc.icon, tc.color, type]
          );
          catMap[tc.id] = insertCat.rows[0].id;
        }

        const subcatRes = await client.query('SELECT * FROM template_subcategories');
        for (const ts of subcatRes.rows) {
          const newCatId = catMap[ts.template_category_id];
          if (newCatId) {
            await client.query(
              `INSERT INTO subcategories (category_id, name, plaid_detailed_code) VALUES ($1, $2, $3)`,
              [newCatId, ts.name, ts.plaid_detailed_code]
            );
          }
        }

        const foodCat = await client.query(`SELECT id FROM categories WHERE user_id = $1 AND name = 'Food and Drink'`, [userId]);
        const transCat = await client.query(`SELECT id FROM categories WHERE user_id = $1 AND name = 'Transportation'`, [userId]);
        const incCat = await client.query(`SELECT id FROM categories WHERE user_id = $1 AND name = 'Income'`, [userId]);
        const subCat = await client.query(`SELECT id FROM categories WHERE user_id = $1 AND name = 'General Services'`, [userId]);
        
        const foodId = foodCat.rows[0]?.id;
        const transId = transCat.rows[0]?.id;
        const incId = incCat.rows[0]?.id;
        const subId = subCat.rows[0]?.id;

        const instRes = await client.query(
          `INSERT INTO institutions (user_id, name, logo) VALUES ($1, $2, $3) RETURNING id`,
          [userId, 'Royal Bank of Canada', 'https://logo.clearbit.com/rbc.com']
        );
        const instId = instRes.rows[0].id;

        const checkingRes = await client.query(
          `INSERT INTO accounts (user_id, institution_id, name, type, currency, balance, sync_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [userId, instId, 'Everyday Checking', 'Checking', 'CAD', 3450.25, 'synced']
        );
        const checkingId = checkingRes.rows[0].id;

        const ccRes = await client.query(
          `INSERT INTO accounts (user_id, institution_id, name, type, currency, balance, sync_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [userId, instId, 'Cashback Visa', 'Credit', 'CAD', -1250.50, 'synced']
        );
        const ccId = ccRes.rows[0].id;

        const now = new Date();
        const transactions = [];
        
        let d1 = new Date(now); d1.setDate(d1.getDate() - 15);
        transactions.push({ acc: checkingId, name: 'TechCorp Inc Payroll', amt: 2500.00, date: d1, cat: incId });
        
        let d2 = new Date(now); d2.setDate(d2.getDate() - 1);
        transactions.push({ acc: checkingId, name: 'TechCorp Inc Payroll', amt: 2500.00, date: d2, cat: incId });

        for(let i=0; i<15; i++) {
          let d = new Date(now); d.setDate(d.getDate() - Math.floor(Math.random() * 30));
          let amt = - (15 + Math.random() * 80).toFixed(2);
          transactions.push({ acc: ccId, name: ['Uber Eats', 'Starbucks', 'Whole Foods', 'Loblaws', 'Tim Hortons'][Math.floor(Math.random()*5)], amt, date: d, cat: foodId });
        }

        for(let i=0; i<8; i++) {
          let d = new Date(now); d.setDate(d.getDate() - Math.floor(Math.random() * 30));
          let amt = - (3 + Math.random() * 40).toFixed(2);
          transactions.push({ acc: ccId, name: ['Uber', 'Esso Gas', 'Shell', 'Transit Fare'][Math.floor(Math.random()*4)], amt, date: d, cat: transId });
        }
        
        let d3 = new Date(now); d3.setDate(d3.getDate() - 5);
        transactions.push({ acc: ccId, name: 'Netflix', amt: -16.99, date: d3, cat: subId });

        for (const tx of transactions) {
          await client.query(
            `INSERT INTO transactions (user_id, account_id, name, amount, date, category_id, source) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, tx.acc, tx.name, tx.amt, tx.date, tx.cat, 'Bank Sync']
          );
        }

        await client.query('COMMIT');
        userCheck = { rows: [user] };
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to seed demo user:', e);
        return res.status(500).json({ error: "Failed to initialize demo environment." });
      } finally {
        client.release();
      }
    }

    const user = userCheck.rows[0];
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_name,
        monthlyBudget: user.monthly_target,
        currency: user.default_currency,
      },
    });
  } catch (err) {
    console.error("Demo login error:", err);
    res.status(500).json({ error: "Server error during demo login." });
  }
});

// 1. User Registration Route
router.post("/register", async (req, res) => {
  const { email, password, name, monthlyBudget, currency } = req.body;

  if (!email || !password || !name || !monthlyBudget) {
    return res.status(400).json({ error: "Please enter all required fields." });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters long." });
  }

  try {
    const emailSanitized = email.toLowerCase().trim();
    const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
      emailSanitized,
    ]);
    if (userCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "An account with this email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    function capitalizeFirstLetter(str) {
      if (!str) return str; // Handles empty strings safely
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    const result = await pool.query(
      "INSERT INTO users (email, password_hash, user_name, monthly_target, default_currency) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, created_at, default_currency",
      [
        email.toLowerCase().trim(),
        passwordHash,
        capitalizeFirstLetter(name),
        monthlyBudget,
        currency || "CAD",
      ],
    );

    const newUser = result.rows[0];
    const token = generateToken(newUser);
    await pool.query(
      `
      WITH inserted_categories AS (
          -- 1. Copy all Primary Categories for this user
          INSERT INTO categories (user_id, name, plaid_primary_code, icon, color, type)
          SELECT 
            $1, name, plaid_primary_code, icon, color,
            -- Automatically determine type (income or expense) based on Plaid code:
            CASE WHEN plaid_primary_code IN ('INCOME', 'TRANSFER_IN') THEN 'income'::category_type ELSE 'expense'::category_type END
          FROM template_categories
          RETURNING id, plaid_primary_code
      )
      -- 2. Use those new Category IDs to copy all Subcategories
      INSERT INTO subcategories (category_id, name, plaid_detailed_code)
      SELECT 
          ic.id,
          ts.name,
          ts.plaid_detailed_code
      FROM template_subcategories ts
      JOIN template_categories tc ON ts.template_category_id = tc.id
      JOIN inserted_categories ic ON ic.plaid_primary_code = tc.plaid_primary_code;
    `,
      [newUser.id],
    );
    await pool.query(
      "insert into accounts (type, name, currency, logo, user_id, balance) values($1, $2, $3, $4, $5, $6)",
      ["Cash", "Wallet", currency || "CAD", "💵", newUser.id, 0],
    );

    return res.status(201).json({
      message: "Account registered successfully.",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("Error during registration:", err);
    return res
      .status(500)
      .json({ error: "Internal server error during registration." });
  }
});

// 2. User Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Please enter both email and password." });
  }

  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const token = generateToken(user);

    return res.json({
      message: "Logged in successfully.",
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res
      .status(500)
      .json({ error: "Internal server error during login." });
  }
});

// 3. Get Current Logged-in User Profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, email, created_at FROM users WHERE id = $1",
      [req.user.id],
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }
    return res.json({ user: userResult.rows[0] });
  } catch (err) {
    console.error("Error fetching profile:", err);
    return res
      .status(500)
      .json({ error: "Server error fetching user profile." });
  }
});

export default router;
