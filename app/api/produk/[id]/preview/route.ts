// app/api/produk/[id]/preview/route.ts
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

    const uploadRows = await query<{ created_at: string }>(
      `SELECT created_at FROM produk_uploads WHERE id = $1`,
      [uploadId]
    );

    if (!uploadRows.length) {
      return NextResponse.json({ success: false, error: 'Upload tidak ditemukan' }, { status: 404 });
    }

    // ============================================================
    // KETERBATASAN: products di-upsert tanpa penanda upload asal.
    // insertProdukWorkbook() jalan SEBELUM baris produk_uploads dibuat,
    // jadi updated_at produk selalu SEDIKIT LEBIH AWAL dari created_at
    // upload -- bukan lebih baru. Query di bawah kasih jendela toleransi
    // 2 menit SEBELUM created_at upload untuk menangkap baris yang
    // ter-upsert oleh proses upload ini.
    //
    // Perbaikan permanen: tambahkan kolom last_upload_id di products,
    // di-set eksplisit di insertProdukWorkbook(). Lihat catatan di chat.
    // ============================================================
    const rows = await query(`
      SELECT
        nama_brand    AS "Nama Brand",
        kode_brand    AS "Kode Brand",
        kategori      AS "Kategori",
        kode_pabrik   AS "Kode Pabrik",
        pabrik        AS "Pabrik",
        jenis         AS "Jenis",
        up            AS "UP",
        kertas        AS "Kertas",
        gsm           AS "GSM",
        qty_pcs       AS "Qty PCS",
        qty_lembar    AS "Qty Lembar",
        qty_rim       AS "Qty Rim",
        qty_ton       AS "Qty Ton"
      FROM products
      WHERE updated_at BETWEEN ($1::timestamptz - INTERVAL '2 minutes') AND $1::timestamptz
      ORDER BY updated_at DESC
      
    `, [uploadRows[0].created_at]);

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    console.error('[produk/[id]/preview]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}