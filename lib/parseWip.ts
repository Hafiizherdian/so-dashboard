import * as XLSX from 'xlsx';

export interface WipShiftEntry {
  tanggal: string;   // 'YYYY-MM-DD'
  shift: 1 | 2;
  qty: number;
}

export interface WipJobRow {
  no_urut: number;
  nomor_jop: string;
  nama_produk: string;
  ukuran_kertas: string;
  up: number;
  qty_jop: number;
  qty_cetak: number;
  shifts: WipShiftEntry[];
}

export interface WipParseResult {
  nama_mesin: string;
  minggu_awal: string | null;
  minggu_akhir: string | null;
  jobs: WipJobRow[];
}

// ── helpers ──────────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v == null || v === '' || v === '-') return '';
  return String(v).trim();
}

/** Parse berbagai format tanggal Excel ke 'YYYY-MM-DD' atau null */
function parseDate(v: unknown): string | null {
  if (!v) return null;

  // 1. Jika tipe datanya adalah format number serial internal Excel
  if (typeof v === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        return `${d.y}-${mm}-${dd}`;
      }
    } catch { /* ignore */ }
  }

  const s = String(v).trim();

  // 2. Format Teks Manual "18-May-26" atau "18-May-2026"
  const dmy = s.match(/^(\d{1,2})[-/\s](Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)[-/\s](\d{2,4})$/i);
  if (dmy) {
    const months: Record<string, number> = {
      jan:1, feb:2, mar:3, apr:4, may:5, mei:5, jun:6,
      jul:7, aug:8, agu:8, sep:9, oct:10, okt:10, nov:11, dec:12, des:12,
    };
    const day   = parseInt(dmy[1], 10);
    const month = months[dmy[2].toLowerCase()] ?? 0;
    let   year  = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    if (month && day && year) {
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  }

  // 3. JIKA MASUK FALLBACK (String atau format bawaan Javascript Date biasa)
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    // JANGAN GUNAKAN toISOString() karena akan mengurangi jam berdasarkan timezone
    // Ambil tahun, bulan, tanggal lokalnya secara langsung
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  
  return null;
}

// ── main parser ───────────────────────────────────────────────────────────────
export function parseWipExcel(buffer: Buffer): WipParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Konversi ke array-of-arrays agar bisa navigasi per sel
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // ── 1. Nama mesin — biasanya baris pertama, kolom pertama ────────────────
  let namaMesin = 'MESIN';
  for (let r = 0; r < Math.min(3, aoa.length); r++) {
    const cell = toStr(aoa[r]?.[0]);
    if (cell.toUpperCase().startsWith('MESIN') || cell.toUpperCase().includes('MESIN')) {
      namaMesin = cell.toUpperCase().trim();
      break;
    }
  }

  // ── 2. Temukan baris header tanggal ──────────────────────────────────────
  // Baris yang mengandung kolom tanggal: ada >= 2 sel yang bisa diparse sebagai tanggal
  let dateHeaderRow = -1;
  let shiftHeaderRow = -1;
  const dateColumns: { colIdx: number; tanggal: string }[] = [];

  for (let r = 0; r < Math.min(10, aoa.length); r++) {
    const row = aoa[r] ?? [];
    const parsed: { colIdx: number; tanggal: string }[] = [];

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const d = parseDate(cell);
      if (d) parsed.push({ colIdx: c, tanggal: d });
    }

    if (parsed.length >= 2) {
      dateHeaderRow = r;
      // Expand: each date spans 2 shift columns
      parsed.forEach(p => dateColumns.push(p));
      shiftHeaderRow = r + 1;
      break;
    }
  }

  // ── 3. Tentukan kolom-kolom shift ────────────────────────────────────────
  // Setiap tanggal punya 2 kolom: Shift I (colIdx) dan Shift II (colIdx+1)
  // Tapi Excel bisa pakai merged cells, jadi kita expand secara manual
  const shiftMap: { colIdx: number; tanggal: string; shift: 1 | 2 }[] = [];

  if (dateHeaderRow >= 0) {
    // Scan baris tanggal dan resolve merged cells
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    const merges: XLSX.Range[] = ws['!merges'] ?? [];

    // Build cell-to-value map for the date header row
    const dateRowValues: Record<number, any> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: dateHeaderRow, c });
      dateRowValues[c] = ws[addr]?.v ?? null;
    }

    // Expand merges: propagate the date value to all merged columns
    merges.forEach(m => {
      if (m.s.r === dateHeaderRow) {
        const val = dateRowValues[m.s.c];
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (!dateRowValues[c]) dateRowValues[c] = val;
        }
      }
    });

    // Now build shiftMap: for each column that has a date value,
    // assign shift 1 then shift 2 alternately
    const dateCols: Record<string, number[]> = {};
    Object.entries(dateRowValues).forEach(([cStr, val]) => {
      if (!val) return;
      const d = parseDate(val);
      if (!d) return;
      const c = parseInt(cStr);
      if (!dateCols[d]) dateCols[d] = [];
      dateCols[d].push(c);
    });

    Object.entries(dateCols).forEach(([tanggal, cols]) => {
      cols.sort((a, b) => a - b);
      cols.forEach((c, i) => {
        shiftMap.push({ colIdx: c, tanggal, shift: ((i % 2) + 1) as 1 | 2 });
      });
    });
  }

  // ── 4. Temukan baris data JOP ─────────────────────────────────────────────
  // Baris data: sel pertama adalah angka (nomor urut) ATAU kolom kedua berisi nomor JOP
  const jobs: WipJobRow[] = [];
  const dataStartRow = shiftHeaderRow >= 0 ? shiftHeaderRow + 1 : dateHeaderRow + 2;

  for (let r = dataStartRow; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const col0 = toStr(row[0]);
    const col1 = toStr(row[1]);

    // Skip baris kosong, baris total, atau baris header ulang
    if (!col0 && !col1) continue;
    const isNum = !isNaN(Number(col0)) && col0 !== '';
    const hasJop = col1.includes('/') && col1.length > 5;
    if (!isNum && !hasJop) continue;

    // Deteksi baris total (biasanya kolom 0 kosong dan kolom produk = total/jumlah)
    const produkStr = toStr(row[2]);
    if (produkStr.toUpperCase().includes('TOTAL') || produkStr.toUpperCase().includes('JUMLAH')) continue;

    const shifts: WipShiftEntry[] = [];
    shiftMap.forEach(({ colIdx, tanggal, shift }) => {
      const qty = toNum(row[colIdx]);
      if (qty > 0) shifts.push({ tanggal, shift, qty });
    });

    jobs.push({
      no_urut:      isNum ? parseInt(col0) : jobs.length + 1,
      nomor_jop:    hasJop ? col1 : toStr(row[1]),
      nama_produk:  toStr(row[2]),
      ukuran_kertas: toStr(row[3]),
      up:           toNum(row[4]) || 1,
      qty_jop:      toNum(row[5]),
      qty_cetak:    toNum(row[6]),
      shifts,
    });
  }

  // ── 5. Rentang tanggal ────────────────────────────────────────────────────
  const allDates = shiftMap.map(s => s.tanggal).sort();
  const mingguAwal  = allDates[0] ?? null;
  const mingguAkhir = allDates[allDates.length - 1] ?? null;

  return { nama_mesin: namaMesin, minggu_awal: mingguAwal, minggu_akhir: mingguAkhir, jobs };
}