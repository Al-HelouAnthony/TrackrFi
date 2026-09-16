import express from "express";
import pool from "../db.js";
const router = express.Router();
import authMiddleware from "../middleware/auth.js";

router.get("/info", authMiddleware, async (req, res) => {
  const data = await pool.query("SELECT * FROM users WHERE id = $1", [
    req.user.id,
  ]);
  const user = data.rows[0];
  const items = await pool.query("SELECT COUNT(*) FROM accounts WHERE user_id = $1", [req.user.id]);
  user.has_linked_bank = parseInt(items.rows[0].count, 10) > 0;
  res.json(user);
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { email, user_name, monthly_target, phone_number } = req.body;
    const data = await pool.query(
      "UPDATE users SET email = $1, user_name = $2, monthly_target = $3, phone_number = $4 WHERE id = $5 RETURNING *",
      [email, user_name, monthly_target, phone_number, req.user.id],
    );
    res.json(data.rows[0]);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
