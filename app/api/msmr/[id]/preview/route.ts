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
    if (!hasMenuAccess(payload, 'upload')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const { id: uploadId } = await params;

    // Ambil 10 baris detail pertama dari semua sheet/report milik upload ini
    const rows = await query(`
      SELECT
        r.sheet_name        AS "Sheet",
        pr.row_type         AS "Tipe Baris",
        pr.brand             AS "Brand",
        pr.sales_actual      AS "Sales Actual",
        pr.purchase_order_quota AS "Purchase Order"
      FROM msmr_rows pr
      JOIN msmr_reports r ON r.id = pr.report_id
      WHERE r.upload_id = $1
        AND r.deleted_at IS NULL
        AND pr.row_type = 'detail'
      ORDER BY r.sheet_name, pr.id
      LIMIT 100
    `, [uploadId]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[msmr/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}