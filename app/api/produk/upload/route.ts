import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { initDb, pool, query } from '@/lib/db';
import { parseProdukWorkbookBuffer } from '@/lib/parseProduk';
import { insertProdukWorkbook } from '@/lib/insertProduk';
import { hasAnyMenuAccess } from '@/lib/auth';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
// lalu ganti `uploadedBy = null` di bawah jadi id user yang login.

// xlsx butuh Node APIs (Buffer dkk), jadi route ini harus jalan di Node runtime
export const runtime = 'nodejs';

const ACCEPTED_EXTS = /\.xlsx?$/i;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 });
    }
    if (!ACCEPTED_EXTS.test(file.name)) {
      return NextResponse.json({ success: false, error: 'File harus berformat .xls atau .xlsx' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let parsed;
    try {
      parsed = parseProdukWorkbookBuffer(buffer);
    } catch (err) {
      console.error('[api/produk/upload] parse error:', err);
      return NextResponse.json(
        { success: false, error: 'Gagal membaca file Excel — cek lagi format kolomnya' },
        { status: 400 },
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada baris data yang bisa diparse dari file ini' },
        { status: 400 },
      );
    }

    // const authUser = await getAuthUser(req); // TODO
    const uploadedBy: number | null = null;

    const { inserted, updated } = await insertProdukWorkbook(pool, parsed.rows);

    const uploadId = randomUUID();
    await query(
      `INSERT INTO produk_uploads (id, file_name, total_rows, inserted_count, updated_count, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uploadId, file.name, parsed.rows.length, inserted, updated, uploadedBy],
    );

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadId,
        file_name: file.name,
        total_rows: parsed.rows.length,
        inserted,
        updated,
        duplicate_warnings: parsed.duplicateWarnings,
        unknown_pabrik_warnings: parsed.unknownPabrikWarnings,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[api/produk/upload] error:', err);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan saat upload' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req)
    if (!payload) return NextResponse.json({success: false, error: 'Unauthorized'}, {status: 401})
    if (!hasMenuAccess(payload, 'upload')) {
      return NextResponse.json({ success: false, error: 'Forbidden'}, { status: 403})
    }
    await initDb()
    const rows = await query(
      'SELECT file_name, total_rows, uploaded_by, created_at from produk_uploads'
    )
    return NextResponse.json({success: true, data: rows})
  } catch (e: any) {
    return
  }
}