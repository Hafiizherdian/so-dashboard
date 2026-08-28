import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, nama_brand, kode_brand, kategori, kode_pabrik, pabrik,
      batang_per_bks, bks_per_slop, slop_per_bal, bal_per_dos,
      keterangan, jenis, up, kertas, gsm, l, p,
      kg_per_rim, qty_pcs, qty_lembar, qty_rim, qty_ton
    } = body;

    // Validasi ID wajib ada untuk target update
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID produk wajib diisi untuk update' }, { status: 400 });
    }

    // Eksekusi query UPDATE ke tabel products
    await query(
      `UPDATE products 
       SET nama_brand = $1, 
           kode_brand = $2, 
           kategori = $3, 
           kode_pabrik = $4, 
           pabrik = $5,
           batang_per_bks = $6, 
           bks_per_slop = $7, 
           slop_per_bal = $8, 
           bal_per_dos = $9,
           keterangan = $10, 
           jenis = $11, 
           up = $12, 
           kertas = $13, 
           gsm = $14,
           l = $15, 
           p = $16, 
           kg_per_rim = $17, 
           qty_pcs = $18, 
           qty_lembar = $19,
           qty_rim = $20, 
           qty_ton = $21
       WHERE id = $22`,
      [
        nama_brand, kode_brand, kategori, kode_pabrik, pabrik,
        batang_per_bks, bks_per_slop, slop_per_bal, bal_per_dos,
        keterangan, jenis, up, kertas, gsm, l, p,
        kg_per_rim, qty_pcs, qty_lembar, qty_rim, qty_ton,
        id // Parameter ke-22
      ]
    );

    return NextResponse.json({ success: true, message: 'Data produk berhasil diupdate' });
  } catch (err) {
    console.error('[api/produk] PUT error:', err);
    return NextResponse.json({ success: false, error: 'Gagal melakukan update data' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isList = searchParams.get('list') === '1';

  try {
    if (isList) {
      // Riwayat proses upload (dipakai UploadProdukTab, sama pola kayak /api/plan?list=1)
      const rows = await query(
        `SELECT id, file_name, total_rows, inserted_count, updated_count, created_at
         FROM produk_uploads
         ORDER BY created_at DESC
         LIMIT 50`,
      );
      return NextResponse.json({ success: true, data: rows });
    }

    // Default: data produk itu sendiri (buat tab "Data Produk" kalau nanti dibutuhkan)
    const rows = await query(
      `SELECT id, nama_brand, kode_brand, kategori, kode_pabrik, pabrik, jenis,
              batang_per_bks, bks_per_slop, slop_per_bal, bal_per_dos,
              up, kertas, gsm, l, p, kg_per_rim, qty_pcs, qty_lembar, qty_rim, qty_ton
       FROM products
       ORDER BY kode_pabrik, kode_brand, jenis`,
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error('[api/produk] GET error:', err);
    return NextResponse.json({ success: false, error: 'Gagal mengambil data' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });
  }

  try {
    /**
    Produk beda: `products` itu master data yang di-upsert berdasarkan (kode_pabrik, kode_brand, jenis) 
    satu baris produk bisa "ketiban" oleh beberapa kali upload berbeda seiring waktu, 
    jadi gak ada cara aman buat tau baris mana yang harus dikembalikan/dihapus 
    kalau 1 upload tertentu "dibatalkan". Kalau butuh hapus produk, itu harus endpoint terpisah yang hapus 
    by kode_brand/kode_pabrik/jenis langsung (belum dibuat di sini).
     */
    await query(`DELETE FROM produk_uploads WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api/produk] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Gagal menghapus riwayat' }, { status: 500 });
  }
}