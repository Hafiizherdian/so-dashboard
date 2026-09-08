import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
import { parseWipExcel } from '@/lib/parseWip';

/**
 * Format Excel yang diharapkan
 * lihat lib/parseWip.ts utk detail lengkap logic kolom & derivasi tanggal/status
 * (1 tanggal + 1 status berlaku untuk seluruh sheet "WIP", bukan per baris).
 *
 * NOTE: ganti 'upload_wip' di bawah kalau key menu-nya di project beda
 * (disamakan sama pola hasMenuAccess(payload, 'upload_stock') di
 * stock-level-pabrik/upload/route.ts).
 */

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasMenuAccess(payload, 'upload_wip')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File wajib diupload' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = parseWipExcel(buf);

    if (result.jobs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data WIP yang berhasil di-parse dari file ini. Cek format sheet "WIP"-nya.' },
        { status: 400 }
      );
    }
    if (!result.tanggal) {
      return NextResponse.json(
        { success: false, error: 'Tanggal tidak ditemukan di file. Pastikan ada tanggal di baris atas sheet "WIP".' },
        { status: 400 }
      );
    }

    // Header upload
    const uploadRow = await query<{ id: string }>(
      `INSERT INTO wip_uploads (file_name, tanggal, status_wip, keterangan, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [file.name, result.tanggal, result.status_wip, result.keterangan, payload.userId ?? payload.id ?? null]
    );
    const uploadId = uploadRow[0].id;

    /**
     * Insert baris satu-satu — tidak ada unique constraint di wip_jobs
     * (beda dari stock_level_rows), jadi tiap upload murni tambah batch
     * baru; tidak perlu ON CONFLICT / upsert.
     */
    for (const job of result.jobs) {
      await query(
        `INSERT INTO wip_jobs
           (upload_id, tanggal, deskripsi, nomor_jop, up,
            cetak_lbr, embos_lbr, plong_lbr, pretel_pcs, wip_glue, wip_total, bj_pcs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          uploadId, job.tanggal, job.deskripsi, job.nomor_jop, job.up,
          job.cetak_lbr, job.embos_lbr, job.plong_lbr, job.pretel_pcs, job.wip_glue, job.wip_total, job.bj_pcs,
        ]
      );
    }

    // Total per kolom, buat ditampilkan sebagai ringkasan/cross-check ke baris "Grand Total" di file Excel aslinya.
    const totals = result.jobs.reduce(
      (acc, j) => {
        acc.cetak_lbr += j.cetak_lbr;
        acc.embos_lbr += j.embos_lbr;
        acc.plong_lbr += j.plong_lbr;
        acc.pretel_pcs += j.pretel_pcs;
        acc.wip_glue += j.wip_glue;
        acc.wip_total += j.wip_total;
        acc.bj_pcs += j.bj_pcs;
        return acc;
      },
      { cetak_lbr: 0, embos_lbr: 0, plong_lbr: 0, pretel_pcs: 0, wip_glue: 0, wip_total: 0, bj_pcs: 0 }
    );

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadId,
        tanggal: result.tanggal,
        status_wip: result.status_wip,
        keterangan: result.keterangan,
        row_count: result.jobs.length,
        totals,
      },
    });
  } catch (e: any) {
    console.error('[wip upload POST]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

