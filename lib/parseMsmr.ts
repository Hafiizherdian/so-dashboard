/**
 * Parser untuk file "MONTHLY S&D MANAGEMENT REPORT" (msmr) dari CGKN.
 *
 * Format file: .xls lama (BIFF) atau .xlsx, 1 sheet per PT/CV distributor
 * (mis. CGC, KTP, KTaP, PM, R3, GPP, INTRACO, BBSA) + 1 sheet "REKAP"
 * yang merangkum semua PT.
 *
 * Struktur tiap sheet (baris, 0-indexed, sesuai baris asli di Excel):
 *   0        : (kosong)
 *   1        : judul "MONTHLY S&D MANAGEMENT REPORT"
 *   2        : nama perusahaan (mis. "PT CGC")
 *   3        : (kosong)
 *   4        : meta -> "BULAN :" <tanggal>   "BRAND :" <filter>   "SATUAN :" <unit>
 *   5        : header section -> AREA | BRAND | ESTIMASI ORDER | PURCHASE ORDER |
 *                                 SALES PERFORMANCE | DALAM 1 TAHUN <tahun>
 *   6        : sub-header -> MONTH | W.. (weekly) | S ACTUAL/ACTUAL | AKTUAL | ... | QUOTA | AKTUAL | ...
 *   7        : label rentang tanggal per periode mingguan (berubah tiap bulan)
 *   8..N     : baris data per AREA x BRAND (AREA hanya terisi di baris pertama grupnya,
 *              baris berikutnya kosong -> harus di-forward-fill)
 *   N+1      : baris "TOTAL" / "TOTAL :" (posisi label ini kadang di kolom AREA, kadang
 *              di kolom BRAND, tergantung sheet) -> akhir data, setelah ini catatan/footer
 *              (SKM/SKT, "PENYIMPANGAN YANG TERJADI / CATATAN") yang TIDAK ikut di-parse.
 *
 * Kolom (0-indexed), konsisten di semua sheet:
 *   0        : AREA
 *   1        : BRAND
 *   2        : Estimasi Order (total bulan ini)          <- header "MONTH"
 *   3..7     : Estimasi Order per periode mingguan (5 periode)
 *   8        : Purchase Order (quota/total bulan ini)
 *   9..14    : Purchase Order realisasi per periode mingguan (6 periode)
 *   15       : (kolom kosong, jarak antar section)
 *   16..21   : Sales realisasi per periode mingguan (6 periode, sama dengan PO)
 *   22       : Sales Actual (total bulan ini)             <- header "S ACTUAL" / "ACTUAL"
 *   23       : Sales Actual bulan lalu
 *   24       : Penyimpangan (numerik) bulan ini vs bulan lalu
 *   25       : Penyimpangan (%) bulan ini vs bulan lalu
 *   26       : Quota tahunan ("DALAM 1 TAHUN")
 *   27       : Aktual tahunan (year-to-date)
 *   28       : Penyimpangan tahunan (numerik)
 *   29       : Penyimpangan tahunan (%)
 *   30       : Penyimpangan tahunan (% vs bulan lalu)
 *
 * Catatan penting:
 * - Kolom-kolom di atas TIDAK di-hardcode by index; parser mencari posisi section
 *   ("ESTIMASI ORDER", "PURCHASE ORDER", "DALAM 1 TAHUN", dst) lewat teks header,
 *   lalu menghitung offset dari situ. Jadi kalau template Excel-nya sedikit geser
 *   kolom bulan depan, parser ini seharusnya tetap jalan selama urutan section-nya
 *   sama.
 * - Nilai minggu (W14, W31B, dst) berubah tiap bulan -> label diambil dinamis dari
 *   baris tanggal (bukan di-hardcode "W14"..dst).
 * - Arti kolom 26 "DALAM 1 TAHUN" kadang menampilkan angka tahun ganjil (mis. 2005)
 *   di baris label -> kemungkinan sisa template lama, bukan bug parser.
 *
 * Install dulu: npm install xlsx
 */

