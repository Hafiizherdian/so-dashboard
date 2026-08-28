/**
 * Insert hasil parseProduk.ts ke tabel `products` (skema di database/products.sql).
 *
 * Pakai upsert (ON CONFLICT) di kombinasi (kode_pabrik, kode_brand, jenis)
 * supaya aman kalau file produk ini di-upload ulang setelah direvisi.
 */

import { Pool, PoolClient } from 'pg';
import type { ProductRow } from './parseProduk';

export async function insertProdukWorkbook(
  pool: Pool,
  rows: ProductRow[],
): Promise<{ inserted: number; updated: number }> {
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const wasInsert = await upsertProduct(client, row);
      if (wasInsert) inserted++;
      else updated++;
    }
    await client.query('COMMIT');
    return { inserted, updated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function upsertProduct(client: PoolClient, row: ProductRow): Promise<boolean> {
  const res = await client.query<{ inserted: boolean }>(
    `INSERT INTO products (
       nama_brand, kode_brand, kategori, kode_pabrik, pabrik,
       batang_per_bks, bks_per_slop, slop_per_bal, bal_per_dos, keterangan,
       jenis, up, kertas, gsm, l, p, kg_per_rim, qty_pcs, qty_lembar, qty_rim, qty_ton
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (kode_pabrik, kode_brand, jenis) DO UPDATE SET
       nama_brand = EXCLUDED.nama_brand,
       kategori = EXCLUDED.kategori,
       pabrik = EXCLUDED.pabrik,
       batang_per_bks = EXCLUDED.batang_per_bks,
       bks_per_slop = EXCLUDED.bks_per_slop,
       slop_per_bal = EXCLUDED.slop_per_bal,
       bal_per_dos = EXCLUDED.bal_per_dos,
       keterangan = EXCLUDED.keterangan,
       up = EXCLUDED.up,
       kertas = EXCLUDED.kertas,
       gsm = EXCLUDED.gsm,
       l = EXCLUDED.l,
       p = EXCLUDED.p,
       kg_per_rim = EXCLUDED.kg_per_rim,
       qty_pcs = EXCLUDED.qty_pcs,
       qty_lembar = EXCLUDED.qty_lembar,
       qty_rim = EXCLUDED.qty_rim,
       qty_ton = EXCLUDED.qty_ton,
       updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      row.namaBrand,
      row.kodeBrand,
      row.kategori,
      row.kodePabrik,
      row.pabrik,
      row.batangPerBks,
      row.bksPerSlop,
      row.slopPerBal,
      row.balPerDos,
      row.keterangan,
      row.jenis,
      row.up,
      row.kertas,
      row.gsm,
      row.l,
      row.p,
      row.kgPerRim,
      row.qtyPcs,
      row.qtyLembar,
      row.qtyRim,
      row.qtyTon,
    ],
  );
  return res.rows[0].inserted;
}