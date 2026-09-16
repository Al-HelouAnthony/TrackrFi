import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";
import accountRoutes from "./routes/accounts.js";
import homeRoutes from "./routes/home.js";
import budgetRoutes from "./routes/budgets.js";
import categoryRoutes from "./routes/categories.js";
import subCategoryRoutes from "./routes/subCategories.js";
import institutionRoutes from "./routes/institutions.js";
import webhookRoutes from "./routes/webhooks.js";
import { syncAllUsers } from "./services/simplefinSync.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Auth endpoints are active!
app.use("/api/auth", authRoutes);
app.use("/api", homeRoutes);
app.use("/api", budgetRoutes); // Home data endpoint
app.use("/api", categoryRoutes); // Category data endpoint

// Mounting transactions and accounts router skeletons
app.use("/api/transactions", transactionRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/subcategories", subCategoryRoutes);
app.use("/api/institutions", institutionRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Ledger Budget App Backend API" });
});

import pool from './db.js';

app.listen(PORT, async () => {
  console.log(`Ledger backend running on port: ${PORT}`);
  try {
    console.log("Running auto-migrations for SimpleFin...");
    await pool.query('ALTER TABLE institutions ADD COLUMN IF NOT EXISTS simplefin_access_url TEXT;');
    await pool.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS simplefin_account_id TEXT UNIQUE;');
    await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS simplefin_transaction_id TEXT UNIQUE;');
    console.log("Auto-migrations completed successfully.");
    
    // Start the SimpleFin sync immediately on boot, then every 5 hours
    syncAllUsers();
    setInterval(syncAllUsers, 5 * 60 * 60 * 1000); // 5 hours

  } catch (err) {
    console.error("Auto-migration failed:", err.message);
  }
});