import * as XLSX from 'xlsx';

export interface WeeklyValue {
  /** label periode, mis. "01 - '04" atau "03 - 08" (diambil langsung dari file, bisa beda tiap bulan) */
  label: string | null;
  value: number | null;
}

export interface ProductRow {
  area: string;
  /** null hanya untuk baris TOTAL */
  brand: string | null;

  estimasiOrderMonth: number | null;
  estimasiOrderWeekly: WeeklyValue[];

  purchaseOrderQuota: number | null;
  purchaseOrderWeekly: WeeklyValue[];

  salesWeekly: WeeklyValue[];
  salesActual: number | null;
  salesActualLastMonth: number | null;

  deviation: {
    numeric: number | null;
    percent: number | null;
  };

  annual: {
    quota: number | null;
    actual: number | null;
    deviationNumeric: number | null;
    deviationPercent: number | null;
    deviationPercentVsLastMonth: number | null;
  };
}

export interface MsmrSheetReport {
  sheetName:   string;
  companyName: string | null;
  bulan:       Date | null;
  brandFilter: string | null;
  satuan:      string | null;

  estimasiWeekLabels: (string | null)[];
  /** label periode PO & Sales sama-sama pakai ini */
  poSalesWeekLabels: (string | null)[];

  /** baris detail per AREA x BRAND */
  rows: ProductRow[];

  /**
   * Sebagian sheet (CGC, KTP, KTaP, PM, GPP, INTRACO) punya section "Summary"
   * di dekat akhir tabel: rekap ulang per-BRAND yang menjumlahkan semua AREA
   * di atasnya. Baris ini SENGAJA dipisah dari `rows` (bukan digabung) karena
   * kalau ikut dijumlah bareng `rows`, hasil aggregate-nya bakal double-count.
   * `area` di tiap baris berikut selalu `null` karena section ini per-brand,
   * bukan per-area.
   */
  summaryByBrand: ProductRow[];

  /** baris TOTAL di akhir tabel (grand total, kalau ada) */
  total: ProductRow | null;
}

function findRowIndex(
  aoa: unknown[][],
  predicate: (row: unknown[]) => boolean,
  fromRow = 0,
): number {
  for (let r = fromRow; r < aoa.length; r++) {
    if (predicate(aoa[r])) return r;
  }
  return -1;
}

