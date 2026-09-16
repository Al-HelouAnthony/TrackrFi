import express from "express";
import pool from "../db.js";
const router = express.Router();
import authMiddleware from "../middleware/auth.js";

router.get("/", authMiddleware, async (req, res) => {
  try {
    const categoryName = req.query.categoryName;
    const userId = req.user.id;
    if (!categoryName) {
      return res.json([]);
    }
    const categoryData = await pool.query(
      "SELECT * FROM categories cat where cat.name = $1 AND cat.user_id = $2",
      [categoryName, userId],
    );
    const categoryId = categoryData.rows[0].id;
    const data = await pool.query(
      "SELECT * FROM subcategories sub WHERE sub.category_id = $1  ",
      [categoryId],
    );
    res.json(data.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
