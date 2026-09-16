import * as dotenv from 'dotenv';
dotenv.config();
import pool from './db.js';

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log("Adding simplefin_access_url to institutions...");
    await client.query('ALTER TABLE institutions ADD COLUMN IF NOT EXISTS simplefin_access_url TEXT;');

    console.log("Adding simplefin_account_id to accounts...");
    await client.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS simplefin_account_id TEXT UNIQUE;');

    console.log("Adding simplefin_transaction_id to transactions...");
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS simplefin_transaction_id TEXT UNIQUE;');

    await client.query('COMMIT');
    console.log("Migration successful!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
