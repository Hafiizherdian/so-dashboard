// lib/parseStockLevel.ts
//
// Logic parsing Excel Stock Level Pabrik — diekstrak dari
// app/api/stock-level-pabrik/upload/route.ts supaya bisa ditest
// independen (lewat scripts/test-parse-stock-level.ts) tanpa perlu
// jalanin Next.js / DB sama sekali.

import * as XLSX from 'xlsx';

// Whitelist pabrik yang dikenal sistem (dipakai jg di script test
// utk warn kalau ada kode_pabrik yang tidak dikenal / typo baru)

export const KNOWN_PABRIK = new Set([
  'CGC', 'GPP', 'INTRACO', 'R3', 'KTaP', 'KTP', 'PM', 'BBSA',
]);

export interface ParsedStockLevelRow {
  kode_brand:    string;
  kode_pabrik:   string;
  /**  
   * Level 1 — 
   * dari section divider Excel: 'UV' | 'Konven' | '-' 
   * (kalau baris ini ada di dalam section yang tidak menyebut UV/Konven, 
   * mis. section "Dos" yang isinya campuran brand tanpa penanda UV/Konven). 
   */
  jenis_etiket:  string;
  /**  
   * Level 2 — 
   * dari prefix teks deskripsi baris ITU SENDIRI, 
   * NESTED di dalam jenis_etiket: 'Etiket' (label dasar) | 'Inner' | 'Dos' | 'Slop Dos'.
   * Independen dari jenis_etiket 
   * satu brand yang sama bisa punya beberapa baris dengan tipe berbeda (Etiket + Inner, atau Etiket + Dos).
   */
  tipe:          string;
  /** 
   * Nama/deskripsi produk PERSIS seperti tertulis di kolom Etiket Excel, 
   * mis. "Etiket On Teh Jasmine Kretek 12 (New)" atau "Inner On Teh Jasmine 12 (New)". 
   * INI yang dipakai buat display, BUKAN products.nama_brand  
   * karena products.nama_brand cuma 1 nama per kode_brand dan tidak bisa bedain varian Etiket vs Inner vs Dos. 
   */
  nama_produk:   string;
  stok_pabrik:   number;
  pengiriman:    number;
  stok_aktual:   number;
  wip:           number | null;
  bj:            number | null;
  kiriman:       number | null;
  plan_produksi: number | null;
  keterangan:    string | null;
  /** 
   * true kalau kode_brand tidak ada di kolomnya sendiri dan 
   * diisi dari baris sebelumnya (merged cell di Excel, mis. pasangan Etiket + Inner).
   * Dipakai buat eyeball manual 
   * jangan otomatis dianggap 100% benar. 
   */
  brand_inferred: boolean;
}

export interface ParseStockLevelResult {
  rows: ParsedStockLevelRow[];
  matchedColumns: Record<string, boolean>;
  jenisEtiketSummary: Record<string, number>;
  tipeSummary: Record<string, number>;
  error: string | null;
}

function normHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase();
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v).trim();
  if (s === '' || s === '-' || s === '—') return 0;
  const cleaned = s.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  return parseNum(v);
}

/** 
 * Derivasi LEVEL 1 (jenis_etiket)  
 * MURNI dari section aktif (divider terakhir yang ketemu). 
 * TIDAK melihat teks baris sama sekali 
 * section "Dos" sengaja tidak dianggap UV/Konven, 
 * jadi baris di dalamnya (termasuk yang berprefix "Etiket ...") jatuh ke '-'. 
 * Ini berdasar: section "Dos" isinya campuran brand dari berbagai sumber tanpa penanda UV/Konven eksplisit di Excel 
 * lihat komentar di parseStockLevelSheet soal kenapa section ini. 
 */
export function deriveJenisEtiket(currentSection: string): string {
  const sectionLower = currentSection.toLowerCase();
  if (sectionLower.includes('uv')) return 'UV';
  if (sectionLower.includes('konven')) return 'Konven';
  return '-';
}

