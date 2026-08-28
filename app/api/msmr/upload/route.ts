// api/msmr/upload
import { NextRequest, NextResponse } from 'next/server';
import { initDb, pool, query } from '@/lib/db';
import { parseMsmrWorkbookBuffer } from '@/lib/parseMsmr';
import type { MsmrSheetReport } from '@/lib/parseMsmr';
import { insertMsmrWorkbook } from '@/lib/insertMsmr';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';

export const runtime = 'nodejs';

const ACCEPTED_EXTS = /\.xlsx?$/i;
const TOLERANCE = 1;

// Sheet "REKAP" cuma rangkuman ulang semua sheet pabrik dalam 1 file,
// bukan sumber data sendiri. Kalau ikut diproses, datanya akan double
// kalau nanti di-agregasi bareng sheet pabrik aslinya (CGC, KTP, dst).
const REKAP_SHEET_PATTERN = /^REKAP$/i;

function reconciliationWarnings(
  reports: MsmrSheetReport[],
): string[] {
  const warnings: string[] = [];

  for (const report of reports) {
    if (!report.total) {
      warnings.push(
        `[${report.sheetName}] Tidak ditemukan baris TOTAL di sheet ini.`,
      );
      continue;
    }

    // ============================================================
    // SALES ACTUAL
    // Hanya rows/detail yang dijumlah.
    // summaryByBrand jangan ikut dihitung karena hanya rekap.
    // ============================================================
    const sumSales = report.rows.reduce(
      (sum, row) => sum + (row.salesActual ?? 0),
      0,
    );

    const totalSales = report.total.salesActual ?? 0;

    if (Math.abs(sumSales - totalSales) > TOLERANCE) {
      warnings.push(
        `[${report.sheetName}] TOTAL sales actual (${totalSales}) ` +
          `beda dari jumlah baris detail (${sumSales}) ` +
          `kemungkinan ada inkonsistensi di file sumber.`,
      );
    }

    // ============================================================
    // PURCHASE ORDER
    // ============================================================
    const sumPo = report.rows.reduce(
      (sum, row) => sum + (row.purchaseOrderQuota ?? 0),
      0,
    );

    const totalPo = report.total.purchaseOrderQuota ?? 0;

    if (Math.abs(sumPo - totalPo) > TOLERANCE) {
      warnings.push(
        `[${report.sheetName}] TOTAL purchase order (${totalPo}) ` +
          `beda dari jumlah baris detail (${sumPo}) ` +
          `kemungkinan ada inkonsistensi di file sumber.`,
      );
    }
  }

  return warnings;
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    // ============================================================
    // 1. Ambil file
    // ============================================================
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: 'File tidak ditemukan',
        },
        { status: 400 },
      );
    }

    if (!ACCEPTED_EXTS.test(file.name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'File harus berformat .xls atau .xlsx',
        },
        { status: 400 },
      );
    }

    // ============================================================
    // 2. Baca file
    // ============================================================
    const buffer = Buffer.from(await file.arrayBuffer());

    // ============================================================
    // 3. Parse workbook
    // ============================================================
    let reports: MsmrSheetReport[];

    try {
      reports = parseMsmrWorkbookBuffer(buffer);
    } catch (err) {
      console.error(
        '[api/msmr/upload] parse error:',
        err,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            'Gagal membaca file Excel. Cek kembali format sheet MSMR.',
        },
        { status: 400 },
      );
    }

    // ============================================================
    // 3.5 Skip sheet REKAP -- lihat penjelasan di REKAP_SHEET_PATTERN.
    // Hanya sheet per-pabrik yang diproses sebagai sumber data.
    // ============================================================
    const skippedSheets = reports
      .filter((r) => REKAP_SHEET_PATTERN.test(r.sheetName.trim()))
      .map((r) => r.sheetName);

    reports = reports.filter(
      (r) => !REKAP_SHEET_PATTERN.test(r.sheetName.trim()),
    );

    if (!reports.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tidak ada sheet yang bisa diparse dari file ini',
        },
        { status: 400 },
      );
    }

    // ============================================================
    // 4. Hitung detail rows
    //
    // total_rows = jumlah detail saja.
    // summary dan total bukan data detail baru.
    // ============================================================
    const totalDetailRows = reports.reduce(
      (sum, report) => sum + report.rows.length,
      0,
    );

    // ============================================================
    // 5. Warning rekonsiliasi
    // ============================================================
    const reconciliation = reconciliationWarnings(reports);

    if (skippedSheets.length) {
      reconciliation.unshift(
        `Sheet berikut dilewati (rekap, bukan sumber data): ${skippedSheets.join(', ')}.`,
      );
    }

    // ============================================================
    // 6. BEGIN transaction
    // ============================================================
    await client.query('BEGIN');
    transactionStarted = true;

    // ============================================================
    // 7. Insert history upload
    // ============================================================
    const uploadRes = await client.query(
      `
        INSERT INTO msmr_uploads (
          file_name,
          status,
          sheet_count,
          total_rows
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        file.name,
        'success',
        reports.length,
        totalDetailRows,
      ],
    );

    const uploadId = uploadRes.rows[0].id;

    // ============================================================
    // 8. Insert semua data MSMR
    // ============================================================
    const insertResult = await insertMsmrWorkbook(
      reports,
      uploadId,
      client,
    );

    // ============================================================
    // 9. Commit
    // ============================================================
    await client.query('COMMIT');
    transactionStarted = false;

    // ============================================================
    // 10. Gabungkan warnings
    // ============================================================
    const warnings = [
      ...reconciliation,
      ...insertResult.warnings,
    ];

    // ============================================================
    // 11. Response
    // ============================================================
    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadId,
        file_name: file.name,
        sheets: insertResult.sheets,
        total_sheets: insertResult.total_sheets,

        // Konsisten dengan msmr_uploads.total_rows
        total_rows: totalDetailRows,

        warnings,

        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error(
          '[api/msmr/upload] rollback error:',
          rollbackErr,
        );
      }
    }

    console.error(
      '[api/msmr/upload] error:',
      err,
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Terjadi kesalahan saat upload',
      },
      { status: 500 },
    );
  } finally {
    client.release();
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
      'SELECT file_name, sheet_count, total_rows, uploaded_by, created_at from msmr_uploads'
    )
    return NextResponse.json({success: true, data: rows})
  } catch (e: any) {
    return
  }
}