import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

// GET — ambil data WIP terbaru (atau berdasarkan ?upload_id= / ?tanggal=),
// plus riwayat upload singkat buat dropdown pilih snapshot lain.
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasMenuAccess(payload, 'upload_wip') && !hasMenuAccess(payload, 'WIP')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const uploadId = req.nextUrl.searchParams.get('upload_id');
    const tanggal = req.nextUrl.searchParams.get('tanggal');

    // Tentukan upload mana yang mau diambil datanya
    interface WipUploadRow {
      id: string;
      file_name: string;
      tanggal: string;
      status_wip: string | null;
      keterangan: string | null;
      created_at: string;
    }
    let targetUpload: WipUploadRow | null = null;

    if (uploadId) {
      const rows = await query<WipUploadRow>(
        `SELECT id, file_name, tanggal::TEXT, status_wip, keterangan, created_at
         FROM wip_uploads WHERE id = $1`,
        [uploadId]
      );
      targetUpload = rows[0] ?? null;
    } else if (tanggal) {
      const rows = await query<WipUploadRow>(
        `SELECT id, file_name, tanggal::TEXT, status_wip, keterangan, created_at
         FROM wip_uploads WHERE tanggal = $1
         ORDER BY created_at DESC LIMIT 1`,
        [tanggal]
      );
      targetUpload = rows[0] ?? null;
    } else {
      const rows = await query<WipUploadRow>(
        `SELECT id, file_name, tanggal::TEXT, status_wip, keterangan, created_at
         FROM wip_uploads
         ORDER BY created_at DESC LIMIT 1`
      );
      targetUpload = rows[0] ?? null;
    }

    if (!targetUpload) {
      return NextResponse.json({ success: true, data: { upload: null, jobs: [], totals: null, history: [] } });
    }

    const jobs = await query(
      `SELECT id, deskripsi, nomor_jop, up,
              cetak_lbr, embos_lbr, plong_lbr, pretel_pcs, wip_glue, wip_total, bj_pcs
       FROM wip_jobs
       WHERE upload_id = $1
       ORDER BY id`,
      [targetUpload.id]
    );

    const totals = jobs.reduce(
      (acc: any, j: any) => {
        acc.cetak_lbr += Number(j.cetak_lbr);
        acc.embos_lbr += Number(j.embos_lbr);
        acc.plong_lbr += Number(j.plong_lbr);
        acc.pretel_pcs += Number(j.pretel_pcs);
        acc.wip_glue += Number(j.wip_glue);
        acc.wip_total += Number(j.wip_total);
        acc.bj_pcs += Number(j.bj_pcs);
        return acc;
      },
      { cetak_lbr: 0, embos_lbr: 0, plong_lbr: 0, pretel_pcs: 0, wip_glue: 0, wip_total: 0, bj_pcs: 0 }
    );

    // Riwayat upload (ringkas) buat dropdown pilih snapshot tanggal lain
    const history = await query<{
      id: string; file_name: string; tanggal: string; created_at: string; row_count: string;
    }>(
      `SELECT u.id, u.file_name, u.tanggal::TEXT, u.created_at, COUNT(j.id) AS row_count
       FROM wip_uploads u
       LEFT JOIN wip_jobs j ON j.upload_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 30`
    );

    return NextResponse.json({
      success: true,
      data: {
        upload: targetUpload,
        jobs,
        totals,
        history: history.map((h) => ({ ...h, row_count: Number(h.row_count) })),
      },
    });
  } catch (e: any) {
    console.error('[wip upload GET]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// DELETE — hapus 1 batch upload WIP (?id=...); 
// wip_jobs ikut kehapus lewat FK ON DELETE CASCADE (lihat definisi tabel di lib/db.ts).
export async function DELETE(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasMenuAccess(payload, 'upload_wip')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });
    await query('DELETE FROM wip_uploads WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[wip upload DELETE]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}