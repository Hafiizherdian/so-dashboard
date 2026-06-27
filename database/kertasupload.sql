-- Migration: buat tabel kertas_uploads
-- Jalankan di psql: psql -U postgres -d so_dashboard -f kertasupload.sql

CREATE TABLE IF NOT EXISTS kertas_uploads (
  id           SERIAL PRIMARY KEY,
  filename     TEXT        NOT NULL,
  periode      VARCHAR(7)  NOT NULL,   -- format "YYYY-MM"
  record_count INTEGER     NOT NULL DEFAULT 0,
  uploaded_by  TEXT,                   -- username dari JWT payload
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kertas_uploads_periode ON kertas_uploads (periode);
CREATE INDEX IF NOT EXISTS idx_kertas_uploads_uploaded_at ON kertas_uploads (uploaded_at DESC);