/** 
 * Derivasi LEVEL 2 (tipe)  
 * MURNI dari prefix teks deskripsi baris itu sendiri, 
 * independen dari section/jenis_etiket. 
 * Nested di dalam jenis_etiket manapun (UV, Konven, atau '-'). 
 */ 
export function deriveTipe(descText: string): string {
  const desc = descText.trim();
  if (/^inner\b/i.test(desc)) return 'Inner';
  if (/^slop\s*dos/i.test(desc)) return 'Slop Dos';
  if (/^dos/i.test(desc)) return 'Dos';
  if (/^etiket/i.test(desc)) return 'Etiket';
  return '-';
}

interface ColMap {
  kode_brand: number; kode_pabrik: number; etiket_desc: number;
  stok_pabrik: number; pengiriman: number; stok_aktual: number;
  wip: number; bj: number; kiriman: number; plan_produksi: number; keterangan: number;
}

function findColumns(headerRow: unknown[]): ColMap {
  const norm = headerRow.map(normHeader);
  const find = (pred: (h: string) => boolean) => norm.findIndex(pred);

  return {
    kode_brand:     find(h => h === 'kode brand'),
    kode_pabrik:    find(h => h === 'kode pabrik'),
    etiket_desc:    find(h => h.startsWith('etiket')),
    stok_pabrik:    find(h => h.startsWith('stok pabrik')),
    pengiriman:     find(h => h.startsWith('pengiriman sss')),
    stok_aktual:    find(h => h.startsWith('stok aktual')),
    wip:            find(h => h.startsWith('wip')),
    bj:             find(h => h.startsWith('bj')),
    kiriman:        find(h => h.startsWith('kiriman')),
    plan_produksi:  find(h => h.startsWith('plan produksi')),
    keterangan:     find(h => h.startsWith('keterangan')),
  };
}

/**  
 * Fungsi PURE inti: 
 * terima raw 2D array (hasil sheet_to_json header:1), return hasil parsing. 
 * Tidak menyentuh file system / network / DB sama sekali 
 */
