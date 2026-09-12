// app/api/plan/[id]/preview/route.ts
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
    if (!hasMenuAccess(payload, 'Plan')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const { id: uploadId } = await params; // <-- await di sini

    const rows = await query(`
      SELECT
        j.no_urut    AS "No Urut",
        j.nomor_jop  AS "Nomor JOP",
        j.nama_produk AS "Nama Produk",
        j.ukuran_kertas AS "Ukuran Kertas",
        j.up          AS "UP",
        j.qty_jop     AS "Qty JOP",
        j.qty_cetak   AS "Qty Cetak"
      FROM plan_jobs j
      WHERE j.upload_id = $1
      ORDER BY j.no_urut
      LIMIT 10
    `, [uploadId]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[plan/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}