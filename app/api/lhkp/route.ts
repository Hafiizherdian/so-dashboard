// app/api/lhkp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();

    const p = req.nextUrl.searchParams;

    // ── List uploads ──────────────────────────────────────────────────────────
    if (p.get('list') === '1') {
      const rows = await query<{
        id: string; file_name: string; record_count: number;
        tgl_awal: string; tgl_akhir: string; created_at: string;
      }>(`SELECT id, file_name, record_count, tgl_awal::TEXT, tgl_akhir::TEXT, created_at
          FROM lhkp_uploads ORDER BY created_at DESC LIMIT 100`);
      return NextResponse.json({ success: true, data: rows });
    }

    // ── Filter options ────────────────────────────────────────────────────────
    if (p.get('filters') === '1') {
      const uploadId = p.get('upload_id');
      const cond     = uploadId ? `WHERE upload_id = $1` : '';
      const vals     = uploadId ? [uploadId] : [];

      const [weeks, bulans, mesin, proses] = await Promise.all([
        query<{ week: string }>(`SELECT DISTINCT week FROM lhkp_records ${cond} ORDER BY week`, vals),
        query<{ bulan: string }>(`
          SELECT DISTINCT TO_CHAR(tanggal, 'YYYY-MM') AS bulan
          FROM lhkp_records ${cond} WHERE tanggal IS NOT NULL
          ORDER BY bulan`, vals),
        query<{ mesin: string }>(`SELECT DISTINCT mesin FROM lhkp_records ${cond} WHERE mesin != '' ORDER BY mesin`, vals),
        query<{ proses: string }>(`SELECT DISTINCT proses FROM lhkp_records ${cond} WHERE proses != '' ORDER BY proses`, vals),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          weeks:  weeks.map(r => r.week),
          bulans: bulans.map(r => r.bulan),
          mesin:  mesin.map(r => r.mesin),
          proses: proses.map(r => r.proses),
        },
      });
    }

    // ── Dashboard / summary data ──────────────────────────────────────────────
    const uploadId = p.get('upload_id');
    const week     = p.get('week');
    const bulan    = p.get('bulan');
    const mesin    = p.get('mesin');
    const proses   = p.get('proses');
    const search   = p.get('search');

    const conds: string[] = [];
    const vals: any[] = [];
    let i = 1;

    if (uploadId) { conds.push(`upload_id = $${i++}`); vals.push(uploadId); }
    else {
      conds.push(`upload_id = (SELECT id FROM lhkp_uploads ORDER BY created_at DESC LIMIT 1)`);
    }
    if (week   && week   !== 'all') { conds.push(`week = $${i++}`);                          vals.push(week); }
    if (bulan  && bulan  !== 'all') { conds.push(`TO_CHAR(tanggal,'YYYY-MM') = $${i++}`);    vals.push(bulan); }
    if (mesin  && mesin  !== 'all') { conds.push(`mesin ILIKE $${i++}`);                     vals.push(`%${mesin}%`); }
    if (proses && proses !== 'all') { conds.push(`proses = $${i++}`);                        vals.push(proses); }
    if (search)                     { conds.push(`(output_produk ILIKE $${i++} OR no_job_order ILIKE $${i++})`); vals.push(`%${search}%`); vals.push(`%${search}%`); }

    const where = 'WHERE ' + conds.join(' AND ');

    // Summary cards
    const [summary, byProses, byMesin, byWeek, detail] = await Promise.all([
      query<{
        total_records: string; total_plan: string;
        total_baik: string; total_rusak: string;
      }>(`SELECT COUNT(*) AS total_records,
                COALESCE(SUM(qty_plan),0)  AS total_plan,
                COALESCE(SUM(qty_baik),0)  AS total_baik,
                COALESCE(SUM(qty_rusak),0) AS total_rusak
          FROM lhkp_records ${where}`, vals),

      query<{ proses: string; qty_baik: string; qty_rusak: string; records: string }>(`
        SELECT proses,
               COALESCE(SUM(qty_baik),0)  AS qty_baik,
               COALESCE(SUM(qty_rusak),0) AS qty_rusak,
               COUNT(*) AS records
        FROM lhkp_records ${where}
        GROUP BY proses ORDER BY qty_baik DESC LIMIT 15`, vals),

      query<{ mesin: string; qty_baik: string; qty_rusak: string; records: string }>(`
        SELECT mesin,
               COALESCE(SUM(qty_baik),0)  AS qty_baik,
               COALESCE(SUM(qty_rusak),0) AS qty_rusak,
               COUNT(*) AS records
        FROM lhkp_records ${where} AND mesin != ''
        GROUP BY mesin ORDER BY qty_baik DESC LIMIT 15`, vals),

      query<{ week: string; qty_baik: string; qty_rusak: string; records: string }>(`
        SELECT week,
               COALESCE(SUM(qty_baik),0)  AS qty_baik,
               COALESCE(SUM(qty_rusak),0) AS qty_rusak,
               COUNT(*) AS records
        FROM lhkp_records ${where}
        GROUP BY week ORDER BY week`, vals),

      query<{
        id: string; tanggal: string; week: string; mesin: string; proses: string;
        no_job_order: string; no_lhkp: string; output_produk: string;
        qty_plan: string; qty_baik: string; qty_rusak: string; unit: string;
      }>(`SELECT id, tanggal::TEXT, week, mesin, proses,
                no_job_order, no_lhkp, output_produk,
                qty_plan, qty_baik, qty_rusak, unit
          FROM lhkp_records ${where}
          ORDER BY tanggal DESC, id DESC
          LIMIT 500`, vals),
    ]);

    const s = summary[0];
    const totalBaik  = Number(s.total_baik);
    const totalRusak = Number(s.total_rusak);
    const totalPlan  = Number(s.total_plan);
    const yieldPct   = (totalBaik + totalRusak) > 0
      ? (totalBaik / (totalBaik + totalRusak)) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_records: Number(s.total_records),
          total_plan:    totalPlan,
          total_baik:    totalBaik,
          total_rusak:   totalRusak,
          yield_pct:     yieldPct,
        },
        byProses: byProses.map(r => ({
          proses:     r.proses || '(Tanpa Proses)',
          qty_baik:   Number(r.qty_baik),
          qty_rusak:  Number(r.qty_rusak),
          records:    Number(r.records),
        })),
        byMesin: byMesin.map(r => ({
          mesin:     r.mesin || '—',
          qty_baik:  Number(r.qty_baik),
          qty_rusak: Number(r.qty_rusak),
          records:   Number(r.records),
        })),
        byWeek: byWeek.map(r => ({
          week:      r.week,
          qty_baik:  Number(r.qty_baik),
          qty_rusak: Number(r.qty_rusak),
          records:   Number(r.records),
        })),
        detail: detail.map(r => ({
          ...r,
          qty_plan:  Number(r.qty_plan),
          qty_baik:  Number(r.qty_baik),
          qty_rusak: Number(r.qty_rusak),
        })),
      },
    });
  } catch (e: any) {
    console.error('[lhkp GET]', e);
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
    await query('DELETE FROM lhkp_uploads WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}