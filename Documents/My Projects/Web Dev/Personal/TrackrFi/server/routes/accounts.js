import express from "express";
const router = express.Router();
import authMiddleware from "../middleware/auth.js";
import pool from "../db.js";

router.get("/", authMiddleware, async (req, res) => {
  try {
    const accounts = await pool.query(
      "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id ASC",
      [req.user.id],
    );
    res.json(accounts.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});
router.post("/manual", authMiddleware, async (req, res) => {
  try {
    const { name, type, currency, balance, institution_id } = req.body;
    
    const syncStatus = "not synced";
    // Default logo for standalone accounts (Wallet), otherwise let the UI handle it or use the bank's logo.
    const logo = institution_id ? "🏦" : "https://cdn-icons-png.flaticon.com/512/858/858069.png"; 

    const newAccount = await pool.query(
      `INSERT INTO accounts 
        (user_id, name, type, currency, balance, sync_status, logo, institution_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [req.user.id, name, type, currency, balance, syncStatus, logo, institution_id || null]
    );

    res.json(newAccount.rows[0]);
  } catch (err) {
    console.error("Error creating manual wallet:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Update an account
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, balance } = req.body;
    
    // Build query dynamically based on provided fields
    let updateFields = [];
    let values = [];
    let queryIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${queryIndex++}`);
      values.push(name);
    }
    if (type !== undefined) {
      updateFields.push(`type = $${queryIndex++}`);
      values.push(type);
    }
    if (balance !== undefined) {
      updateFields.push(`balance = $${queryIndex++}`);
      values.push(balance);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    values.push(id);
    values.push(req.user.id);

    const query = `UPDATE accounts SET ${updateFields.join(", ")} WHERE id = $${queryIndex} AND user_id = $${queryIndex + 1} RETURNING *`;
    
    const updatedAccount = await pool.query(query, values);
    
    if (updatedAccount.rows.length === 0) {
      return res.status(404).json({ error: "Account not found." });
    }

    res.json(updatedAccount.rows[0]);
  } catch (err) {
    console.error("Error updating account:", err);
    res.status(500).json({ error: "Server error updating account." });
  }
});

// Delete an account
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    // Deleting an account should logically delete its transactions (via ON DELETE CASCADE in db setup, or we can just delete it)
    await pool.query("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    res.json({ message: "Account deleted." });
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Server error deleting account." });
  }
});

export default router;
