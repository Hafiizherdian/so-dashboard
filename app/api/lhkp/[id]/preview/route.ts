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
    if (!hasMenuAccess(payload, 'lhkp')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const { id: uploadId } = await params; // wajib di-await (Next 15)

    const rows = await query(`
      SELECT
        week          AS "Week",
        tanggal::TEXT AS "Tanggal",
        mesin         AS "Mesin",
        proses        AS "Proses",
        no_job_order  AS "No Job Order",
        no_lhkp       AS "No LHKP",
        output_produk AS "Output Produk",
        qty_plan      AS "Qty Plan",
        qty_baik      AS "Qty Baik",
        qty_rusak     AS "Qty Rusak",
        unit          AS "Unit"
      FROM lhkp_records
      WHERE upload_id = $1
      ORDER BY tanggal, id
      LIMIT 10
    `, [uploadId]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[lhkp/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}