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
    if (!hasMenuAccess(payload, 'upload_stock') && !hasMenuAccess(payload, 'StockLevel')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const { id: uploadId } = await params;

    const rows = await query(`
      SELECT
        kode_pabrik    AS "Kode Pabrik",
        kode_brand     AS "Kode Brand",
        jenis_etiket   AS "Jenis Etiket",
        tipe           AS "Tipe",
        nama_produk    AS "Nama Produk",
        stok_pabrik    AS "Stok Pabrik",
        pengiriman     AS "Pengiriman",
        stok_aktual    AS "Stok Aktual",
        wip            AS "WIP",
        bj             AS "BJ",
        kiriman        AS "Kiriman",
        plan_produksi  AS "Plan Produksi",
        keterangan     AS "Keterangan"
      FROM stock_level_rows
      WHERE upload_id = $1
      ORDER BY kode_brand, jenis_etiket, tipe
      
    `, [uploadId]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[stock-level-pabrik/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}