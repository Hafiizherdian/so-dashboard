/**
 * Reset password admin ke 'admin123'
 * Jalankan: node scripts/reset-admin.cjs
 *
 * Atau set password custom:
 *   ADMIN_PASS=passwordbaru node scripts/reset-admin.cjs
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌  DATABASE_URL tidak ditemukan di .env.local');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false } });
  const newPass = process.env.ADMIN_PASS || 'admin123';
  const hash = await bcrypt.hash(newPass, 10);

  try {
    // Pastikan tabel users ada
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('root','admin','user')),
        areas TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Upsert admin
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ('admin', $1, 'root')
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = 'root'
       RETURNING id, username, role`,
      [hash]
    );

    const u = r.rows[0];
    console.log(`✅  User "${u.username}" (role: ${u.role}) berhasil direset`);
    console.log(`   Username : admin`);
    console.log(`   Password : ${newPass}`);
  } catch (e) {
    console.error('❌  Error:', e.message);
  } finally {
    await pool.end();
  }
}

main();
