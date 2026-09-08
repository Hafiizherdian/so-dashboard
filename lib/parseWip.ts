import * as XLSX from 'xlsx';

export interface WipJobRow {
  tanggal: string;      // 'YYYY-MM-DD' — satu tanggal berlaku untuk semua baris di sheet WIP
  deskripsi: string;
  nomor_jop: string;
  up: number;
  cetak_lbr: number;
  embos_lbr: number;
  plong_lbr: number;
  pretel_pcs: number;
  wip_glue: number;     // kolom Excel-nya bernama "SORTIR" (PCS), tapi disimpan ke field
                         // wip_glue supaya cocok langsung sama nama kolom di tabel wip_jobs
  wip_total: number;
  bj_pcs: number;        // kolom Excel: "BARANG JADI" (PCS)
}

export interface WipParseResult {
  tanggal: string | null;
  status_wip: string | null;   // contoh: "IN PROGRESS"
  keterangan: string | null;   // contoh: "Proses Lem" (catatan di samping STATUS WIP)
  jobs: WipJobRow[];
}

function toNum(v: unknown): number {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null || v === '' || v === '-') return '';
  // rapikan header/nama produk yang mengandung newline ganda dari merge cell Excel
  return String(v).replace(/\s+/g, ' ').trim();
}

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3,
  apr: 4, april: 4, may: 5, mei: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, aug: 8, agu: 8, agustus: 8,
  sep: 9, september: 9, oct: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, dec: 12, des: 12, desember: 12,
};

