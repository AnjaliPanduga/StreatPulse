import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn('[DB] DATABASE_URL not set — connection will fail if queried');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 20, // max number of clients in the pool
      idleTimeoutMillis: 30000,
    });

    pool.on('error', (err: any) => {
      console.error('[DB] Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  return pool;
}
