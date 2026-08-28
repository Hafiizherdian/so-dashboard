import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import * as xlsx from 'xlsx';

import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb, pool } from '@/lib/db';

// Import Parsers
import { parseExcel } from '@/lib/parseExcel';
import { parseProdukWorkbookBuffer } from '@/lib/parseProduk';
import { insertProdukWorkbook } from '@/lib/insertProduk';
import { parseMsmrWorkbookBuffer, MsmrSheetReport } from '@/lib/parseMsmr';
import { insertMsmrWorkbook } from '@/lib/insertMsmr';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TOLERANCE = 1;
const REKAP_SHEET_PATTERN = /^REKAP$/i;

// Helper MSMR
function reconciliationWarnings(reports: MsmrSheetReport[]): string[] {
  const warnings: string[] = [];
  for (const report of reports) {
    if (!report.total) {
      warnings.push(`[${report.sheetName}] Tidak ditemukan baris TOTAL di sheet ini.`);
      continue;
    }
    const sumSales = report.rows.reduce((sum, row) => sum + (row.salesActual ?? 0), 0);
    const totalSales = report.total.salesActual ?? 0;
    if (Math.abs(sumSales - totalSales) > TOLERANCE) {
      warnings.push(`[${report.sheetName}] TOTAL sales actual (${totalSales}) beda dari jumlah detail (${sumSales}).`);
    }
    const sumPo = report.rows.reduce((sum, row) => sum + (row.purchaseOrderQuota ?? 0), 0);
    const totalPo = report.total.purchaseOrderQuota ?? 0;
    if (Math.abs(sumPo - totalPo) > TOLERANCE) {
      warnings.push(`[${report.sheetName}] TOTAL purchase order (${totalPo}) beda dari jumlah detail (${sumPo}).`);
    }
  }
  return warnings;
}