function parseDate(v: unknown): string | null {
  if (!v) return null;

  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().split('T')[0];
  }

  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch { /* ignore */ }
  }

  const s = String(v).replace(/\s+/g, ' ').trim();

  // format "05 September 2026" / "5 Sep 2026" (nama bulan Indonesia, panjang atau singkat)
  const dmyName = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (dmyName) {
    const day = parseInt(dmyName[1]);
    const month = MONTHS[dmyName[2].toLowerCase()] ?? 0;
    let year = parseInt(dmyName[3]);
    if (year < 100) year += 2000;
    if (month && day && year) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // format dd/mm/yyyy atau dd-mm-yyyy (dicoba sebelum Date() bawaan JS 
  // karena Date() sering salah tafsir dd/mm sebagai mm/dd ala Amerika)
  const dmyNum = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyNum) {
    const day = parseInt(dmyNum[1]);
    const month = parseInt(dmyNum[2]);
    let year = parseInt(dmyNum[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  return null;
}

// Kata kunci buat mengenali tiap kolom dari baris header lewat "includes"
// (case-insensitive), toleran ke variasi spasi/newline di header Excel asli
// (mis. " CETAK \n \nLBR").
const COLUMN_KEYWORDS: Record<keyof Omit<WipJobRow, 'tanggal'>, string[]> = {
  deskripsi: ['deskripsi'],
  nomor_jop: ['nomor jop', 'no jop', 'no. jop'],
  up: ['up'],
  cetak_lbr: ['cetak'],
  embos_lbr: ['embos'],
  plong_lbr: ['plong'],
  pretel_pcs: ['pretel'],
  wip_glue: ['sortir', 'glue'],
  wip_total: ['wip total'],
  bj_pcs: ['barang jadi', 'bj'],
};

// Urutan pengecekan penting: keyword yang lebih spesifik/panjang dicek duluan
// supaya kolom lain tidak "kecolongan" ke keyword yang lebih umum 
// (mis. 'wip total' harus dicek sebelum kolom manapun yang keywordnya cuma 'wip').
const COLUMN_ORDER: (keyof typeof COLUMN_KEYWORDS)[] = [
  'nomor_jop', 'deskripsi', 'up',
  'cetak_lbr', 'embos_lbr', 'plong_lbr', 'pretel_pcs',
  'wip_total', 'wip_glue', 'bj_pcs',
];

function detectHeaderRow(aoa: any[][]): { rowIdx: number; colMap: Partial<Record<string, number>> } | null {
  for (let r = 0; r < Math.min(15, aoa.length); r++) {
    const row = aoa[r] ?? [];
    const colMap: Partial<Record<string, number>> = {};
    const usedCols = new Set<number>();

    for (const field of COLUMN_ORDER) {
      const keywords = COLUMN_KEYWORDS[field];
      for (let c = 0; c < row.length; c++) {
        if (usedCols.has(c)) continue;
        const cell = toStr(row[c]).toLowerCase();
        if (!cell) continue;
        if (keywords.some((kw) => cell.includes(kw))) {
          colMap[field] = c;
          usedCols.add(c);
          break;
        }
      }
    }

    if (colMap.deskripsi !== undefined && colMap.nomor_jop !== undefined) {
      return { rowIdx: r, colMap };
    }
  }
  return null;
}

// Cari tanggal tunggal di baris-baris atas sheet (di luar area header/data),
// mis. "05 September  2026" di baris ke-3.
function findSheetDate(aoa: any[][], headerRow: number): string | null {
  for (let r = 0; r < Math.min(headerRow, 6); r++) {
    const row = aoa[r] ?? [];
    for (const cell of row) {
      const d = parseDate(cell);
      if (d) return d;
    }
  }
  return null;
}

// Cari baris "STATUS WIP" dan ambil value + catatan di sampingnya.
function findStatusWip(aoa: any[][], headerRow: number): { status: string | null; keterangan: string | null } {
  for (let r = 0; r < Math.min(headerRow, 8); r++) {
    const row = aoa[r] ?? [];
    const labelIdx = row.findIndex((c) => toStr(c).toUpperCase().includes('STATUS WIP'));
    if (labelIdx === -1) continue;

    let status: string | null = null;
    let keterangan: string | null = null;
    for (let c = labelIdx + 1; c < row.length; c++) {
      const val = toStr(row[c]);
      if (!val) continue;
      if (status === null) status = val;
      else if (keterangan === null) { keterangan = val; break; }
    }
    return { status, keterangan };
  }
  return { status: null, keterangan: null };
}

export function parseWipExcel(buffer: Buffer): WipParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Kalau workbook punya beberapa sheet (WIP, PLAKBALL, ANTRIAN JOB, dst),
  // prioritaskan sheet yang namanya persis "WIP"; fallback ke sheet pertama.
  const sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === 'WIP') ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const header = detectHeaderRow(aoa);
  if (!header) {
    return { tanggal: null, status_wip: null, keterangan: null, jobs: [] };
  }

  const { rowIdx: headerRow, colMap } = header;
  const tanggal = findSheetDate(aoa, headerRow);
  const { status: statusWip, keterangan } = findStatusWip(aoa, headerRow);

  const jobs: WipJobRow[] = [];

  for (let r = headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];

    const deskripsi = toStr(colMap.deskripsi !== undefined ? row[colMap.deskripsi] : null);
    const nomorJop = toStr(colMap.nomor_jop !== undefined ? row[colMap.nomor_jop] : null);

    if (!deskripsi && !nomorJop) continue; // baris kosong/pemisah

    const upperDesk = deskripsi.toUpperCase();
    if (upperDesk.includes('GRAND TOTAL') || upperDesk.includes('TOTAL') || upperDesk.includes('JUMLAH')) continue;

    jobs.push({
      tanggal: tanggal ?? '',
      deskripsi,
      nomor_jop: nomorJop,
      up: toNum(colMap.up !== undefined ? row[colMap.up] : null) || 1,
      cetak_lbr: toNum(colMap.cetak_lbr !== undefined ? row[colMap.cetak_lbr] : null),
      embos_lbr: toNum(colMap.embos_lbr !== undefined ? row[colMap.embos_lbr] : null),
      plong_lbr: toNum(colMap.plong_lbr !== undefined ? row[colMap.plong_lbr] : null),
      pretel_pcs: toNum(colMap.pretel_pcs !== undefined ? row[colMap.pretel_pcs] : null),
      wip_glue: toNum(colMap.wip_glue !== undefined ? row[colMap.wip_glue] : null),
      wip_total: toNum(colMap.wip_total !== undefined ? row[colMap.wip_total] : null),
      bj_pcs: toNum(colMap.bj_pcs !== undefined ? row[colMap.bj_pcs] : null),
    });
  }

  return { tanggal, status_wip: statusWip, keterangan, jobs };
}