// FILE: app/api/kertas/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

function toNum(v: unknown): number {
  if (!v || v === '-') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (!v || v === '-') return '';
  return String(v).trim();
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const form    = await req.formData();
    const file    = form.get('file') as File | null;
    const periode = (form.get('periode') as string) || new Date().toISOString().slice(0, 7);

    if (!file) return NextResponse.json({ success: false, error: 'No file' });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb  = XLSX.read(buf, { type: 'buffer' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

    if (!raw.length) return NextResponse.json({ success: false, error: 'File kosong' });

    // ── Batch insert ke kertas_stok ──
    let count = 0;
    const BATCH = 200;

    for (let i = 0; i < raw.length; i += BATCH) {
      const batch = raw.slice(i, i + BATCH);
      const vals: any[] = [];

      const placeholders = batch.map((r, j) => {
        const b            = j * 14;
        const produk       = toStr(r['Produk']      || r['produk']);
        const jenisKertas  = toStr(r['jenis kertas'] || r['jenis_kertas'] || r['Jenis Kertas']);
        const gramasi      = toNum(r['Gramasi']      || r['gramasi']);
        const merk         = toStr(r['Merk']         || r['merk']);
        const lebar        = toNum(r['L']            || r['lebar']  || r['l']);
        const panjang      = toNum(r['P']            || r['panjang'] || r['p']);
        const unit         = toStr(r['Unit']         || r['unit']) || 'lbr';
        const saldoAwal    = toNum(r['saldo awal']   || r['saldo_awal']  || r['Saldo Awal']);
        const masuk        = toNum(r['Masuk']        || r['masuk']);
        const keluar       = toNum(r['Keluar']       || r['keluar']);
        const saldoAkhir   = toNum(r['saldo akhir']  || r['saldo_akhir'] || r['Saldo Akhir']);
        const ukuranKertas = `${gramasi} x ${lebar} x ${panjang}`;
        const keterangan   = toStr(r['Keterangan']  || r['keterangan']);

        vals.push(
          produk, jenisKertas, gramasi, merk, ukuranKertas,
          lebar, panjang, unit,
          saldoAwal, masuk, keluar, saldoAkhir,
          periode, keterangan
        );

        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14})`;
      });

      await query(
        `INSERT INTO kertas_stok
           (produk, jenis_kertas, gramasi, merk, ukuran_kertas,
            lebar, panjang, unit,
            saldo_awal, masuk, keluar, saldo_akhir, periode, keterangan)
         VALUES ${placeholders.join(',')}`,
        vals
      );

      count += batch.length;
    }

    // ── Insert 1 baris ke kertas_uploads (history) ──
    const uploadedBy = (payload as any).username ?? (payload as any).sub ?? null;

    await query(
      `INSERT INTO kertas_uploads (filename, periode, record_count, uploaded_by)
       VALUES ($1, $2, $3, $4)`,
      [file.name, periode, count, uploadedBy]
    );

    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    await initDb();

    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20');

    const rows = await query<{
      id: string;
      filename: string;
      periode: string;
      record_count: string;
      uploaded_by: string | null;
      uploaded_at: string;
    }>(
      `SELECT id, filename, periode, record_count, uploaded_by, uploaded_at
       FROM kertas_uploads
       ORDER BY uploaded_at DESC
       LIMIT $1`,
      [limit]
    );

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        id:           r.id,
        filename:     r.filename,
        periode:      r.periode,
        record_count: Number(r.record_count),
        uploaded_by:  r.uploaded_by ?? '-',
        uploaded_at:  r.uploaded_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}