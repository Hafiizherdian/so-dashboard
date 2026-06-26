import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

function andWhere(existing: string, cond: string): string {
  return existing ? `${existing} AND ${cond}` : `WHERE ${cond}`;
}

// WHERE untuk sales_transactions
// Kolom: tanggal, week, type_customer, kategori, jenis, salesman, kota
function buildWhereSales(p: URLSearchParams) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const tahun = p.get('tahun');
  if (tahun && tahun !== 'all') { conds.push(`EXTRACT(YEAR FROM tanggal)=$${i++}`); vals.push(Number(tahun)); }

  const bulan = p.get('bulan');
  if (bulan && bulan !== 'all') { conds.push(`EXTRACT(MONTH FROM tanggal)=$${i++}`); vals.push(Number(bulan)); }

  const minggu = p.get('minggu');
  if (minggu && minggu !== 'all') { conds.push(`week=$${i++}`); vals.push(Number(minggu)); }

  const typeCustomer = p.get('type_customer');
  if (typeCustomer && typeCustomer !== 'all') { conds.push(`type_customer=$${i++}`); vals.push(typeCustomer); }

  const kategori = p.get('kategori');
  if (kategori && kategori !== 'all') { conds.push(`kategori=$${i++}`); vals.push(kategori); }

  const jenis = p.get('jenis');
  if (jenis && jenis !== 'all') { conds.push(`jenis=$${i++}`); vals.push(jenis); }

  const salesman = p.get('salesman');
  if (salesman && salesman !== 'all') { conds.push(`salesman=$${i++}`); vals.push(salesman); }

  const kota = p.get('kota');
  if (kota && kota !== 'all') { conds.push(`kota=$${i++}`); vals.push(kota); }

  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', vals };
}

