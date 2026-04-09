import * as XLSX from 'xlsx';

export interface ExcelResult {
  type: 'sales' | 'so_outstanding';
  rows: any[];
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === '-') return 0;
  // Menghapus karakter non-numerik kecuali titik dan minus
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined || v === '-') return '';
  return String(v).trim();
}

function parseDate(v: unknown): string | null {
  if (!v || v === '-') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
}

export function parseExcel(buffer: Buffer): ExcelResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (!raw.length) return { type: 'sales', rows: [] };

  // Ambil semua header dan normalisasi
  const headers = Object.keys(raw[0]).map(h => h.toLowerCase().trim());

  // DETEKSI OTOMATIS: Jika ada kolom 'ref_po', maka ini SO Outstanding
  const isSO = headers.includes('ref_po') || headers.includes('no_so') && headers.includes('qty_order');
  const type = isSO ? 'so_outstanding' : 'sales';

  const rows = raw.map(r => {
    // Mapping manual untuk memastikan nama kolom sesuai DB meskipun di Excel berbeda sedikit
    if (isSO) {
      return {
        week: toNum(r['week'] || r['Week']),
        tanggal: parseDate(r['tanggal'] || r['Tanggal']),
        ref_po: toStr(r['ref_po'] || r['Ref PO']),
        nomor_so: toStr(r['nomor_so'] || r['No SO']),
        pelanggan: toStr(r['pelanggan'] || r['Pelanggan']),
        produk: toStr(r['produk'] || r['Produk']),
        panjang: toNum(r['panjang']),
        lebar: toNum(r['lebar']),
        tinggi: toNum(r['tinggi']),
        berat: toNum(r['berat']),
        harga: toNum(r['harga']),
        uom: toStr(r['uom'] || r['UOM']),
        qty_order: toNum(r['qty_order'] || r['Qty Order']),
        qty_delivered: toNum(r['qty_delivered'] || r['Qty Delivered']),
        qty_sisa: toNum(r['qty_sisa'] || r['Qty Sisa']),
      };
    } else {
      // Mapping untuk Sales Transaction (Data lama kamu)
      return {
        week: toNum(r['week']),
        tanggal: parseDate(r['tanggal']),
        produk_id: toStr(r['produk_id']),
        qty_po: toNum(r['qty_po']),
        nomor_penjualan: toStr(r['nomor_penjualan']),
        type_customer: toStr(r['type_customer']),
        pelanggan: toStr(r['pelanggan']),
        nomor_so: toStr(r['nomor_so']),
        kategori: toStr(r['kategori']),
        deskripsi_produk: toStr(r['deskripsi_produk']),
        brand: toStr(r['brand']),
        qty_terkirim: toNum(r['qty_terkirim']),
        satuan: toStr(r['satuan']),
        harga: toNum(r['harga']),
        bruto: toNum(r['bruto']),
        diskon: toNum(r['diskon']),
        pajak: toNum(r['pajak']),
        sub_total: toNum(r['sub_total']),
        salesman: toStr(r['salesman']),
        kota: toStr(r['kota']),
        kecamatan: toStr(r['kecamatan']),
      };
    }
  });

  return { type, rows };
}