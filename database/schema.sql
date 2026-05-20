-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('root','admin','user')),
  areas TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploaded files
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing','completed','error')),
  area VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS so_outstanding (
    id BIGSERIAL PRIMARY KEY,
    file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
    
    week INTEGER,
    tanggal DATE,
    ref_po VARCHAR(255),
    nomor_so VARCHAR(200), -- Ini kunci utama untuk JOIN ke sales_transactions
    pelanggan VARCHAR(500),
    produk TEXT,
    
    panjang NUMERIC(10,2) DEFAULT 0,
    lebar NUMERIC(10,2) DEFAULT 0,
    tinggi NUMERIC(10,2) DEFAULT 0,
    berat NUMERIC(10,2) DEFAULT 0,
    
    harga NUMERIC(18,2) DEFAULT 0,
    uom VARCHAR(50),
    qty_order NUMERIC(15,2) DEFAULT 0,
    qty_delivered NUMERIC(15,2) DEFAULT 0,
    qty_sisa NUMERIC(15,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index wajib agar JOIN tidak lemot
CREATE INDEX IF NOT EXISTS idx_soo_nomor_so ON so_outstanding(nomor_so);

-- Main sales transactions
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
);

-- Tabel header / batch upload WIP
CREATE TABLE IF NOT EXISTS wip_uploads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_mesin  VARCHAR(200) NOT NULL,         -- "MESIN KOMORI", "MESIN HEIDELBERG", dll
  minggu_awal DATE,                          -- tanggal pertama di header (18-May-26)
  minggu_akhir DATE,                         -- tanggal terakhir di header
  file_name   VARCHAR(500),
  uploaded_by INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
 
-- Tabel baris JOP
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
);
 
CREATE INDEX IF NOT EXISTS idx_wip_jobs_upload  ON wip_jobs(upload_id);
CREATE INDEX IF NOT EXISTS idx_wip_jobs_nomor   ON wip_jobs(nomor_jop);
 
-- Tabel detail shift per tanggal (tall/normalized)
-- Satu baris = 1 job × 1 tanggal × 1 shift
CREATE TABLE IF NOT EXISTS wip_shifts (
  id        BIGSERIAL PRIMARY KEY,
  job_id    BIGINT REFERENCES wip_jobs(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES wip_uploads(id) ON DELETE CASCADE,
  tanggal   DATE NOT NULL,
  shift     SMALLINT NOT NULL CHECK (shift IN (1, 2)),  -- 1 = Shift I, 2 = Shift II
  qty       NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
 
CREATE INDEX IF NOT EXISTS idx_wip_shifts_job    ON wip_shifts(job_id);
CREATE INDEX IF NOT EXISTS idx_wip_shifts_upload ON wip_shifts(upload_id);
CREATE INDEX IF NOT EXISTS idx_wip_shifts_tgl    ON wip_shifts(tanggal);

-- Index yang berguna
CREATE INDEX IF NOT EXISTS idx_st_tanggal ON sales_transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_st_week ON sales_transactions(week);
CREATE INDEX IF NOT EXISTS idx_st_pelanggan ON sales_transactions(pelanggan);
CREATE INDEX IF NOT EXISTS idx_st_type_customer ON sales_transactions(type_customer);
CREATE INDEX IF NOT EXISTS idx_st_kategori ON sales_transactions(kategori);
CREATE INDEX IF NOT EXISTS idx_st_salesman ON sales_transactions(salesman);
CREATE INDEX IF NOT EXISTS idx_st_file_id ON sales_transactions(file_id);

-- Default root user (password: admin123)
INSERT INTO users (username, password_hash, role) VALUES
  ('admin', '$2b$10$rQZ9LQ5QwQz5L5Q5Q5Q5QeKQZ9LQ5QwQz5L5Q5Q5Q5QeKQZ9LQ5Qw', 'root')
ON CONFLICT (username) DO NOTHING;
