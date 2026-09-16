import express from "express";
const router = express.Router();
import authMiddleware from "../middleware/auth.js";
import pool from "../db.js";
import { syncUserInstitutions } from "../services/simplefinSync.js";

// Manually trigger a SimpleFin sync for the user
router.post("/sync", authMiddleware, async (req, res) => {
  try {
    const summary = await syncUserInstitutions(req.user.id);
    res.json({ message: "Sync completed successfully.", summary });
  } catch (err) {
    console.error("Manual sync failed:", err.message);
    res.status(500).json({ error: `Sync failed: ${err.message}` });
  }
});

// Get all institutions with their nested accounts
router.get("/", authMiddleware, async (req, res) => {
  try {
    const institutions = await pool.query(
      "SELECT * FROM institutions WHERE user_id = $1 ORDER BY created_at ASC",
      [req.user.id]
    );

    const accounts = await pool.query(
      "SELECT * FROM accounts WHERE user_id = $1 ORDER BY id ASC",
      [req.user.id]
    );

    // Attach accounts to their respective institutions
    const institutionsWithAccounts = institutions.rows.map((inst) => {
      return {
        ...inst,
        accounts: accounts.rows.filter((acc) => acc.institution_id === inst.id),
      };
    });

    // We also need to return accounts that don't have an institution_id (e.g. the default Wallet)
    const standaloneAccounts = accounts.rows.filter((acc) => !acc.institution_id);

    res.json({
      institutions: institutionsWithAccounts,
      standaloneAccounts,
    });
  } catch (err) {
    console.error("Error fetching institutions:", err.message);
    res.status(500).json({ error: "Server error fetching institutions." });
  }
});

// Create a new institution
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, logo, setup_token } = req.body;
    if (!name || !logo) {
      return res.status(400).json({ error: "Institution name and logo are required." });
    }

    let simplefin_access_url = null;
    if (setup_token) {
      try {
        const claimUrl = Buffer.from(setup_token, 'base64').toString('utf8');
        const claimResponse = await fetch(claimUrl, { method: 'POST' });
        if (!claimResponse.ok) throw new Error("Failed to claim SimpleFin token.");
        simplefin_access_url = await claimResponse.text();
      } catch (err) {
        return res.status(400).json({ error: "Invalid SimpleFin setup token or failed to claim." });
      }
    }

    const newInstitution = await pool.query(
      `INSERT INTO institutions (user_id, name, logo, simplefin_access_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name, logo, simplefin_access_url]
    );

    res.status(201).json(newInstitution.rows[0]);
  } catch (err) {
    console.error("Error creating institution:", err.message);
    res.status(500).json({ error: "Server error creating institution." });
  }
});

// Delete an institution
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM institutions WHERE id = $1 AND user_id = $2", [id, req.user.id]);
    res.json({ message: "Institution deleted." });
  } catch (err) {
    console.error("Error deleting institution:", err.message);
    res.status(500).json({ error: "Server error deleting institution." });
  }
});

export default router;
