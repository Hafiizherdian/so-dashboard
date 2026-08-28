import type {
  MsmrSheetReport,
  ProductRow,
} from './parseMsmr';

type DbClient = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{
    rows: Array<Record<string, any>>;
    rowCount?: number;
  }>;
};

type ProductMatchStatus =
  | 'matched'
  | 'unmatched'
  | 'ambiguous';

interface ProductMatch {
  productId: number | null;
  kodePabrik: string | null;
  kodeBrand: string | null;
  status: ProductMatchStatus;
}

interface InsertSummary {
  report_id: number;
  sheet_name: string;
  company_name: string | null;
  bulan: string | null;
  rows: number;
  summary_rows: number;
  has_total: boolean;
}

interface InsertResult {
  total_sheets: number;
  total_rows: number;
  sheets: InsertSummary[];
  warnings: string[];
}

function normalizeKodePabrik(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  return normalized || null;
}

/**
 * Normalisasi kode brand: uppercase + hilangkan SEMUA whitespace (bukan
 * cuma trim ujung). Ini penting karena kadang kode brand di Excel ketulis
 * dengan spasi di tengah (mis. "CBON 12K") padahal maksudnya sama dengan
 * "CBON12K" yang ada di tabel products. Dipakai buat kedua sisi comparison
 * (nilai dari file & kolom kode_brand di DB).
 */
function normalizeKodeBrand(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  return normalized || null;
}

/**
 * Cari product yang match berdasarkan kode_pabrik (= nama sheet, mis. "CGC")
 * dan kode_brand (= isi kolom BRAND di baris Excel, mis. "CBON12K").
 *
 * PENTING: matching dilakukan ke kolom `kode_brand`, BUKAN `nama_brand`.
 * `nama_brand` isinya nama deskriptif panjang (mis. "ON BOLD 12 K"),
 * sedangkan yang muncul di kolom BRAND file MSMR adalah kode pendek
 * (mis. "CBON12K") -- keduanya beda kolom, jangan ketuker.
 */
async function resolveProduct(
  kodePabrik: string | null,
  brand: string | null,
  dbClient: DbClient,
): Promise<ProductMatch> {
  if (!kodePabrik || !brand) {
    return {
      productId: null,
      kodePabrik,
      kodeBrand: null,
      status: 'unmatched',
    };
  }

  const result = await dbClient.query(
    `
      SELECT
        id,
        kode_pabrik,
        kode_brand,
        nama_brand,
        jenis
      FROM products
      WHERE UPPER(TRIM(kode_pabrik)) = $1
        AND REPLACE(UPPER(TRIM(kode_brand)), ' ', '') = $2
      ORDER BY id
    `,
    [
      normalizeKodePabrik(kodePabrik),
      normalizeKodeBrand(brand),
    ],
  );

  if (result.rows.length === 0) {
    return {
      productId: null,
      kodePabrik,
      kodeBrand: null,
      status: 'unmatched',
    };
  }

  if (result.rows.length > 1) {
    // Lebih dari 1 product cocok -> kemungkinan besar ada duplikat data
    // di tabel products (kode_pabrik + kode_brand sama persis lebih dari
    // sekali). product_id sengaja TIDAK diisi supaya tidak salah pasang.
    return {
      productId: null,
      kodePabrik,
      kodeBrand: null,
      status: 'ambiguous',
    };
  }

  const product = result.rows[0];

  return {
    productId: Number(product.id),
    kodePabrik: product.kode_pabrik ?? kodePabrik,
    kodeBrand: product.kode_brand ?? null,
    status: 'matched',
  };
}

/**
 * Insert 1 baris Excel (detail / summary / total) sebagai 1 row wide di
 * msmr_rows. Nilai mingguan (estimasi/PO/sales) disimpan apa adanya sebagai
 * JSONB array [{label, value}, ...] -- TIDAK dipecah ke tabel terpisah,
 * supaya struktur tabel di DB tetap 1:1 sama baris di file Excel aslinya
 * dan gampang direkonstruksi balik jadi tampilan tabel di frontend.
 */
