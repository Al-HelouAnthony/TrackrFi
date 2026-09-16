import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'ledger_budget'}`;

const pool = new Pool({
  connectionString,
  ssl: (isProduction || process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('PostgreSQL database pool connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
