import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => console.error('[DB] Unexpected error:', err));
  return pool;
}

export const pool = global._pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global._pgPool = pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function initDb(): Promise<void> {
  try {
    // 1. Users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('root','admin','user')),
        areas TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Uploaded files
    await query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_name VARCHAR(500) NOT NULL,
        file_size BIGINT DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing','completed','error')),
        area VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Sales Transactions (Data Realisasi/Invoice)
    await query(`
      CREATE TABLE IF NOT EXISTS sales_transactions (
        id BIGSERIAL PRIMARY KEY,
        file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
        week INTEGER,
        tanggal DATE,
        produk_id VARCHAR(100),
        qty_po NUMERIC(15,2) DEFAULT 0,
        nomor_penjualan VARCHAR(200),
        type_customer VARCHAR(100),
        pelanggan VARCHAR(500),
        nomor_so VARCHAR(200),
        kategori VARCHAR(200),
        deskripsi_produk TEXT,
        brand VARCHAR(200),
        qty_terkirim NUMERIC(15,2) DEFAULT 0,
        satuan VARCHAR(50),
        harga NUMERIC(18,2) DEFAULT 0,
        bruto NUMERIC(18,2) DEFAULT 0,
        diskon NUMERIC(18,2) DEFAULT 0,
        pajak NUMERIC(18,2) DEFAULT 0,
        sub_total NUMERIC(18,2) DEFAULT 0,
        salesman VARCHAR(200),
        kota VARCHAR(200),
        kecamatan VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4. === TABEL BARU: SO OUTSTANDING ===
    // Digunakan untuk menyimpan data pesanan yang belum terkirim sepenuhnya
    await query(`
      CREATE TABLE IF NOT EXISTS so_outstanding (
        id BIGSERIAL PRIMARY KEY,
        file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
        week INTEGER,
        tanggal DATE,
        ref_po VARCHAR(200),
        nomor_so VARCHAR(200),
        tanggal_so DATE,
        pelanggan VARCHAR(500),
        type_customer VARCHAR(100),
        produk_id VARCHAR(100),
        deskripsi_produk TEXT,
        kategori VARCHAR(200),
        qty_order NUMERIC(15,2) DEFAULT 0,
        qty_outstanding NUMERIC(15,2) DEFAULT 0,
        nilai_outstanding NUMERIC(18,2) DEFAULT 0,
        keterangan TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Tabel kertas stok
await query(`
  CREATE TABLE IF NOT EXISTS kertas_stok (
    id          BIGSERIAL PRIMARY KEY,
    produk      TEXT NOT NULL,
    jenis_kertas VARCHAR(200),
    gramasi     NUMERIC(8, 2) DEFAULT 0,
    merk        VARCHAR(200),
    ukuran_kertas VARCHAR(100),
    lebar       NUMERIC(8, 2) DEFAULT 0,
    panjang     NUMERIC(8, 2) DEFAULT 0,
    unit        VARCHAR(20) DEFAULT 'lbr',
    saldo_awal  NUMERIC(15, 2) DEFAULT 0,
    masuk       NUMERIC(15, 2) DEFAULT 0,
    keluar      NUMERIC(15, 2) DEFAULT 0,
    saldo_akhir NUMERIC(15, 2) DEFAULT 0,
    periode     VARCHAR(7),
    keterangan  TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`);

    // Tabel header WIP / batch upload WIP
await query(`
  CREATE TABLE IF NOT EXISTS wip_uploads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_mesin  VARCHAR(200) NOT NULL,         
    minggu_awal DATE,                          
    minggu_akhir DATE,                         
    file_name   VARCHAR(500),
    uploaded_by INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`)

    // Tabel JOP
await query (`
  CREATE TABLE IF NOT EXISTS wip_jobs (
    id          BIGSERIAL PRIMARY KEY,
    upload_id   UUID REFERENCES wip_uploads(id) ON DELETE CASCADE,
    no_urut     INTEGER,
    nomor_jop   VARCHAR(200),
    nama_produk TEXT,
    ukuran_kertas VARCHAR(300),
    up          INTEGER DEFAULT 1,
    qty_jop     NUMERIC(15,2) DEFAULT 0,
    qty_cetak   NUMERIC(15,2) DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )
`)

    // Tabel detail shift
await query (`
  CREATE TABLE IF NOT EXISTS wip_shifts (
    id        BIGSERIAL PRIMARY KEY,
    job_id    BIGINT REFERENCES wip_jobs(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES wip_uploads(id) ON DELETE CASCADE,
    tanggal   DATE NOT NULL,
    shift     SMALLINT NOT NULL CHECK (shift IN (1, 2)),  -- 1 = Shift I, 2 = Shift II
    qty       NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)

    await query(`CREATE INDEX IF NOT EXISTS idx_wip_shifts_job    ON wip_shifts(job_id);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_wip_shifts_upload ON wip_shifts(upload_id);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_wip_shifts_tanggal ON wip_shifts(tanggal);`)


    await query(`CREATE INDEX IF NOT EXISTS idx_wip_jobs_upload  ON wip_jobs(upload_id);`)
    await query(`CREATE INDEX IF NOT EXISTS idx_wip_jobs_nomor   ON wip_jobs(nomor_jop)`)

    await query(`CREATE INDEX IF NOT EXISTS idx_ks_jenis   ON kertas_stok(jenis_kertas)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ks_merk    ON kertas_stok(merk)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ks_periode ON kertas_stok(periode)`);


    // Indexing untuk Sales
    await query(`CREATE INDEX IF NOT EXISTS idx_st_tanggal ON sales_transactions(tanggal)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_st_pelanggan ON sales_transactions(pelanggan)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_st_nomor_so ON sales_transactions(nomor_so)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_st_file_id ON sales_transactions(file_id)`);

    // Indexing untuk Outstanding
    await query(`CREATE INDEX IF NOT EXISTS idx_so_nomor_so ON so_outstanding(nomor_so)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_so_pelanggan ON so_outstanding(pelanggan)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_so_file_id ON so_outstanding(file_id)`);

    // Seed default admin
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, 'root')
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role`,
      ['admin', hash]
    );

    console.log('[DB] Init complete - Tabel Sales dan Outstanding SO siap.');
  } catch (e) {
    console.error('[DB] Init error:', e);
  }
}