function findColIndex(row: unknown[] | undefined, matcher: (upper: string) => boolean): number {
  if (!row) return -1;
  for (let c = 0; c < row.length; c++) {
    const v = row[c];
    if (typeof v === 'string' && matcher(v.trim().toUpperCase())) return c;
  }
  return -1;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function findMetaValue(row: unknown[], labelMatcher: (upper: string) => boolean): unknown {
  const idx = findColIndex(row, labelMatcher);
  if (idx === -1) return null;
  for (let c = idx + 1; c < row.length; c++) {
    if (row[c] !== null && row[c] !== undefined && row[c] !== '') return row[c];
  }
  return null;
}

/** Parse satu sheet (dalam bentuk array-of-arrays) menjadi MsmrSheetReport. */
export function parseMsmrSheet(sheetName: string, aoa: unknown[][]): MsmrSheetReport {
  const companyName = str(aoa[2]?.[0]);

  const metaRowIdx = findRowIndex(
    aoa,
    (row) => findColIndex(row, (v) => v.includes('BULAN')) !== -1,
  );
  const metaRow = aoa[metaRowIdx] ?? [];
  const bulanRaw = findMetaValue(metaRow, (v) => v.includes('BULAN'));
  const bulan = bulanRaw instanceof Date ? bulanRaw : bulanRaw ? new Date(String(bulanRaw)) : null;
  const brandFilter = str(findMetaValue(metaRow, (v) => v.includes('BRAND')));
  const satuan = str(findMetaValue(metaRow, (v) => v.includes('SATUAN')));

  const sectionHeaderRowIdx = findRowIndex(
    aoa,
    (row) => str(row[0])?.toUpperCase() === 'AREA',
    metaRowIdx + 1,
  );
  if (sectionHeaderRowIdx === -1) {
    throw new Error(`[${sheetName}] header "AREA" tidak ditemukan  format sheet tidak dikenali`);
  }
  const subHeaderRowIdx = sectionHeaderRowIdx + 1;
  const weekLabelRowIdx = sectionHeaderRowIdx + 2;
  const dataStartRowIdx = sectionHeaderRowIdx + 3;

  const sectionRow = aoa[sectionHeaderRowIdx];
  const subHeaderRow = aoa[subHeaderRowIdx];
  const weekLabelRow = aoa[weekLabelRowIdx] ?? [];

  const estimasiOrderStart = findColIndex(sectionRow, (v) => v === 'ESTIMASI ORDER');
  const purchaseOrderStart = findColIndex(sectionRow, (v) => v === 'PURCHASE ORDER');
  const annualStart = findColIndex(sectionRow, (v) => v.includes('DALAM 1 TAHUN'));

  if (estimasiOrderStart === -1 || purchaseOrderStart === -1 || annualStart === -1) {
    throw new Error(`[${sheetName}] section header tidak lengkap  cek perubahan format file`);
  }

  // Layout tetap: [PO quota][PO x6 mingguan][1 kolom jarak][Sales x6 mingguan][actual][lastMonth][devNum][devPct]
  const poWeeklyCols = Array.from({ length: 6 }, (_, i) => purchaseOrderStart + i);
  const salesWeeklyStart = purchaseOrderStart + 7; // +6 kolom PO, +1 kolom jarak
  const salesWeeklyCols = Array.from({ length: 6 }, (_, i) => salesWeeklyStart + i);

  const estimasiWeeklyCols: number[] = [];
  for (let c = estimasiOrderStart; c < purchaseOrderStart - 1; c++) estimasiWeeklyCols.push(c);
  const estimasiMonthCol = estimasiOrderStart - 1;
  const poQuotaCol = purchaseOrderStart - 1;

  const salesActualCol = findColIndex(subHeaderRow, (v) => v === 'S ACTUAL' || v === 'ACTUAL');
  if (salesActualCol === -1) {
    throw new Error(`[${sheetName}] kolom "ACTUAL" tidak ditemukan`);
  }
  const salesLastMonthCol = salesActualCol + 1;
  const devNumCol = salesActualCol + 2;
  const devPctCol = salesActualCol + 3;

  const annualQuotaCol = annualStart;
  const annualActualCol = annualStart + 1;
  const annualDevNumCol = annualStart + 2;
  const annualDevPctCol = annualStart + 3;
  const annualDevPctBLCol = annualStart + 4;

  const estimasiWeekLabels = estimasiWeeklyCols.map((c) => str(weekLabelRow[c]));
  const poSalesWeekLabels = poWeeklyCols.map((c) => str(weekLabelRow[c]));

  function buildRow(area: string, brand: string | null, row: unknown[]): ProductRow {
    return {
      area,
      brand,
      estimasiOrderMonth: num(row[estimasiMonthCol]),
      estimasiOrderWeekly: estimasiWeeklyCols.map((c, i) => ({
        label: estimasiWeekLabels[i],
        value: num(row[c]),
      })),
      purchaseOrderQuota: num(row[poQuotaCol]),
      purchaseOrderWeekly: poWeeklyCols.map((c, i) => ({
        label: poSalesWeekLabels[i],
        value: num(row[c]),
      })),
      salesWeekly: salesWeeklyCols.map((c, i) => ({
        label: poSalesWeekLabels[i],
        value: num(row[c]),
      })),
      salesActual: num(row[salesActualCol]),
      salesActualLastMonth: num(row[salesLastMonthCol]),
      deviation: {
        numeric: num(row[devNumCol]),
        percent: num(row[devPctCol]),
      },
      annual: {
        quota: num(row[annualQuotaCol]),
        actual: num(row[annualActualCol]),
        deviationNumeric: num(row[annualDevNumCol]),
        deviationPercent: num(row[annualDevPctCol]),
        deviationPercentVsLastMonth: num(row[annualDevPctBLCol]),
      },
    };
  }

  const rows: ProductRow[] = [];
  const summaryByBrand: ProductRow[] = [];
  let total: ProductRow | null = null;
  let currentArea: string | null = null;

  // Label section rekap: "Summary" (CGC/KTP/KTaP/PM/GPP/INTRACO) atau "TOTAL"/"TOTAL :"
  // yang dipakai baik sebagai section rekap-per-brand (R3) maupun baris grand total
  // itu sendiri (kebanyakan sheet lain) — tergantung sheet-nya, jadi dua-duanya
  // ditangani lewat satu aturan yang sama di bawah.
  const isRecapLabel = (s: string) => /^(SUMMARY|TOTAL\s*:?)$/i.test(s.trim());

  for (let r = dataStartRowIdx; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every((v) => v === null || v === undefined || v === '')) continue;

    const areaCell = str(row[0]);
    const brandCell = str(row[1]);

    // Baris dengan AREA & BRAND dua-duanya kosong (tapi kolom lain kadang berisi 0)
    // adalah jarak/pemisah antar blok di file aslinya. Reset currentArea supaya
    // baris berikutnya yang juga tanpa AREA eksplisit tidak nyangkut ke AREA lama
    // dari sebelum jeda — ini beneran kejadian di sheet BBSA (blok rekap CLARO/
    // JAGOAN Sejati numpang di AREA "YOGYAKARTA" gara-gara jeda ini kalau tidak
    // di-reset, hasilnya ke-double count).
    if (!areaCell && !brandCell) {
      currentArea = null;
      continue;
    }

    if (areaCell) currentArea = areaCell;
    if (!currentArea) continue;

    if (isRecapLabel(currentArea)) {
      // Baris grand total: AREA = "TOTAL" & brand kosong (mis. sheet CGC/BBSA),
      // ATAU brand-nya sendiri juga match "TOTAL"/"TOTAL :" (mis. sheet R3, di mana
      // section rekap-nya sendiri diberi label "TOTAL :" dan baris terakhirnya
      // adalah grand total-nya).
      if (!brandCell || isRecapLabel(brandCell)) {
        total = buildRow('TOTAL', null, row);
        break; // baris setelah ini adalah catatan/footer (SKM/SKT, dll) -> tidak diparse
      }
      // Baris detail per-brand di dalam section rekap ("Summary" atau "TOTAL :").
      // Dipisah dari `rows` supaya tidak double-count kalau nanti di-sum.
      summaryByBrand.push(buildRow(currentArea, brandCell, row));
      continue;
    }

    if (!brandCell) continue;
    rows.push(buildRow(currentArea, brandCell, row));
  }

  return {
    sheetName,
    companyName,
    bulan,
    brandFilter,
    satuan,
    estimasiWeekLabels,
    poSalesWeekLabels,
    rows,
    summaryByBrand,
    total,
  };
}

/** Baca seluruh workbook (.xls / .xlsx) dan parse semua sheet. */
export function parseMsmrWorkbook(filePath: string): MsmrSheetReport[] {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    return parseMsmrSheet(sheetName, aoa);
  });
}

/** Sama seperti parseMsmrWorkbook tapi dari Buffer (mis. hasil upload di API route Next.js). */
export function parseMsmrWorkbookBuffer(buffer: Buffer): MsmrSheetReport[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
    return parseMsmrSheet(sheetName, aoa);
  });
}