async function insertRowData(
  reportId: number,
  report: MsmrSheetReport,
  row: ProductRow,
  rowType: 'detail' | 'summary' | 'total',
  rowOrder: number,
  dbClient: DbClient,
  warnings: string[],
): Promise<number> {
  let productMatch: ProductMatch = {
    productId: null,
    kodePabrik: null,
    kodeBrand: null,
    status: 'unmatched',
  };

  
  // PRODUCT MATCHING HANYA UNTUK DETAIL
  // (kode_pabrik diambil dari nama sheet, mis. sheet "CGC" -> pabrik CGC)

  if (rowType === 'detail') {
    const kodePabrik = normalizeKodePabrik(
      report.sheetName,
    );

    productMatch = await resolveProduct(
      kodePabrik,
      row.brand,
      dbClient,
    );

    if (productMatch.status === 'unmatched') {
      warnings.push(
        `[${report.sheetName}] Brand "${row.brand ?? '-'}" ` +
          `tidak ditemukan di products ` +
          `(kode_pabrik="${kodePabrik ?? '-'}").`,
      );
    }

    if (productMatch.status === 'ambiguous') {
      warnings.push(
        `[${report.sheetName}] Brand "${row.brand ?? '-'}" ` +
          `memiliki lebih dari satu product di products ` +
          `(kode_pabrik="${kodePabrik ?? '-'}"). ` +
          `product_id tidak diisi -- cek duplikat di tabel products.`,
      );
    }
  }

  const rowResult = await dbClient.query(
    `
      INSERT INTO msmr_rows (
        report_id,
        row_order,
        product_id,
        product_match_status,
        row_type,

        area,
        brand,
        kode_pabrik,
        kode_brand,

        estimasi_order_month,
        estimasi_weekly,

        purchase_order_quota,
        purchase_order_weekly,

        sales_weekly,
        sales_actual,
        sales_actual_last_month,

        dev_numeric,
        dev_percent

      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15, $16,
        $17, $18
      )
      RETURNING id
    `,
    [
      reportId,
      rowOrder,

      productMatch.productId,
      productMatch.status,
      rowType,

      row.area ?? null,
      row.brand ?? null,

      rowType === 'detail'
        ? productMatch.kodePabrik
        : null,

      rowType === 'detail'
        ? productMatch.kodeBrand
        : null,

      row.estimasiOrderMonth,
      JSON.stringify(row.estimasiOrderWeekly ?? []),

      row.purchaseOrderQuota,
      JSON.stringify(row.purchaseOrderWeekly ?? []),

      JSON.stringify(row.salesWeekly ?? []),
      row.salesActual,
      row.salesActualLastMonth,

      row.deviation?.numeric ?? null,
      row.deviation?.percent ?? null,

      
    ],
  );

  return Number(rowResult.rows[0].id);
}

export async function insertMsmrWorkbook(
  reports: MsmrSheetReport[],
  uploadId: string | number,
  dbClient: DbClient,
): Promise<InsertResult> {
  let globalTotalDetailRows = 0;

  const warnings: string[] = [];
  const sheetsSummary: InsertSummary[] = [];

  for (const report of reports) {
    let sheetDetailCount = 0;
    let sheetSummaryCount = 0;
    let hasTotal = false;
    let rowOrder = 0;

    
    // INSERT REPORT / SHEET
    // (termasuk label minggu, sekali per sheet -- dipakai bareng oleh
    // semua baris di sheet ini pas direkonstruksi jadi tabel)

    const reportResult = await dbClient.query(
      `
        INSERT INTO msmr_reports (
          upload_id,
          sheet_name,
          company_name,
          bulan,
          brand_filter,
          satuan,
          estimasi_week_labels,
          po_sales_week_labels
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        uploadId,
        report.sheetName,
        report.companyName,
        report.bulan,
        report.brandFilter,
        report.satuan,
        JSON.stringify(report.estimasiWeekLabels ?? []),
        JSON.stringify(report.poSalesWeekLabels ?? []),
      ],
    );

    const reportId = Number(
      reportResult.rows[0].id,
    );

    
    // DETAIL

    for (const row of report.rows) {
      await insertRowData(
        reportId,
        report,
        row,
        'detail',
        rowOrder++,
        dbClient,
        warnings,
      );

      sheetDetailCount++;
      globalTotalDetailRows++;
    }

    
    // SUMMARY
    // for (const row of report.summaryByBrand) {
    //   await insertRowData(
    //     reportId,
    //     report,
    //     row,
    //     'summary',
    //     rowOrder++,
    //     dbClient,
    //     warnings,
    //   );

    //   sheetSummaryCount++;
    // }

    
    // TOTAL
    // if (report.total) {
    //   await insertRowData(
    //     reportId,
    //     report,
    //     report.total,
    //     'total',
    //     rowOrder++,
    //     dbClient,
    //     warnings,
    //   );

    //   hasTotal = true;
    // } else {
    //   warnings.push(
    //     `Sheet "${report.sheetName}" tidak memiliki baris TOTAL.`,
    //   );
    // }

    
    // API SUMMARY

    sheetsSummary.push({
      report_id: reportId,
      sheet_name: report.sheetName,
      company_name: report.companyName,

      bulan: report.bulan
        ? report.bulan.toISOString()
        : null,

      rows: sheetDetailCount,
      summary_rows: sheetSummaryCount,
      has_total: hasTotal,
    });
  }

  return {
    total_sheets: reports.length,

    // Hanya detail rows.
    total_rows: globalTotalDetailRows,

    sheets: sheetsSummary,

    warnings,
  };
}