import express from "express";
import authMiddleware from "../middleware/auth.js";
const router = express.Router();
import pool from "../db.js";

router.get("/categories", authMiddleware, async (req, res) => {
  try {
    const categories = await pool.query(
      "SELECT * FROM categories WHERE user_id = $1",
      [req.user.id],
    );

    res.json(categories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
