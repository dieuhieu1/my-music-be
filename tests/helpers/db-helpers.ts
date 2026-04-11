/**
 * Test database helpers.
 * Connects directly to PostgreSQL to set up / tear down state that can't be driven
 * through the API (e.g. directly grant PREMIUM, advance expiry dates, etc.).
 */
import { Pool } from 'pg';

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      user: process.env.DB_USER ?? 'mymusic',
      password: process.env.DB_PASSWORD ?? 'mymusic_password',
      database: process.env.DB_NAME ?? 'mymusic_db',
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
}

/** Directly grant PREMIUM role to a user (bypasses payment flow for test setup) */
export async function grantPremiumDirect(userId: string, months = 1): Promise<void> {
  const db = getPool();
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);
  await db.query(
    `UPDATE users SET premium_status = true, premium_expiry_date = $1 WHERE id = $2`,
    [expiry.toISOString(), userId],
  );
  await db.query(
    `INSERT INTO user_roles (user_id, role) VALUES ($1, 'PREMIUM') ON CONFLICT DO NOTHING`,
    [userId],
  );
}

/** Expire a user's premium (sets expiry to the past for cron simulation) */
export async function expirePremiumDirect(userId: string): Promise<void> {
  const db = getPool();
  await db.query(
    `UPDATE users SET premium_expiry_date = now() - interval '1 day' WHERE id = $1`,
    [userId],
  );
}

/** Directly set song status (bypasses state-machine guards for test setup) */
export async function setSongStatusDirect(songId: string, status: string): Promise<void> {
  const db = getPool();
  await db.query(`UPDATE songs SET status = $1 WHERE id = $2`, [status, songId]);
}

/** Hard-delete all test data by email domain (clean-up after full test run) */
export async function cleanTestUsers(): Promise<void> {
  const db = getPool();
  await db.query(`DELETE FROM users WHERE email LIKE '%@test.local'`);
}
