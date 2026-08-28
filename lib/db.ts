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

// Tabel produk (master data brand + spek kertas etiket/dus)
await query(`
  CREATE TABLE IF NOT EXISTS products (
    id             BIGSERIAL PRIMARY KEY,
    nama_brand     VARCHAR(200) NOT NULL,
    kode_brand     VARCHAR(100) NOT NULL,
    kategori       VARCHAR(50),
    kode_pabrik    VARCHAR(50) NOT NULL,
    pabrik         VARCHAR(200),
    batang_per_bks INTEGER,
    bks_per_slop   INTEGER,
    slop_per_bal   INTEGER,
    bal_per_dos    INTEGER,
    keterangan     TEXT,
    jenis          VARCHAR(20) NOT NULL CHECK (jenis IN ('ETIKET','DOS')),
    up             INTEGER,
    kertas         VARCHAR(100),
    gsm            INTEGER,
    l              NUMERIC(10,4),
    p              NUMERIC(10,4),
    kg_per_rim     NUMERIC(15,6),
    qty_pcs        NUMERIC(15,2),
    qty_lembar     NUMERIC(15,4),
    qty_rim        NUMERIC(15,4),
    qty_ton        NUMERIC(15,6),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
  )
`);
 
// Tabel riwayat upload file produk
await query(`
  CREATE TABLE IF NOT EXISTS produk_uploads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name      VARCHAR(500) NOT NULL,
    total_rows     INTEGER DEFAULT 0,
    inserted_count INTEGER DEFAULT 0,
    updated_count  INTEGER DEFAULT 0,
    uploaded_by    INTEGER REFERENCES users(id),
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )
`);

// Tabel riwayat upload file MSMR
await query(`
  CREATE TABLE IF NOT EXISTS msmr_uploads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name      VARCHAR(500) NOT NULL,
    status         VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success','error')),
    sheet_count    INTEGER DEFAULT 0,
    total_rows     INTEGER DEFAULT 0,
    uploaded_by    INTEGER REFERENCES users(id),
    created_at     TIMESTAMPTZ DEFAULT NOW()
  )
`);

// Tabel 1 sheet Excel MSMR (per PT/CV distributor)
await query(`
  CREATE TABLE IF NOT EXISTS msmr_reports (
    id                     SERIAL PRIMARY KEY,
    upload_id              UUID NOT NULL REFERENCES msmr_uploads(id) ON DELETE CASCADE,

    sheet_name             VARCHAR(200) NOT NULL,
    company_name           VARCHAR(300),
    bulan                  DATE,
    brand_filter           VARCHAR(200),
    satuan                 VARCHAR(50),

    -- Label periode mingguan (dinamis, bisa beda tiap bulan), dipakai
    -- bareng oleh semua baris di sheet ini saat direkonstruksi jadi tabel.
    estimasi_week_labels   JSONB DEFAULT '[]',
    po_sales_week_labels   JSONB DEFAULT '[]',

    deleted_at             TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (upload_id, sheet_name)
  )
`);

