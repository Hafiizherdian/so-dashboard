import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasMenuAccess(payload, 'upload_wip') && !hasMenuAccess(payload, 'WIP')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const { id: uploadId } = await params;

    const rows = await query(`
      SELECT
        deskripsi   AS "Deskripsi",
        nomor_jop   AS "Nomor JOP",
        up          AS "UP",
        cetak_lbr   AS "Cetak (Lbr)",
        embos_lbr   AS "Embos (Lbr)",
        plong_lbr   AS "Plong (Lbr)",
        pretel_pcs  AS "Pretel (Pcs)",
        wip_glue    AS "WIP Glue",
        wip_total   AS "WIP Total",
        bj_pcs      AS "Barang Jadi (Pcs)"
      FROM wip_jobs
      WHERE upload_id = $1
      ORDER BY id
      
    `, [uploadId]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[wip/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}