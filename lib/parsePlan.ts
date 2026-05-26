import * as XLSX from 'xlsx';

export interface PlanShiftEntry {
  tanggal: string;   // 'YYYY-MM-DD'
  shift: 1 | 2;
  qty: number;
}

export interface PlanJobRow {
  no_urut: number;
  nomor_jop: string;
  nama_produk: string;
  ukuran_kertas: string;
  up: number;
  qty_jop: number;
  qty_cetak: number;
  shifts: PlanShiftEntry[];
}

export interface PlanParseResult {
  nama_mesin: string;
  minggu_awal: string | null;
  minggu_akhir: string | null;
  jobs: PlanJobRow[];
}

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

function parseDate(v: unknown): string | null {
  if (!v) return null;
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
  const dmy = s.match(/^(\d{1,2})[-/\s](Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)[-/\s](\d{2,4})$/i);
  if (dmy) {
    const months: Record<string, number> = {
      jan:1,feb:2,mar:3,apr:4,may:5,mei:5,jun:6,
      jul:7,aug:8,agu:8,sep:9,oct:10,okt:10,nov:11,dec:12,des:12,
    };
    const day   = parseInt(dmy[1]);
    const month = months[dmy[2].toLowerCase()] ?? 0;
    let   year  = parseInt(dmy[3]);
    if (year < 100) year += 2000;
    if (month && day && year) {
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
  return null;
}

export function parsePlanExcel(buffer: Buffer): PlanParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 1. Nama mesin
  let namaMesin = 'MESIN';
  for (let r = 0; r < Math.min(3, aoa.length); r++) {
    const cell = toStr(aoa[r]?.[0]);
    if (cell.toUpperCase().includes('MESIN')) {
      namaMesin = cell.toUpperCase().trim();
      break;
    }
  }

  // 2. Temukan baris header tanggal
  let dateHeaderRow = -1;
  let shiftHeaderRow = -1;

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
      dateHeaderRow  = r;
      shiftHeaderRow = r + 1;
      break;
    }
  }

  // 3. Build shiftMap dari merged cells
  const shiftMap: { colIdx: number; tanggal: string; shift: 1 | 2 }[] = [];
  if (dateHeaderRow >= 0) {
    const range  = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
    const merges: XLSX.Range[] = ws['!merges'] ?? [];

    const dateRowValues: Record<number, any> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: dateHeaderRow, c });
      dateRowValues[c] = ws[addr]?.v ?? null;
    }
    merges.forEach(m => {
      if (m.s.r === dateHeaderRow) {
        const val = dateRowValues[m.s.c];
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (!dateRowValues[c]) dateRowValues[c] = val;
        }
      }
    });

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

  // 4. Parse baris data JOP
  const jobs: PlanJobRow[] = [];
  const dataStartRow = shiftHeaderRow >= 0 ? shiftHeaderRow + 1 : dateHeaderRow + 2;

  for (let r = dataStartRow; r < aoa.length; r++) {
    const row  = aoa[r] ?? [];
    const col0 = toStr(row[0]);
    const col1 = toStr(row[1]);
    if (!col0 && !col1) continue;
    const isNum = !isNaN(Number(col0)) && col0 !== '';
    const hasJop = col1.includes('/') && col1.length > 5;
    if (!isNum && !hasJop) continue;
    const produkStr = toStr(row[2]);
    if (produkStr.toUpperCase().includes('TOTAL') || produkStr.toUpperCase().includes('JUMLAH')) continue;

    const shifts: PlanShiftEntry[] = [];
    shiftMap.forEach(({ colIdx, tanggal, shift }) => {
      const qty = toNum(row[colIdx]);
      if (qty > 0) shifts.push({ tanggal, shift, qty });
    });

    jobs.push({
      no_urut:       isNum ? parseInt(col0) : jobs.length + 1,
      nomor_jop:     hasJop ? col1 : toStr(row[1]),
      nama_produk:   toStr(row[2]),
      ukuran_kertas: toStr(row[3]),
      up:            toNum(row[4]) || 1,
      qty_jop:       toNum(row[5]),
      qty_cetak:     toNum(row[6]),
      shifts,
    });
  }

  const allDates  = shiftMap.map(s => s.tanggal).sort();
  const mingguAwal  = allDates[0] ?? null;
  const mingguAkhir = allDates[allDates.length - 1] ?? null;

  return { nama_mesin: namaMesin, minggu_awal: mingguAwal, minggu_akhir: mingguAkhir, jobs };
}