// Tabel baris data MSMR per AREA x BRAND (detail / summary / total)
// 1 baris di sini = 1 baris di Excel. Nilai mingguan disimpan JSONB
// (bukan tabel terpisah) karena jumlah kolom mingguan itu dinamis,
// diambil dari posisi section header saat parsing, bukan hardcode 5/6 kolom.
await query(`
  CREATE TABLE IF NOT EXISTS msmr_rows (
    id                        BIGSERIAL PRIMARY KEY,
    report_id                 INTEGER NOT NULL REFERENCES msmr_reports(id) ON DELETE CASCADE,

    -- urutan baris persis seperti di file Excel; dipakai buat ORDER BY
    -- pas ditampilkan balik (AREA cuma keisi di baris pertama grupnya,
    -- jadi gak bisa di-ORDER BY area/brand begitu saja).
    row_order                 INTEGER NOT NULL DEFAULT 0,

    product_id                BIGINT REFERENCES products(id),
    product_match_status      VARCHAR(20) NOT NULL CHECK (product_match_status IN ('matched','unmatched','ambiguous')),
    row_type                  VARCHAR(20) NOT NULL CHECK (row_type IN ('detail','summary','total')),

    area                      VARCHAR(200),
    brand                     VARCHAR(200),
    kode_pabrik                VARCHAR(50),
    kode_brand                 VARCHAR(100),

    estimasi_order_month       NUMERIC(18,2),
    estimasi_weekly             JSONB DEFAULT '[]',   -- [{label, value}, ...]

    purchase_order_quota        NUMERIC(18,2),
    purchase_order_weekly        JSONB DEFAULT '[]',   -- [{label, value}, ...]

    sales_weekly                  JSONB DEFAULT '[]',   -- [{label, value}, ...]
    sales_actual                   NUMERIC(18,2),
    sales_actual_last_month        NUMERIC(18,2),

    dev_numeric                     NUMERIC(18,2),
    dev_percent                     NUMERIC(8,2),

  --  ann_quota                        NUMERIC(18,2),
  --  ann_actual                       NUMERIC(18,2),
  --  ann_dev_numeric                   NUMERIC(18,2),
  --  ann_dev_percent                   NUMERIC(8,2),
  --  ann_dev_pct_bl                     NUMERIC(8,2),

    created_at                         TIMESTAMPTZ DEFAULT NOW()
  )
`);

// View siap pakai buat render tabel di frontend, urut sesuai row_order,
// sudah gabung meta sheet (company_name, bulan, label minggu, dst).
await query(`
  CREATE OR REPLACE VIEW vw_msmr_table AS
  SELECT
    rep.id                     AS report_id,
    rep.upload_id,
    rep.sheet_name,
    rep.company_name,
    rep.bulan,
    rep.brand_filter,
    rep.satuan,
    rep.estimasi_week_labels,
    rep.po_sales_week_labels,

    r.id                       AS row_id,
    r.row_order,
    r.row_type,
    r.area,
    r.brand,
    r.kode_pabrik,
    r.kode_brand,
    r.product_id,
    r.product_match_status,

    r.estimasi_order_month,
    r.estimasi_weekly,

    r.purchase_order_quota,
    r.purchase_order_weekly,

    r.sales_weekly,
    r.sales_actual,
    r.sales_actual_last_month,

    r.dev_numeric,
    r.dev_percent


  FROM msmr_reports rep
  JOIN msmr_rows r ON r.report_id = rep.id
  WHERE rep.deleted_at IS NULL
  ORDER BY rep.id, r.row_order
`);

// ══════════════════════════════════════════════════════════
// STOCK LEVEL PABRIK — upload mingguan (Stok Pabrik, Pengiriman SSS,
// Stok Aktual, WIP, BJ, Kiriman, Plan Produksi, Keterangan).
// Header per batch upload (1 periode minggu) + baris per kode_brand+kode_pabrik+jenis_etiket.
// ══════════════════════════════════════════════════════════

await query(`
  CREATE TABLE IF NOT EXISTS stock_level_uploads (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name     VARCHAR(500),
    periode_awal  DATE NOT NULL,   -- contoh: Stok Pabrik "7 Agt"
    periode_akhir DATE NOT NULL,   -- contoh: Estimasi/Stok Aktual "14 Agt"
    uploaded_by   INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
  )
`);

