/**
 * Parser untuk file master produk.
 *
 * Struktur: 1 sheet, baris pertama header, 1 baris = 1 kombinasi
 * (brand, jenis material). Tiap brand biasanya punya 2 baris:
 *   - jenis = "ETIKET" -> spek kertas LABEL rokok
 *   - jenis = "DOS"    -> spek kertas DUS/box rokok
 * (dua material fisik berbeda buat produk yang sama).
 *
 * Field-field berikut cuma keisi di baris ETIKET (atribut level-produk,
 * bukan level-material): `kategori`, `batangPerBks`, `bksPerSlop`,
 * `slopPerBal`, `balPerDos`. Di baris DOS untuk brand yang sama, field-field
 * ini kosong di file aslinya (bukan salah parse) — kalau butuh nilainya,
 * ambil dari baris ETIKET brand yang sama.
 *
 * Aturan nilai kosong (sesuai instruksi):
 *   - Sel berisi angka 0    -> tetap disimpan sebagai 0 (artinya: datanya ADA,
 *                              tapi qty-nya nol / belum ada order-nya).
 *   - Sel berisi teks "-"   -> disimpan sebagai `null` (artinya: field ini
 *                              memang tidak punya informasi sama sekali).
 *   - Sel kosong/blank asli -> tetap `null` juga (kolom kategori/batang_per_bks
 *     dst di baris DOS, dan kolom `keterangan` yang di file ini selalu kosong).
 *
 */

import * as XLSX from 'xlsx';

export interface ProductRow {
  namaBrand:    string;
  kodeBrand:    string;
  /** null di baris DOS untuk brand yang sudah punya baris ETIKET */
  kategori:     string | null;
  /** dinormalisasi ke bentuk kanonik kalau dikenali, lihat `warnings` */
  kodePabrik:   string;
  pabrik:       string | null;

  /** null di baris DOS (atribut level-produk, cuma diisi di baris ETIKET) */
  batangPerBks: number | null;
  bksPerSlop:   number | null;
  slopPerBal:   number | null;
  balPerDos:    number | null;

  keterangan:   string | null;

  jenis: 'ETIKET' | 'DOS' | string;

  up:           number | null;
  kertas:       string | null;
  gsm:          number | null;
  l:            number | null;
  p:            number | null;
  kgPerRim:     number | null;
  qtyPcs:       number | null;
  qtyLembar:    number | null;
  qtyRim:       number | null;
  qtyTon:       number | null;
}

export interface ParseProdukResult {
  rows: ProductRow[];
  /** brand yang muncul >1x dengan `jenis` yang sama persis -> kemungkinan typo kode_brand di source */
  duplicateWarnings: string[];
  /** kode_pabrik di file yang tidak match daftar kanonik (dipakai apa adanya, tidak dinormalisasi) */
  unknownPabrikWarnings: string[];
}

const CANONICAL_PABRIK = ['CGC', 'KTP', 'KTaP', 'PM', 'R3', 'GPP', 'INTRACO', 'BBSA'];

function normalizePabrik(raw: string, warnings: string[]): string {
  const trimmed = raw.trim();
  const match = CANONICAL_PABRIK.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
  warnings.push(`kode_pabrik "${raw}" tidak dikenali di daftar kanonik (${CANONICAL_PABRIK.join(', ')}) — dipakai apa adanya`);
  return trimmed;
}

/** Sel "-" -> null. Angka (termasuk 0) -> tetap. Blank/undefined -> null. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '-') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

/** Sel "-" -> null. String lain -> trimmed. Blank -> null. */
function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '' || s === '-') return null;
  return s;
}

function strRequired(v: unknown, fallback = ''): string {
  const s = strOrNull(v);
  return s ?? fallback;
}

export function parseProdukSheet(aoa: unknown[][]): ParseProdukResult {
  const rows: ProductRow[] = [];
  const duplicateWarnings: string[] = [];
  const unknownPabrikWarnings: string[] = [];
  const seenKeys = new Map<string, number>();

  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every((v) => v === null || v === undefined || v === '')) continue;

    const namaBrand = strRequired(row[0]);
    const kodeBrand = strRequired(row[1]);
    if (!namaBrand && !kodeBrand) continue; // baris kosong total, skip

    const kodePabrikRaw = strRequired(row[3]);
    const kodePabrik = kodePabrikRaw ? normalizePabrik(kodePabrikRaw, unknownPabrikWarnings) : kodePabrikRaw;
    const jenis = strRequired(row[10]);

    const key = `${kodePabrik}|${kodeBrand}|${jenis}`;
    const prevRow = seenKeys.get(key);
    if (prevRow !== undefined) {
      duplicateWarnings.push(
        `Baris ${r + 1}: kombinasi (kode_pabrik="${kodePabrik}", kode_brand="${kodeBrand}", jenis="${jenis}") sudah muncul di baris ${prevRow} — kemungkinan kode_brand kepakai dobel buat produk berbeda, cek manual.`,
      );
    }
    seenKeys.set(key, r + 1);

    rows.push({
      namaBrand,
      kodeBrand,
      kategori:     strOrNull(row[2]),
      kodePabrik,
      pabrik:       strOrNull(row[4]),
      batangPerBks: numOrNull(row[5]),
      bksPerSlop:   numOrNull(row[6]),
      slopPerBal:   numOrNull(row[7]),
      balPerDos:    numOrNull(row[8]),
      keterangan:   strOrNull(row[9]),
      jenis: (jenis as 'ETIKET' | 'DOS') || jenis,
      up:           numOrNull(row[11]),
      kertas:       strOrNull(row[12]),
      gsm:          numOrNull(row[13]),
      l:            numOrNull(row[14]),
      p:            numOrNull(row[15]),
      kgPerRim:     numOrNull(row[16]),
      qtyPcs:       numOrNull(row[17]),
      qtyLembar:    numOrNull(row[18]),
      qtyRim:       numOrNull(row[19]),
      qtyTon:       numOrNull(row[20]),
    });
  }

  return { rows, duplicateWarnings, unknownPabrikWarnings };
}

export function parseProdukWorkbook(filePath: string, sheetName?: string): ParseProdukResult {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" tidak ditemukan. Sheet tersedia: ${wb.SheetNames.join(', ')}`);
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  return parseProdukSheet(aoa);
}

export function parseProdukWorkbookBuffer(buffer: Buffer, sheetName?: string): ParseProdukResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" tidak ditemukan. Sheet tersedia: ${wb.SheetNames.join(', ')}`);
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
  return parseProdukSheet(aoa);
}