export function parseStockLevelSheet(raw: unknown[][]): ParseStockLevelResult {
  const empty: ParseStockLevelResult = { rows: [], matchedColumns: {}, jenisEtiketSummary: {}, tipeSummary: {}, error: null };

  if (raw.length < 2) {
    return { ...empty, error: 'Data kosong / tidak ada baris' };
  }

  const headerRow = raw[0];
  const col = findColumns(headerRow);

  if (col.kode_brand === -1 || col.kode_pabrik === -1) {
    return { ...empty, error: 'Kolom "Kode Brand" / "Kode Pabrik" tidak ditemukan di header. Cek nama kolom di file Excel.' };
  }

  const parsed: ParsedStockLevelRow[] = [];

  /**  
   * Section awal diambil dari teks header kolom deskripsi itu sendiri 
   * (mis. "Etiket UV"), karena section pertama tidak punya divider row tersendiri di body
   */
  let currentSection = col.etiket_desc !== -1 ? String(headerRow[col.etiket_desc] ?? '').trim() : '';

  /** 
   * Carry-forward kode_brand + kode_pabrik dari baris data terakhir yang valid 
   * dipakai kalau baris berikutnya kode_brand-nya kosong karena merged cell di Excel 
   * (mis. pasangan "Etiket X" + "Inner X" yang brand-nya cuma diisi di baris pertama). 
   * Hanya dipakai kalau kode_pabrik baris ini SAMA dengan baris sebelumnya, 
   * biar tidak ke-leak lintas pabrik.
   */
  let lastKodeBrand = '';
  let lastKodePabrik = '';

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    const kodePabrik = String(r[col.kode_pabrik] ?? '').trim();
    let kodeBrand    = String(r[col.kode_brand]  ?? '').trim();
    const descRaw    = col.etiket_desc !== -1 ? String(r[col.etiket_desc] ?? '').trim() : '';

    const isEmptyRow = !kodePabrik && !kodeBrand && !descRaw;
    if (isEmptyRow) continue; // baris separator kosong, section tetap dipertahankan

    const isDividerRow = !kodePabrik && !kodeBrand && descRaw !== '';
    if (isDividerRow) {
      currentSection = descRaw; // update section aktif (mis. "Etiket Konven", "Dos")
      continue; // baris ini bukan data produk, jangan diinsert
    }

    let brandInferred = false;
    if (!kodeBrand && kodePabrik && descRaw && kodePabrik === lastKodePabrik && lastKodeBrand) {
      kodeBrand = lastKodeBrand;
      brandInferred = true;
    }

    if (!kodeBrand || !kodePabrik) continue; // baris data tapi salah satu kode kosong, skip

    lastKodeBrand = kodeBrand;
    lastKodePabrik = kodePabrik;

    const jenisEtiket = deriveJenisEtiket(currentSection);
    const tipe = deriveTipe(descRaw);

    parsed.push({
      kode_brand:     kodeBrand,
      kode_pabrik:    kodePabrik,
      jenis_etiket:   jenisEtiket,
      tipe:           tipe,
      nama_produk:    descRaw,
      stok_pabrik:    col.stok_pabrik    !== -1 ? parseNum(r[col.stok_pabrik])         : 0,
      pengiriman:     col.pengiriman     !== -1 ? parseNum(r[col.pengiriman])          : 0,
      stok_aktual:    col.stok_aktual    !== -1 ? parseNum(r[col.stok_aktual])         : 0,
      wip:            col.wip            !== -1 ? parseNumOrNull(r[col.wip])           : null,
      bj:             col.bj             !== -1 ? parseNumOrNull(r[col.bj])            : null,
      kiriman:        col.kiriman        !== -1 ? parseNumOrNull(r[col.kiriman])       : null,
      plan_produksi:  col.plan_produksi  !== -1 ? parseNumOrNull(r[col.plan_produksi]) : null,
      keterangan:     col.keterangan     !== -1 ? (String(r[col.keterangan] ?? '').trim() || null) : null,
      brand_inferred: brandInferred,
    });
  }

  if (parsed.length === 0) {
    return { ...empty, error: 'Tidak ada baris data valid (Kode Brand / Kode Pabrik kosong semua)' };
  }

  const jenisEtiketSummary = parsed.reduce((acc, row) => {
    acc[row.jenis_etiket] = (acc[row.jenis_etiket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tipeSummary = parsed.reduce((acc, row) => {
    acc[row.tipe] = (acc[row.tipe] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const matchedColumns = {
    etiket_desc:    col.etiket_desc    !== -1,
    stok_pabrik:    col.stok_pabrik    !== -1,
    pengiriman:     col.pengiriman     !== -1,
    stok_aktual:    col.stok_aktual    !== -1,
    wip:            col.wip            !== -1,
    bj:             col.bj             !== -1,
    kiriman:        col.kiriman        !== -1,
    plan_produksi:  col.plan_produksi  !== -1,
    keterangan:     col.keterangan     !== -1,
  };

  return { rows: parsed, matchedColumns, jenisEtiketSummary, tipeSummary, error: null };
}

// Wrapper baca dari file di disk (dipakai script test yang jalan
// langsung via `npx tsx`, terpisah dari flow upload FormData di route.ts).
export function parseStockLevelWorkbook(filePath: string): ParseStockLevelResult {
  const wb = XLSX.readFile(filePath);
  const wsName = wb.SheetNames[0];
  if (!wsName) return { rows: [], matchedColumns: {}, jenisEtiketSummary: {}, tipeSummary: {}, error: 'Sheet tidak ditemukan' };
  const ws = wb.Sheets[wsName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return parseStockLevelSheet(raw);
}