await query(`
  CREATE TABLE IF NOT EXISTS stock_level_rows (
    id             BIGSERIAL PRIMARY KEY,
    upload_id      UUID NOT NULL REFERENCES stock_level_uploads(id) ON DELETE CASCADE,

    kode_pabrik    VARCHAR(50) NOT NULL,
    kode_brand     VARCHAR(100) NOT NULL,
    -- Level 1: dari section divider Excel. 'UV' | 'Konven' | '-' (kalau
    -- section-nya tidak menyebut UV/Konven, mis. section "Dos" yang
    -- isinya campuran brand tanpa penanda UV/Konven eksplisit).
    jenis_etiket   VARCHAR(100) NOT NULL,
    -- Level 2: dari prefix teks deskripsi baris ITU SENDIRI, nested di
    -- dalam jenis_etiket manapun. 'Etiket' | 'Inner' | 'Dos' | 'Slop Dos'.
    tipe           VARCHAR(50) NOT NULL DEFAULT '-',
    -- Nama/deskripsi produk PERSIS dari kolom Etiket Excel (mis. "Etiket
    -- On Teh Jasmine Kretek 12 (New)" / "Inner On Teh Jasmine 12 (New)").
    -- Ini basis nama_produk yang ditampilkan di dashboard, BUKAN
    -- products.nama_brand — karena products.nama_brand cuma 1 nama per
    -- kode_brand dan tidak bisa bedain varian Etiket/Inner/Dos.
    nama_produk    TEXT NOT NULL DEFAULT '',

    stok_pabrik    NUMERIC(15,2) DEFAULT 0,   -- Stok Pabrik [periode_awal]
    pengiriman     NUMERIC(15,2) DEFAULT 0,   -- Pengiriman SSS [periode_awal - periode_akhir]
    stok_aktual    NUMERIC(15,2) DEFAULT 0,   -- Stok Aktual [periode_akhir] (upload minggu sebelumnya)

    wip            NUMERIC(15,2),             -- Work In Progress
    bj             NUMERIC(15,2),             -- Barang Jadi
    kiriman        NUMERIC(15,2),
    plan_produksi  NUMERIC(15,2),
    keterangan     TEXT,

    created_at     TIMESTAMPTZ DEFAULT NOW(),

    -- jenis_etiket + tipe IKUT jadi bagian unique key: 1 kode_brand boleh
    -- punya beberapa baris (Etiket + Inner, atau Etiket + Dos) dalam 1
    -- upload yang sama, masing-masing dianggap item fisik terpisah.
    UNIQUE (upload_id, kode_pabrik, kode_brand, jenis_etiket, tipe)
  )
`);

    // ── MIGRASI utk tabel stock_level_rows yang SUDAH ADA sebelum
    // perubahan ini. CREATE TABLE IF NOT EXISTS di atas TIDAK akan
    // jalan lagi kalau tabelnya sudah pernah dibuat sebelumnya —
    // makanya perlu ALTER eksplisit di sini. ──
    await query(`ALTER TABLE stock_level_rows ADD COLUMN IF NOT EXISTS nama_produk TEXT NOT NULL DEFAULT ''`);
    await query(`ALTER TABLE stock_level_rows ADD COLUMN IF NOT EXISTS tipe VARCHAR(50) NOT NULL DEFAULT '-'`);
    await query(`ALTER TABLE stock_level_rows DROP CONSTRAINT IF EXISTS stock_level_rows_upload_id_kode_pabrik_kode_brand_key`);
    await query(`ALTER TABLE stock_level_rows DROP CONSTRAINT IF EXISTS stock_level_rows_upload_kode_jenis_key`);
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'stock_level_rows_upload_kode_jenis_tipe_key'
        ) THEN
          ALTER TABLE stock_level_rows
            ADD CONSTRAINT stock_level_rows_upload_kode_jenis_tipe_key
            UNIQUE (upload_id, kode_pabrik, kode_brand, jenis_etiket, tipe);
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_slu_periode ON stock_level_uploads(periode_akhir)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_slr_upload   ON stock_level_rows(upload_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_slr_kode     ON stock_level_rows(kode_pabrik, kode_brand, jenis_etiket, tipe)`);

    // Indexing untuk MSMR
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_uploads_created  ON msmr_uploads(created_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_reports_upload_id ON msmr_reports(upload_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_reports_bulan     ON msmr_reports(bulan)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_reports_deleted   ON msmr_reports(deleted_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_report_id    ON msmr_rows(report_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_product_id   ON msmr_rows(product_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_area         ON msmr_rows(area)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_brand        ON msmr_rows(brand)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_row_type     ON msmr_rows(report_id, row_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_order        ON msmr_rows(report_id, row_order)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_msmr_rows_kode         ON msmr_rows(kode_pabrik, kode_brand)`);

    await query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_products_pabrik_brand_jenis ON products(kode_pabrik, kode_brand, jenis)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_products_kode_brand ON products(kode_brand)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_products_kode_pabrik ON products(kode_pabrik)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_produk_uploads_created ON produk_uploads(created_at)`);


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