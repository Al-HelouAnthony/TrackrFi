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
