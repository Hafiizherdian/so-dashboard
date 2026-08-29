// app/api/stock-level-pabrik/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import * as XLSX from 'xlsx';
import { parseStockLevelSheet } from '@/lib/parseStockLevel';

 
/**  
 * Format Excel yang diharapkan 
 * lihat lib/parseStockLevel.ts utk detail lengkap logic kolom & derivasi jenis_etiket 
 * (section divider "Etiket UV"/"Etiket Konven"/"Dos" + fallback prefix teks).
 */
 

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasMenuAccess(payload, 'upload_stock')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const periodeAwal  = formData.get('periode_awal')  as string | null;
    const periodeAkhir = formData.get('periode_akhir') as string | null;

    if (!file) return NextResponse.json({ success: false, error: 'File wajib diupload' }, { status: 400 });
    if (!periodeAwal || !periodeAkhir) {
      return NextResponse.json({ success: false, error: 'periode_awal dan periode_akhir wajib diisi' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const wsName = wb.SheetNames[0];
    if (!wsName) return NextResponse.json({ success: false, error: 'Sheet tidak ditemukan' }, { status: 400 });
    const ws = wb.Sheets[wsName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const { rows: parsed, matchedColumns, jenisEtiketSummary, tipeSummary, error } = parseStockLevelSheet(raw);

    if (error) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    // Header upload
    const uploadRow = await query<{ id: string }>(
      `INSERT INTO stock_level_uploads (file_name, periode_awal, periode_akhir, uploaded_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [file.name, periodeAwal, periodeAkhir, payload.userId ?? payload.id ?? null]
    );
    const uploadId = uploadRow[0].id;


    /** 
     * Insert baris satu-satu supaya gampang di-upsert 
     * kalau kode_brand+jenis_etiket+tipe dobel dalam 1 file 
     * (jaga-jaga typo/duplikat di Excel). 
     * ON CONFLICT sekarang IKUT jenis_etiket + tipe 
     * Lihat migrasi constraint di lib/db.ts. 
     */
    for (const row of parsed) {
      await query(
        `INSERT INTO stock_level_rows
           (upload_id, kode_brand, kode_pabrik, jenis_etiket, tipe, nama_produk,
            stok_pabrik, pengiriman, stok_aktual,
            wip, bj, kiriman, plan_produksi, keterangan)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (upload_id, kode_pabrik, kode_brand, jenis_etiket, tipe) DO UPDATE SET
           nama_produk    = EXCLUDED.nama_produk,
           stok_pabrik    = EXCLUDED.stok_pabrik,
           pengiriman     = EXCLUDED.pengiriman,
           stok_aktual    = EXCLUDED.stok_aktual,
           wip            = EXCLUDED.wip,
           bj             = EXCLUDED.bj,
           kiriman        = EXCLUDED.kiriman,
           plan_produksi  = EXCLUDED.plan_produksi,
           keterangan     = EXCLUDED.keterangan`,
        [
          uploadId, row.kode_brand, row.kode_pabrik, row.jenis_etiket, row.tipe, row.nama_produk,
          row.stok_pabrik, row.pengiriman, row.stok_aktual,
          row.wip, row.bj, row.kiriman, row.plan_produksi, row.keterangan,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadId,
        periode_awal: periodeAwal,
        periode_akhir: periodeAkhir,
        row_count: parsed.length,
        jenis_etiket_summary: jenisEtiketSummary,
        tipe_summary: tipeSummary,
        matched_columns: matchedColumns,
      },
    });
  } catch (e: any) {
    console.error('[stock-level-pabrik upload POST]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


// GET — riwayat upload  

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasMenuAccess(payload, 'upload_stock') && !hasMenuAccess(payload, 'StockLevel')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const rows = await query<{
      id: string; file_name: string; periode_awal: string; periode_akhir: string;
      created_at: string; row_count: string;
    }>(`SELECT u.id, u.file_name, u.periode_awal::TEXT, u.periode_akhir::TEXT, u.created_at,
               COUNT(r.id) AS row_count
        FROM stock_level_uploads u
        LEFT JOIN stock_level_rows r ON r.upload_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 100`);

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({ ...r, row_count: Number(r.row_count) })),
    });
  } catch (e: any) {
    console.error('[stock-level-pabrik upload GET]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


// DELETE — hapus 1 batch upload (?id=...)

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasMenuAccess(payload, 'upload_stock')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });
    await query('DELETE FROM stock_level_uploads WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}