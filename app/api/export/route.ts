import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export const runtime = 'nodejs';

function buildWhere(p: URLSearchParams): { where: string; vals: unknown[] } {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const tahun = p.get('tahun'); if (tahun && tahun !== 'all') { conds.push(`tahun=$${i++}`); vals.push(Number(tahun)); }
  const bulan = p.get('bulan'); if (bulan && bulan !== 'all') { conds.push(`bulan=$${i++}`); vals.push(Number(bulan)); }
  const minggu = p.get('minggu'); if (minggu && minggu !== 'all') { conds.push(`minggu=$${i++}`); vals.push(Number(minggu)); }
  const area = p.get('area'); if (area && area !== 'all') { conds.push(`area=$${i++}`); vals.push(area); }
  const tc = p.get('type_customer'); if (tc && tc !== 'all') { conds.push(`type_customer=$${i++}`); vals.push(tc); }
  const kat = p.get('kategori'); if (kat && kat !== 'all') { conds.push(`kategori=$${i++}`); vals.push(kat); }
  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', vals };
}

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();

    const p = req.nextUrl.searchParams;
    const type = p.get('type') || 'detail';
    const { where, vals } = buildWhere(p);

    let rows: Record<string, unknown>[] = [];

    if (type === 'summary') {
      rows = await query(`
        SELECT
          tahun "Tahun", bulan "Bulan", minggu "Minggu",
          COUNT(*) "Transaksi",
          ROUND(SUM(penjualan_rp)::numeric, 0) "Penjualan (Rp)",
          ROUND(SUM(nilai_so)::numeric, 0) "Sales Order (Rp)",
          ROUND(SUM(ket_sisa_nominal)::numeric, 0) "Outstanding (Rp)"
        FROM sales_transactions ${where}
        GROUP BY tahun, bulan, minggu
        ORDER BY tahun, bulan, minggu
      `, vals);
    } else if (type === 'customer') {
      rows = await query(`
        SELECT
          pelanggan "Pelanggan", type_customer "Tipe Customer",
          COUNT(*) "Transaksi",
          ROUND(SUM(penjualan_rp)::numeric, 0) "Penjualan (Rp)",
          ROUND(SUM(nilai_so)::numeric, 0) "Sales Order (Rp)",
          ROUND(SUM(ket_sisa_nominal)::numeric, 0) "Outstanding (Rp)"
        FROM sales_transactions ${where}
        GROUP BY pelanggan, type_customer
        ORDER BY SUM(penjualan_rp) DESC
      `, vals);
    } else if (type === 'product') {
      rows = await query(`
        SELECT
          produk "Produk", kategori "Kategori",
          SUM(qty_penjualan) "Qty Penjualan",
          ROUND(SUM(penjualan_rp)::numeric, 0) "Penjualan (Rp)",
          ROUND(SUM(nilai_so)::numeric, 0) "Sales Order (Rp)"
        FROM sales_transactions ${where}
        GROUP BY produk, kategori
        ORDER BY SUM(penjualan_rp) DESC
      `, vals);
    } else {
      // detail
      rows = await query(`
        SELECT
          minggu "Minggu", bulan "Bulan", tahun "Tahun", tanggal "Tanggal",
          no_so "No. SO", no_faktur "No. Faktur", no_pengiriman "No. Pengiriman",
          no_invoice "No. Invoice", type_customer "Tipe Customer", pelanggan "Pelanggan",
          jenis_rokok "Jenis Rokok", jenis_kertas "Jenis Kertas", kategori "Kategori",
          produk "Produk", op "OP",
          qty_order "Qty Order", qty_sales_order "Qty SO",
          qty_penjualan "Qty Penjualan", qty_delivered "Qty Delivered",
          satuan "Satuan", harga "Harga",
          penjualan_rp "Penjualan (Rp)", nilai_so "Nilai SO (Rp)",
          ket_sisa_nominal "Outstanding (Rp)", qty_sisa "Qty Sisa",
          ket "Ket", keterangan "Keterangan", area "Area"
        FROM sales_transactions ${where}
        ORDER BY tahun, bulan, minggu, tanggal
        LIMIT 50000
      `, vals);
    }

    // Build Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 14) }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `export_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
