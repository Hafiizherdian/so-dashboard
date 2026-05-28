// app/api/lhkp/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export const runtime    = 'nodejs';
export const maxDuration = 60;

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function toStr(v: unknown): string {
  if (v == null || v === '-') return '';
  return String(v).replace(/_x000D_/g, '').trim();
}
function toDate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } catch { /* ignore */ }
  }
  const dt = new Date(String(v));
  return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: 'File tidak ditemukan' });

    const buf = Buffer.from(await file.arrayBuffer());
    const wb  = XLSX.read(buf, { type: 'buffer' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

    if (!raw.length) return NextResponse.json({ success: false, error: 'File kosong atau format tidak dikenali' });

    // Hitung rentang tanggal
    const dates = raw.map(r => toDate(r['Tanggal'])).filter(Boolean) as string[];
    const tglAwal  = dates.sort()[0] ?? null;
    const tglAkhir = dates.sort().reverse()[0] ?? null;

    // Insert upload header
    const upRes = await query<{ id: string }>(
      `INSERT INTO lhkp_uploads (file_name, file_size, record_count, tgl_awal, tgl_akhir, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [file.name, file.size, raw.length, tglAwal, tglAkhir, payload.userId]
    );
    const uploadId = upRes[0].id;

    // Batch insert records
    const BATCH = 300;
    for (let i = 0; i < raw.length; i += BATCH) {
      const batch = raw.slice(i, i + BATCH);
      const vals: any[] = [];
      const placeholders = batch.map((r, j) => {
        const b = j * 13;
        vals.push(
          uploadId,
          toStr(r['Week']),
          toDate(r['Tanggal']),
          toStr(r['Mesin']),
          toStr(r['Proses']),
          toStr(r['No_Job_Order']),
          toStr(r['No_Proses']),
          toStr(r['No_LHKP']),
          toStr(r['Output_Produk']),
          toNum(r['Qty_Plan']),
          toNum(r['Qty_Baik']),
          toNum(r['Qty_Rusak']),
          toStr(r['Unit']) || 'pcs',
        );
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13})`;
      });
      await query(
        `INSERT INTO lhkp_records
           (upload_id,week,tanggal,mesin,proses,no_job_order,no_proses,no_lhkp,output_produk,qty_plan,qty_baik,qty_rusak,unit)
         VALUES ${placeholders.join(',')}`,
        vals
      );
    }

    // Update record_count
    await query(`UPDATE lhkp_uploads SET record_count=$1 WHERE id=$2`, [raw.length, uploadId]);

    return NextResponse.json({ success: true, data: { upload_id: uploadId, record_count: raw.length, tgl_awal: tglAwal, tgl_akhir: tglAkhir } });
  } catch (e: any) {
    console.error('[lhkp/upload]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}