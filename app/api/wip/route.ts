// app/api/wip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();

    const p = req.nextUrl.searchParams;
    const uploadId = p.get('upload_id');
    const mesin    = p.get('mesin');

    // ── Daftar upload (untuk filter dropdown) ────────────────────────────
    if (p.get('list') === '1') {
      const rows = await query<{
        id: string; nama_mesin: string; minggu_awal: string;
        minggu_akhir: string; file_name: string; created_at: string;
        total_jobs: string;
      }>(`
        SELECT
          u.id, u.nama_mesin, u.minggu_awal, u.minggu_akhir,
          u.file_name, u.created_at,
          COUNT(DISTINCT j.id) AS total_jobs
        FROM wip_uploads u
        LEFT JOIN wip_jobs j ON j.upload_id = u.id
        ${mesin ? `WHERE u.nama_mesin ILIKE $1` : ''}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 100
      `, mesin ? [`%${mesin}%`] : []);

      const mesinList = await query<{ nama_mesin: string }>(`
        SELECT DISTINCT nama_mesin FROM wip_uploads ORDER BY nama_mesin
      `);

      return NextResponse.json({
        success: true,
        data: rows.map(r => ({
          ...r,
          total_jobs: Number(r.total_jobs),
        })),
        mesin_list: mesinList.map(m => m.nama_mesin),
      });
    }

    // ── Data WIP untuk tabel pivot ────────────────────────────────────────
    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (uploadId) { conditions.push(`j.upload_id = $${i++}`); vals.push(uploadId); }
    else if (mesin) { conditions.push(`u.nama_mesin ILIKE $${i++}`); vals.push(`%${mesin}%`); }
    else {
      // Default: upload terbaru
      conditions.push(`j.upload_id = (
        SELECT id FROM wip_uploads ORDER BY created_at DESC LIMIT 1
      )`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Jobs
    const jobs = await query<{
      job_id: string; upload_id: string; nama_mesin: string;
      no_urut: number; nomor_jop: string; nama_produk: string;
      ukuran_kertas: string; up: number; qty_jop: string; qty_cetak: string;
      minggu_awal: string; minggu_akhir: string;
    }>(`
      SELECT
        j.id AS job_id, j.upload_id,
        u.nama_mesin, u.minggu_awal, u.minggu_akhir,
        j.no_urut, j.nomor_jop, j.nama_produk, j.ukuran_kertas,
        j.up, j.qty_jop, j.qty_cetak
      FROM wip_jobs j
      JOIN wip_uploads u ON u.id = j.upload_id
      ${where}
      ORDER BY j.no_urut
    `, vals);

    if (!jobs.length) {
      return NextResponse.json({ success: true, data: { jobs: [], shifts: [], dates: [], nama_mesin: '', minggu_awal: null, minggu_akhir: null } });
    }

    // Shifts untuk jobs tersebut
    const jobIds = jobs.map(j => j.job_id);
    const placeholders = jobIds.map((_, idx) => `$${idx + 1}`).join(',');

    const shifts = await query<{
      job_id: string; tanggal: string; shift: number; qty: string;
    }>(`
      SELECT job_id, tanggal::TEXT, shift, qty
      FROM wip_shifts
      WHERE job_id IN (${placeholders})
      ORDER BY tanggal, shift
    `, jobIds);

    // Daftar tanggal unik (sorted)
    const dateSet = new Set<string>();
    shifts.forEach(s => dateSet.add(s.tanggal));
    const dates = Array.from(dateSet).sort();

    return NextResponse.json({
      success: true,
      data: {
        nama_mesin:   jobs[0]?.nama_mesin ?? '',
        minggu_awal:  jobs[0]?.minggu_awal ?? null,
        minggu_akhir: jobs[0]?.minggu_akhir ?? null,
        upload_id:    jobs[0]?.upload_id ?? null,
        jobs: jobs.map(j => ({
          job_id:        j.job_id,
          no_urut:       j.no_urut,
          nomor_jop:     j.nomor_jop,
          nama_produk:   j.nama_produk,
          ukuran_kertas: j.ukuran_kertas,
          up:            j.up,
          qty_jop:       Number(j.qty_jop),
          qty_cetak:     Number(j.qty_cetak),
        })),
        shifts: shifts.map(s => ({
          job_id:  s.job_id,
          tanggal: s.tanggal,
          shift:   Number(s.shift),
          qty:     Number(s.qty),
        })),
        dates,
      },
    });
  } catch (e: any) {
    console.error('[wip GET]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });

    await query('DELETE FROM wip_uploads WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}