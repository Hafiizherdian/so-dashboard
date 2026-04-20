import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import { parseExcel } from '@/lib/parseExcel';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await initDb();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const area = (form.get('area') as string) || '';
    if (!file) return NextResponse.json({ success: false, error: 'No file' });

    const buf = Buffer.from(await file.arrayBuffer());
    const { type, rows } = parseExcel(buf);

    // 1. Simpan metadata file
    const fileRes = await query<{id: string}>(
      `INSERT INTO uploaded_files (original_name, file_size, status, area) VALUES ($1,$2,'processing',$3) RETURNING id`,
      [file.name, file.size, area]
    );
    const fileId = fileRes[0].id;

    try {
      // 2. Batch Insert berdasarkan tipe
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
            const b = j * 22;
            vals.push(fileId, r.week, r.tanggal, r.produk_id, r.qty_po, r.nomor_penjualan, r.type_customer, r.pelanggan, r.nomor_so, r.kategori, r.deskripsi_produk, r.brand, r.qty_terkirim, r.satuan, r.harga, r.bruto, r.diskon, r.pajak, r.sub_total, r.salesman, r.kota, r.kecamatan);
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17},$${b+18},$${b+19},$${b+20},$${b+21},$${b+22})`;
          });
          await query(`INSERT INTO sales_transactions (file_id, week, tanggal, produk_id, qty_po, nomor_penjualan, type_customer, pelanggan, nomor_so, kategori, deskripsi_produk, brand, qty_terkirim, satuan, harga, bruto, diskon, pajak, sub_total, salesman, kota, kecamatan) VALUES ${placeholders.join(',')}`, vals);
        }
      }

      await query(`UPDATE uploaded_files SET status='completed', record_count=$1 WHERE id=$2`, [rows.length, fileId]);
      return NextResponse.json({ success: true, type, count: rows.length });

    } catch (err: any) {
      await query(`UPDATE uploaded_files SET status='error', error_message=$1 WHERE id=$2`, [err.message, fileId]);
      throw err;
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}