// WHERE untuk so_outstanding
// Kolom tersedia: tanggal, week, pelanggan, produk
// type_customer, kategori, & jenis TIDAK ada di so_outstanding → filter via nomor_so JOIN ke sales_transactions
function buildWhereSO(p: URLSearchParams) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const tahun = p.get('tahun');
  if (tahun && tahun !== 'all') { conds.push(`EXTRACT(YEAR FROM tanggal)=$${i++}`); vals.push(Number(tahun)); }

  const bulan = p.get('bulan');
  if (bulan && bulan !== 'all') { conds.push(`EXTRACT(MONTH FROM tanggal)=$${i++}`); vals.push(Number(bulan)); }

  const minggu = p.get('minggu');
  if (minggu && minggu !== 'all') { conds.push(`week=$${i++}`); vals.push(Number(minggu)); }

  // Filter type_customer, kategori, & jenis via subquery ke sales_transactions
  const typeCustomer = p.get('type_customer');
  if (typeCustomer && typeCustomer !== 'all') {
    conds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE type_customer=$${i++} AND nomor_so IS NOT NULL AND nomor_so != '')`);
    vals.push(typeCustomer);
  }

  const kategori = p.get('kategori');
  if (kategori && kategori !== 'all') {
    conds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE kategori=$${i++} AND nomor_so IS NOT NULL AND nomor_so != '')`);
    vals.push(kategori);
  }

  const jenis = p.get('jenis');
  if (jenis && jenis !== 'all') {
    conds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE jenis=$${i++} AND nomor_so IS NOT NULL AND nomor_so != '')`);
    vals.push(jenis);
  }

  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', vals };
}

// WHERE multi-tahun untuk chart (tahun terpilih + 2 tahun sebelumnya)
function buildWhereMultiYear(p: URLSearchParams, table: 'sales' | 'so') {
  const tahun = p.get('tahun');

  const extraSalesConds: string[] = [];
  const extraSalesVals: unknown[] = [];

  if (table === 'sales') {
    const typeCustomer = p.get('type_customer');
    if (typeCustomer && typeCustomer !== 'all') { extraSalesConds.push(`type_customer=$EXTRA${extraSalesVals.length}`); extraSalesVals.push(typeCustomer); }
    const kategori = p.get('kategori');
    if (kategori && kategori !== 'all') { extraSalesConds.push(`kategori=$EXTRA${extraSalesVals.length}`); extraSalesVals.push(kategori); }
    const jenis = p.get('jenis');
    if (jenis && jenis !== 'all') { extraSalesConds.push(`jenis=$EXTRA${extraSalesVals.length}`); extraSalesVals.push(jenis); }
    const salesman = p.get('salesman');
    if (salesman && salesman !== 'all') { extraSalesConds.push(`salesman=$EXTRA${extraSalesVals.length}`); extraSalesVals.push(salesman); }
    const kota = p.get('kota');
    if (kota && kota !== 'all') { extraSalesConds.push(`kota=$EXTRA${extraSalesVals.length}`); extraSalesVals.push(kota); }
  }

  // SO extra filter via subquery
  const extraSOConds: string[] = [];
  const extraSOVals: unknown[] = [];

  if (table === 'so') {
    const typeCustomer = p.get('type_customer');
    if (typeCustomer && typeCustomer !== 'all') { extraSOConds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE type_customer=$EXTRA${extraSOVals.length} AND nomor_so IS NOT NULL AND nomor_so != '')`); extraSOVals.push(typeCustomer); }
    const kategori = p.get('kategori');
    if (kategori && kategori !== 'all') { extraSOConds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE kategori=$EXTRA${extraSOVals.length} AND nomor_so IS NOT NULL AND nomor_so != '')`); extraSOVals.push(kategori); }
    const jenis = p.get('jenis');
    if (jenis && jenis !== 'all') { extraSOConds.push(`nomor_so IN (SELECT DISTINCT nomor_so FROM sales_transactions WHERE jenis=$EXTRA${extraSOVals.length} AND nomor_so IS NOT NULL AND nomor_so != '')`); extraSOVals.push(jenis); }
  }

  const extraConds = table === 'sales' ? extraSalesConds : extraSOConds;
  const extraVals  = table === 'sales' ? extraSalesVals  : extraSOVals;

  if (!tahun || tahun === 'all') {
    const tbl = table === 'sales' ? 'sales_transactions' : 'so_outstanding';
    const yearFilter = `EXTRACT(YEAR FROM tanggal) >= (SELECT MAX(EXTRACT(YEAR FROM tanggal)) - 2 FROM ${tbl} WHERE tanggal IS NOT NULL)`;

    if (extraConds.length === 0) {
      return { where: '', vals: [] as unknown[], yearFilter };
    }

    // Rebuild dengan index mulai 1
    const rebuildConds: string[] = [];
    const rebuildVals: unknown[] = [];
    let idx = 1;
    extraConds.forEach((c, i) => {
      const rebuilt = c.replace(`$EXTRA${i}`, `$${idx++}`);
      rebuildConds.push(rebuilt);
      rebuildVals.push(extraVals[i]);
    });

    return {
      where: `WHERE ${yearFilter} AND ${rebuildConds.join(' AND ')}`,
      vals: rebuildVals,
      yearFilter,
    };
  }

  const selectedYear = Number(tahun);
  const years = [selectedYear - 2, selectedYear - 1, selectedYear];
  const yearPlaceholders = years.map((_, idx) => `$${idx + 1}`).join(',');
  const yearCond = `EXTRACT(YEAR FROM tanggal) IN (${yearPlaceholders})`;

  // Rebuild extra conds dengan index setelah year params
  const rebuildConds: string[] = [];
  const rebuildVals: unknown[] = [...years];
  let idx = years.length + 1;
  extraConds.forEach((c, i) => {
    const rebuilt = c.replace(`$EXTRA${i}`, `$${idx++}`);
    rebuildConds.push(rebuilt);
    rebuildVals.push(extraVals[i]);
  });

  const allConds = rebuildConds.length
    ? `WHERE ${yearCond} AND ${rebuildConds.join(' AND ')}`
    : `WHERE ${yearCond}`;

  return { where: allConds, vals: rebuildVals, yearFilter: yearCond };
}

const MONTH_LABELS = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await initDb();
    const p = req.nextUrl.searchParams;

    const { where: wSales, vals: vSales } = buildWhereSales(p);
    const { where: wSO,    vals: vSO    } = buildWhereSO(p);

    // ── 1. SUMMARY ────────────────────────────────────────────────────────────
    const [salesSummary, soSummary] = await Promise.all([
      query<{ total_penjualan: string; total_terkirim: string; transaksi: string }>(`
        SELECT
          COALESCE(SUM(sub_total),0)    AS total_penjualan,
          COALESCE(SUM(qty_terkirim),0) AS total_terkirim,
          COUNT(*)                      AS transaksi
        FROM sales_transactions ${wSales}
      `, vSales),

      query<{ total_order_so: string; total_delivered: string; total_sisa: string }>(`
        SELECT
          COALESCE(SUM(qty_order),0)     AS total_order_so,
          COALESCE(SUM(qty_delivered),0) AS total_delivered,
          COALESCE(SUM(qty_sisa),0)      AS total_sisa
        FROM so_outstanding ${wSO}
      `, vSO),
    ]);

    const qtyOrder     = Number(soSummary[0].total_order_so);
    const qtyDelivered = Number(soSummary[0].total_delivered);
    const qtySisa      = Number(soSummary[0].total_sisa);
    const qtyTerkirim  = Number(salesSummary[0].total_terkirim);
    const pctSisa      = qtyOrder > 0 ? (qtySisa / qtyOrder) * 100 : 0;

    // ── 2. MONTHLY MULTI-YEAR ─────────────────────────────────────────────────
    const { where: wMySales, vals: vMySales } = buildWhereMultiYear(p, 'sales');
    const { where: wMySO,    vals: vMySO    } = buildWhereMultiYear(p, 'so');

    const [monthlySales, monthlySO] = await Promise.all([
      query<{ tahun: string; bln: string; penjualan: string; terkirim_qty: string }>(`
        SELECT
          EXTRACT(YEAR FROM tanggal)::INTEGER  AS tahun,
          EXTRACT(MONTH FROM tanggal)::INTEGER AS bln,
          SUM(sub_total)                       AS penjualan,
          SUM(qty_terkirim)                    AS terkirim_qty
        FROM sales_transactions ${wMySales}
        GROUP BY tahun, bln
        ORDER BY tahun, bln
      `, vMySales),

      query<{ tahun: string; bln: string; order_qty: string; delivered_qty: string; sisa_qty: string }>(`
        SELECT
          EXTRACT(YEAR FROM tanggal)::INTEGER  AS tahun,
          EXTRACT(MONTH FROM tanggal)::INTEGER AS bln,
          SUM(qty_order)     AS order_qty,
          SUM(qty_delivered) AS delivered_qty,
          SUM(qty_sisa)      AS sisa_qty
        FROM so_outstanding ${wMySO}
        GROUP BY tahun, bln
        ORDER BY tahun, bln
      `, vMySO),
    ]);

    const allYears = Array.from(new Set([
      ...monthlySales.map(r => Number(r.tahun)),
      ...monthlySO.map(r => Number(r.tahun)),
    ])).sort();

    type SalesRow = typeof monthlySales[0];
    type SORow    = typeof monthlySO[0];
    const salesIdx: Record<string, SalesRow> = {};
    const soIdx:    Record<string, SORow>    = {};
    monthlySales.forEach(r => { salesIdx[`${r.tahun}-${r.bln}`] = r; });
    monthlySO.forEach(r    => { soIdx[`${r.tahun}-${r.bln}`]    = r; });

    const monthly = allYears.flatMap(tahun =>
      Array.from({ length: 12 }, (_, idx) => {
        const m   = idx + 1;
        const key = `${tahun}-${m}`;
        const st  = salesIdx[key];
        const so  = soIdx[key];
        return {
          tahun,
          bulan:        m,
          label:        `${MONTH_LABELS[m]} ${tahun}`,
          labelShort:   MONTH_LABELS[m],
          penjualan:    Number(st?.penjualan    ?? 0),
          so:           Number(so?.order_qty    ?? 0),
          outstanding:  Number(so?.sisa_qty     ?? 0),
          delivered:    Number(so?.delivered_qty ?? 0), // qty_delivered dari so_outstanding
          terkirim:     Number(st?.terkirim_qty ?? 0),
        };
      })
    );

    // ── 3. WEEKLY ─────────────────────────────────────────────────────────────
    const weeklyRows = await query<{ week: string; penjualan: string; qty_terkirim: string }>(`
      SELECT week,
             COALESCE(SUM(sub_total),0)    AS penjualan,
             COALESCE(SUM(qty_terkirim),0) AS qty_terkirim
      FROM sales_transactions ${wSales}
      GROUP BY week ORDER BY week
    `, vSales);

    // ── 4. WEEKLY SO (qty_delivered dari so_outstanding) ──────────────────────
    const weeklySORows = await query<{ week: string; qty_order: string; qty_delivered: string; qty_sisa: string }>(`
      SELECT week,
             COALESCE(SUM(qty_order),0)     AS qty_order,
             COALESCE(SUM(qty_delivered),0) AS qty_delivered,
             COALESCE(SUM(qty_sisa),0)      AS qty_sisa
      FROM so_outstanding ${wSO}
      GROUP BY week ORDER BY week
    `, vSO);

    // ── 5. CATEGORIES ─────────────────────────────────────────────────────────
    const catRows = await query<{ kategori: string; penjualan: string }>(`
      SELECT kategori, COALESCE(SUM(sub_total),0) AS penjualan
      FROM sales_transactions ${wSales}
      GROUP BY kategori ORDER BY penjualan DESC LIMIT 10
    `, vSales);

    // ── 6. TOP CUSTOMERS ──────────────────────────────────────────────────────
    const custRows = await query<{
      pelanggan:     string;
      type_customer: string;
      penjualan:     string;
      transaksi:     string;
    }>(`
      SELECT pelanggan, type_customer,
             COALESCE(SUM(sub_total),0) AS penjualan,
             COUNT(*) AS transaksi
      FROM sales_transactions ${wSales}
      GROUP BY pelanggan, type_customer
      ORDER BY penjualan DESC LIMIT 10
    `, vSales);

    // ── 7. TOP OUTSTANDING SO ─────────────────────────────────────────────────
    const soOutstandingRows = await query<{
      nomor_so:  string;
      pelanggan: string;
      sisa:      string;
    }>(`
      SELECT nomor_so, pelanggan, SUM(qty_sisa) AS sisa
      FROM so_outstanding ${wSO}
      GROUP BY nomor_so, pelanggan
      HAVING SUM(qty_sisa) > 0
      ORDER BY sisa DESC LIMIT 5
    `, vSO);

    // ── 8. TYPE CUSTOMER BREAKDOWN ────────────────────────────────────────────
    const typeRows = await query<{
      type_customer: string;
      penjualan:     string;
      transaksi:     string;
    }>(`
      SELECT type_customer,
             COALESCE(SUM(sub_total),0) AS penjualan,
             COUNT(*) AS transaksi
      FROM sales_transactions ${wSales}
      GROUP BY type_customer ORDER BY penjualan DESC
    `, vSales);

    const totalTypePenjualan =
      typeRows.reduce((acc, r) => acc + Number(r.penjualan), 0) || 1;

    // ── 9. PRODUK OUTSTANDING ─────────────────────────────────────────────────
    const ketRows = await query<{ label: string; qty: string; count: string }>(`
      SELECT produk        AS label,
             SUM(qty_sisa) AS qty,
             COUNT(*)      AS count
      FROM so_outstanding
      ${andWhere(wSO, 'qty_sisa > 0')}
      GROUP BY produk
      ORDER BY qty DESC 
    `, vSO);

    // ── RESPONSE ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_penjualan:   Number(salesSummary[0].total_penjualan),
          total_so:          qtyOrder,
          total_outstanding: qtySisa,
          total_terkirim:    qtyTerkirim,
          total_delivered:   qtyDelivered,   // qty_delivered dari so_outstanding
          transaksi:         Number(salesSummary[0].transaksi),
          qty_so:            qtyOrder,
          qty_penjualan:     qtyTerkirim,
          qty_delivered:     qtyDelivered,   // alias untuk kemudahan akses
          pct_outstanding:   pctSisa,
        },
        monthly,
        allYears,
        weekly: weeklyRows.map(r => ({
          minggu:       r.week,
          penjualan:    Number(r.penjualan),
          qty_terkirim: Number(r.qty_terkirim),
        })),
        weeklySO: weeklySORows.map(r => ({
          minggu:        r.week,
          qty_order:     Number(r.qty_order),
          qty_delivered: Number(r.qty_delivered),
          qty_sisa:      Number(r.qty_sisa),
        })),
        categories: catRows.map(r => ({
          kategori:        r.kategori || '(Lainnya)',
          total_penjualan: Number(r.penjualan),
        })),
        topCustomers: custRows.map(r => ({
          pelanggan:       r.pelanggan,
          type_customer:   r.type_customer,
          total_penjualan: Number(r.penjualan),
          transaksi:       Number(r.transaksi),
        })),
        typeCustomerBreakdown: typeRows.map(r => ({
          type_customer: r.type_customer || '(Tanpa Tipe)',
          penjualan:     Number(r.penjualan),
          transaksi:     Number(r.transaksi),
          pct:           (Number(r.penjualan) / totalTypePenjualan) * 100,
        })),
        keteranganBreakdown: ketRows.map(r => ({
          keterangan: r.label || '(kosong)',
          penjualan:  Number(r.qty),
          count:      Number(r.count),
        })),
        topOutstanding: soOutstandingRows.map(r => ({
          nomor_so:  r.nomor_so,
          pelanggan: r.pelanggan,
          qty_sisa:  Number(r.sisa),
        })),
      },
    });

  } catch (e: any) {
    console.error('[sales API Error]:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}