// app/api/plan/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import { parsePlanExcel } from '@/lib/parsePlan';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const buf    = Buffer.from(await file.arrayBuffer());
    const parsed = parsePlanExcel(buf);

    if (!parsed.jobs.length) {
      return NextResponse.json({ success: false, error: 'Tidak ada data JOP yang berhasil dibaca. Periksa format file.' });
    }

    // 1. Insert plan_uploads header
    const uploadRes = await query<{ id: string }>(
      `INSERT INTO plan_uploads (nama_mesin, minggu_awal, minggu_akhir, file_name, uploaded_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [parsed.nama_mesin, parsed.minggu_awal, parsed.minggu_akhir, file.name, payload.userId]
    );
    const uploadId = uploadRes[0].id;

    let totalShifts = 0;

    // 2. Insert jobs + shifts
    for (const job of parsed.jobs) {
      const jobRes = await query<{ id: string }>(
        `INSERT INTO plan_jobs
           (upload_id, no_urut, nomor_jop, nama_produk, ukuran_kertas, up, qty_jop, qty_cetak)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [uploadId, job.no_urut, job.nomor_jop, job.nama_produk,
         job.ukuran_kertas, job.up, job.qty_jop, job.qty_cetak]
      );
      const jobId = jobRes[0].id;

      if (job.shifts.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < job.shifts.length; i += BATCH) {
          const batch = job.shifts.slice(i, i + BATCH);
          const vals: any[] = [];
          const placeholders = batch.map((s, j) => {
            const b = j * 5;
            vals.push(jobId, uploadId, s.tanggal, s.shift, s.qty);
            return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`;
          });
          await query(
            `INSERT INTO plan_shifts (job_id, upload_id, tanggal, shift, qty)
             VALUES ${placeholders.join(',')}`,
            vals
          );
          totalShifts += batch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        upload_id:    uploadId,
        nama_mesin:   parsed.nama_mesin,
        minggu_awal:  parsed.minggu_awal,
        minggu_akhir: parsed.minggu_akhir,
        total_jobs:   parsed.jobs.length,
        total_shifts: totalShifts,
      },
    });
  } catch (e: any) {
    console.error('[plan/upload]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}