export async function POST(req: NextRequest) {
  let client = null;
  let transactionStarted = false;

  try {
    // ============================================================
    // 1. OTORISASI & AMBIL FILE
    // ============================================================
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasMenuAccess(payload, 'upload')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    await initDb();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const area = (form.get('area') as string) || '';
    if (!file) return NextResponse.json({ success: false, error: 'No file' });

    const buf = Buffer.from(await file.arrayBuffer());
    const uploadedBy = payload.id ?? null;

    // ============================================================
    // 2. DETEKSI JENIS FILE SUPER CEPAT
    // Membaca sheetNames dan baris 1 (Header) tanpa me-load seluruh data
    // ============================================================
    const wbFast = xlsx.read(buf, { type: 'buffer', sheetRows: 1 });
    const sheetNames = wbFast.SheetNames.map(s => s.trim().toUpperCase());
    const firstSheetName = wbFast.SheetNames[0];
    const headers = (xlsx.utils.sheet_to_json(wbFast.Sheets[firstSheetName], { header: 1 })[0] || []) as string[];
    const headerStr = headers.join(' ').toLowerCase();
    const fileNameStr = file.name.toLowerCase();

    let detectedType: 'msmr' | 'produk' | 'lainnya' = 'lainnya';

    if (sheetNames.some(name => ['REKAP', 'CGC', 'KTP', 'KTAP', 'PM'].includes(name))) {
      detectedType = 'msmr';
    } else if (
      headerStr.includes('kode_brand') || 
      headerStr.includes('kode brand') || 
      headerStr.includes('nama_brand') || 
      headerStr.includes('nama brand') || 
      headerStr.includes('kode_pab') ||
      fileNameStr.includes('produk') ||
      fileNameStr.includes('product')
    ) {
      detectedType = 'produk';
    }

    // ============================================================
    // 3. ROUTING & EKSEKUSI BERDASARKAN JENIS FILE
    // ============================================================

    // --- CABANG A: MSMR ---
    if (detectedType === 'msmr') {
      let reports = parseMsmrWorkbookBuffer(buf);
      const skippedSheets = reports.filter(r => REKAP_SHEET_PATTERN.test(r.sheetName.trim())).map(r => r.sheetName);
      reports = reports.filter(r => !REKAP_SHEET_PATTERN.test(r.sheetName.trim()));

      if (!reports.length) return NextResponse.json({ success: false, error: 'Tidak ada sheet MSMR valid' }, { status: 400 });

      const totalDetailRows = reports.reduce((sum, r) => sum + r.rows.length, 0);
      const reconciliation = reconciliationWarnings(reports);
      if (skippedSheets.length) reconciliation.unshift(`Sheet dilewati (rekap): ${skippedSheets.join(', ')}.`);

      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;

      const uploadRes = await client.query(
        `INSERT INTO msmr_uploads (file_name, status, sheet_count, total_rows) VALUES ($1, $2, $3, $4) RETURNING id`,
        [file.name, 'success', reports.length, totalDetailRows]
      );
      
      const insertResult = await insertMsmrWorkbook(reports, uploadRes.rows[0].id, client);
      await client.query('COMMIT');
      transactionStarted = false;

      return NextResponse.json({
        success: true, type: 'msmr',
        data: { total_sheets: insertResult.total_sheets, warnings: [...reconciliation, ...insertResult.warnings] }
      });
    }

    // --- CABANG B: MASTER PRODUK ---
    else if (detectedType === 'produk') {
      const parsed = parseProdukWorkbookBuffer(buf);
      if (parsed.rows.length === 0) return NextResponse.json({ success: false, error: 'Tidak ada baris data Produk' }, { status: 400 });

      const { inserted, updated } = await insertProdukWorkbook(pool, parsed.rows);
      const uploadId = randomUUID();
      
      await query(
        `INSERT INTO produk_uploads (id, file_name, total_rows, inserted_count, updated_count, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uploadId, file.name, parsed.rows.length, inserted, updated, uploadedBy]
      );

      return NextResponse.json({
        success: true, type: 'produk',
        data: { inserted, updated, duplicate_warnings: parsed.duplicateWarnings }
      });
    }

    // --- CABANG C: SO OUTSTANDING / SALES TRANSACTIONS ---
    else {
      // Gunakan parseExcel bawaan kamu
      const { type, rows } = parseExcel(buf);

      const fileRes = await query<{id: string}>(
        `INSERT INTO uploaded_files (original_name, file_size, status, area) VALUES ($1,$2,'processing',$3) RETURNING id`,
        [file.name, file.size, area]
      );
      const fileId = fileRes[0].id;

      try {
        const BATCH_SIZE = 500;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          
          if (type === 'so_outstanding') {
            const vals: any[] = [];
            const placeholders = batch.map((r, j) => {
              const b = j * 16;
              vals.push(fileId, r.week, r.tanggal, r.ref_po, r.nomor_so, r.pelanggan, r.produk, r.panjang, r.lebar, r.tinggi, r.berat, r.harga, r.uom, r.qty_order, r.qty_delivered, r.qty_sisa);
              return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16})`;
            });
            await query(`INSERT INTO so_outstanding (file_id, week, tanggal, ref_po, nomor_so, pelanggan, produk, panjang, lebar, tinggi, berat, harga, uom, qty_order, qty_delivered, qty_sisa) VALUES ${placeholders.join(',')}`, vals);
          
          } else {
            const vals: any[] = [];
            const placeholders = batch.map((r, j) => {
              const b = j * 23;
              vals.push(fileId, r.week, r.tanggal, r.produk_id, r.qty_po, r.nomor_penjualan, r.type_customer, r.pelanggan, r.nomor_so, r.kategori, r.deskripsi_produk, r.brand, r.qty_terkirim, r.satuan, r.harga, r.bruto, r.diskon, r.pajak, r.sub_total, r.salesman, r.kota, r.kecamatan, r.jenis);
              return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17},$${b+18},$${b+19},$${b+20},$${b+21},$${b+22},$${b+23})`;
            });
            await query(`INSERT INTO sales_transactions (file_id, week, tanggal, produk_id, qty_po, nomor_penjualan, type_customer, pelanggan, nomor_so, kategori, deskripsi_produk, brand, qty_terkirim, satuan, harga, bruto, diskon, pajak, sub_total, salesman, kota, kecamatan, jenis) VALUES ${placeholders.join(',')}`, vals);
          }
        }

        await query(`UPDATE uploaded_files SET status='completed', record_count=$1 WHERE id=$2`, [rows.length, fileId]);
        
        // Kembalikan response sukses sesuai format lamamu
        return NextResponse.json({ success: true, type, count: rows.length });

      } catch (err: any) {
        await query(`UPDATE uploaded_files SET status='error', error_message=$1 WHERE id=$2`, [err.message, fileId]);
        throw err;
      }
    }

  } catch (err: any) {
    if (transactionStarted && client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
    }
    console.error('[api/upload] error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Terjadi kesalahan saat upload' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}