import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;

    // Coba sales_transactions dulu
    const penjualan = await query(
      `SELECT week, tanggal, produk_id, qty_po, type_customer, pelanggan,
              nomor_so, jenis, kategori, deskripsi_produk, brand,
              qty_terkirim, satuan, harga, bruto, diskon, pajak, sub_total,
              salesman, kota, kecamatan
       FROM sales_transactions
       WHERE file_id = $1
       ORDER BY tanggal DESC
       LIMIT 100`,
      [fileId]
    );

    if (penjualan.length > 0) {
      return NextResponse.json({ success: true, data: penjualan });
    }

    // Fallback ke so_outstanding
    const so = await query(
      `SELECT week, tanggal, ref_po, nomor_so, pelanggan, produk,
              panjang, lebar, tinggi, berat, harga, uom,
              qty_order, qty_delivered, qty_sisa
       FROM so_outstanding
       WHERE file_id = $1
       ORDER BY tanggal DESC
       LIMIT 100`,
      [fileId]
    );

    if (so.length > 0) {
      return NextResponse.json({ success: true, data: so });
    }

    return NextResponse.json({ success: false, error: 'Tidak ada data untuk file ini' });
  } catch (err: any) {
    console.error('[api/files/[id]/preview] error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Gagal memuat preview' }, { status: 500 });
  }
}