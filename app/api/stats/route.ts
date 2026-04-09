import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await initDb();

    const rows = await query<{
      total_records: string;
      total_penjualan: string;
      total_so: string;
      total_outstanding: string;
      total_files: string;
    }>(`
      SELECT
        COUNT(*)                                                        AS total_records,
        COALESCE(SUM(sub_total), 0)                                     AS total_penjualan,
        COALESCE(SUM(qty_po * harga), 0)                                AS total_so,
        COALESCE(SUM((qty_po - qty_terkirim) * harga), 0)               AS total_outstanding,
        (SELECT COUNT(*) FROM uploaded_files WHERE status = 'completed') AS total_files
      FROM sales_transactions
    `);

    const r = rows[0];

    return NextResponse.json({
      success: true,
      data: {
        total_records:     Number(r.total_records),
        total_penjualan:   Number(r.total_penjualan),
        total_so:          Number(r.total_so),
        total_outstanding: Number(r.total_outstanding),
        total_files:       Number(r.total_files),
      } satisfies import('@/types').DbStats,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}