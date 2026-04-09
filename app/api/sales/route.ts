import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

/**
 * Helper: tambah kondisi ke WHERE yang sudah ada, atau buat WHERE baru.
 */
function andWhere(existing: string, cond: string): string {
  return existing ? `${existing} AND ${cond}` : `WHERE ${cond}`;
}

/**
 * WHERE untuk sales_transactions
 * Kolom tersedia: tanggal, week, type_customer, kategori, salesman, kota
 */
function buildWhereSales(p: URLSearchParams) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const tahun = p.get('tahun');
  if (tahun && tahun !== 'all') {
    conds.push(`EXTRACT(YEAR FROM tanggal)=$${i++}`);
    vals.push(Number(tahun));
  }

  const bulan = p.get('bulan');
  if (bulan && bulan !== 'all') {
    conds.push(`EXTRACT(MONTH FROM tanggal)=$${i++}`);
    vals.push(Number(bulan));
  }

  const minggu = p.get('minggu');
  if (minggu && minggu !== 'all') {
    conds.push(`week=$${i++}`);
    vals.push(Number(minggu));
  }

  const typeCustomer = p.get('type_customer');
  if (typeCustomer && typeCustomer !== 'all') {
    conds.push(`type_customer=$${i++}`);
    vals.push(typeCustomer);
  }

  const kategori = p.get('kategori');
  if (kategori && kategori !== 'all') {
    conds.push(`kategori=$${i++}`);
    vals.push(kategori);
  }

  const salesman = p.get('salesman');
  if (salesman && salesman !== 'all') {
    conds.push(`salesman=$${i++}`);
    vals.push(salesman);
  }

  const kota = p.get('kota');
  if (kota && kota !== 'all') {
    conds.push(`kota=$${i++}`);
    vals.push(kota);
  }

  return {
    where: conds.length ? 'WHERE ' + conds.join(' AND ') : '',
    vals,
  };
}

/**
 * WHERE untuk so_outstanding
 * Kolom tersedia HANYA: tanggal, week
 */
function buildWhereSO(p: URLSearchParams) {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  const tahun = p.get('tahun');
  if (tahun && tahun !== 'all') {
    conds.push(`EXTRACT(YEAR FROM tanggal)=$${i++}`);
    vals.push(Number(tahun));
  }

  const bulan = p.get('bulan');
  if (bulan && bulan !== 'all') {
    conds.push(`EXTRACT(MONTH FROM tanggal)=$${i++}`);
    vals.push(Number(bulan));
  }

  const minggu = p.get('minggu');
  if (minggu && minggu !== 'all') {
    conds.push(`week=$${i++}`);
    vals.push(Number(minggu));
  }

  return {
    where: conds.length ? 'WHERE ' + conds.join(' AND ') : '',
    vals,
  };
}

/**
 * WHERE multi-tahun untuk chart: tahun terpilih + 2 tahun sebelumnya.
 * Filter lain (bulan, minggu, dll) diabaikan agar chart selalu full 12 bulan per tahun.
 */
function buildWhereMultiYear(p: URLSearchParams, table: 'sales' | 'so') {
  const tahun = p.get('tahun');

  if (!tahun || tahun === 'all') {
    // Tidak ada filter tahun → ambil 3 tahun terakhir dari data
    if (table === 'sales') {
      return {
        where: '',
        vals: [] as unknown[],
        yearFilter: `EXTRACT(YEAR FROM tanggal) >= (SELECT MAX(EXTRACT(YEAR FROM tanggal)) - 2 FROM sales_transactions WHERE tanggal IS NOT NULL)`,
      };
    } else {
      return {
        where: '',
        vals: [] as unknown[],
        yearFilter: `EXTRACT(YEAR FROM tanggal) >= (SELECT MAX(EXTRACT(YEAR FROM tanggal)) - 2 FROM so_outstanding WHERE tanggal IS NOT NULL)`,
      };
    }
  }

  const selectedYear = Number(tahun);
  // Ambil tahun terpilih dan 2 tahun sebelumnya
  const years = [selectedYear - 2, selectedYear - 1, selectedYear];

  // Filter tambahan dari sales (type_customer, kategori, dll) — hanya untuk sales
  const extraConds: string[] = [];
  const extraVals: unknown[] = [];
  let i = years.length + 1; // placeholder index setelah year params

  if (table === 'sales') {
    const typeCustomer = p.get('type_customer');
    if (typeCustomer && typeCustomer !== 'all') {
      extraConds.push(`type_customer=$${i++}`);
      extraVals.push(typeCustomer);
    }
    const kategori = p.get('kategori');
    if (kategori && kategori !== 'all') {
      extraConds.push(`kategori=$${i++}`);
      extraVals.push(kategori);
    }
    const salesman = p.get('salesman');
    if (salesman && salesman !== 'all') {
      extraConds.push(`salesman=$${i++}`);
      extraVals.push(salesman);
    }
    const kota = p.get('kota');
    if (kota && kota !== 'all') {
      extraConds.push(`kota=$${i++}`);
      extraVals.push(kota);
    }
  }

  const yearPlaceholders = years.map((_, idx) => `$${idx + 1}`).join(',');
  const yearCond = `EXTRACT(YEAR FROM tanggal) IN (${yearPlaceholders})`;
  const allConds = extraConds.length
    ? `WHERE ${yearCond} AND ${extraConds.join(' AND ')}`
    : `WHERE ${yearCond}`;

  return {
    where: allConds,
    vals: [...years, ...extraVals] as unknown[],
    yearFilter: yearCond,
  };
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

      query<{ total_order_so: string; total_sisa: string }>(`
        SELECT
          COALESCE(SUM(qty_order),0) AS total_order_so,
          COALESCE(SUM(qty_sisa),0)  AS total_sisa
        FROM so_outstanding ${wSO}
      `, vSO),
    ]);

    const qtyOrder    = Number(soSummary[0].total_order_so);
    const qtySisa     = Number(soSummary[0].total_sisa);
    const qtyTerkirim = Number(salesSummary[0].total_terkirim);
    const pctSisa     = qtyOrder > 0 ? (qtySisa / qtyOrder) * 100 : 0;

    // ── 2. MONTHLY MULTI-YEAR (untuk chart tren 3 tahun) ─────────────────────
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

      query<{ tahun: string; bln: string; order_qty: string; sisa_qty: string }>(`
        SELECT
          EXTRACT(YEAR FROM tanggal)::INTEGER  AS tahun,
          EXTRACT(MONTH FROM tanggal)::INTEGER AS bln,
          SUM(qty_order) AS order_qty,
          SUM(qty_sisa)  AS sisa_qty
        FROM so_outstanding ${wMySO}
        GROUP BY tahun, bln
        ORDER BY tahun, bln
      `, vMySO),
    ]);

    // Kumpulkan semua tahun yang ada di data
    const allYears = Array.from(new Set([
      ...monthlySales.map(r => Number(r.tahun)),
      ...monthlySO.map(r => Number(r.tahun)),
    ])).sort();

    // Index data per tahun+bulan
    type SalesRow = typeof monthlySales[0];
    type SORow    = typeof monthlySO[0];
    const salesIdx: Record<string, SalesRow> = {};
    const soIdx:    Record<string, SORow>    = {};
    monthlySales.forEach(r => { salesIdx[`${r.tahun}-${r.bln}`] = r; });
    monthlySO.forEach(r    => { soIdx[`${r.tahun}-${r.bln}`]    = r; });

    // Build array: satu entry per bulan per tahun, label = "Jan 2024"
    const monthly = allYears.flatMap(tahun =>
      Array.from({ length: 12 }, (_, idx) => {
        const m   = idx + 1;
        const key = `${tahun}-${m}`;
        const st  = salesIdx[key];
        const so  = soIdx[key];
        return {
          tahun,
          bulan:       m,
          label:       `${MONTH_LABELS[m]} ${tahun}`,
          labelShort:  MONTH_LABELS[m],
          penjualan:   Number(st?.penjualan    ?? 0),
          so:          Number(so?.order_qty    ?? 0),
          outstanding: Number(so?.sisa_qty     ?? 0),
          terkirim:    Number(st?.terkirim_qty ?? 0),
        };
      })
    );

    // ── 3. WEEKLY (Sales Only) ────────────────────────────────────────────────
    const weeklyRows = await query<{ week: string; penjualan: string }>(`
      SELECT week, COALESCE(SUM(sub_total),0) AS penjualan
      FROM sales_transactions ${wSales}
      GROUP BY week ORDER BY week
    `, vSales);

    // ── 4. CATEGORIES (Sales Only) ────────────────────────────────────────────
    const catRows = await query<{ kategori: string; penjualan: string }>(`
      SELECT kategori, COALESCE(SUM(sub_total),0) AS penjualan
      FROM sales_transactions ${wSales}
      GROUP BY kategori ORDER BY penjualan DESC LIMIT 10
    `, vSales);

    // ── 5. TOP CUSTOMERS (Sales Only) ─────────────────────────────────────────
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

    // ── 6. TOP OUTSTANDING SO ─────────────────────────────────────────────────
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

    // ── 7. TYPE CUSTOMER BREAKDOWN ────────────────────────────────────────────
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

    // ── 8. PRODUK OUTSTANDING ─────────────────────────────────────────────────
    const ketRows = await query<{ label: string; qty: string; count: string }>(`
      SELECT produk        AS label,
             SUM(qty_sisa) AS qty,
             COUNT(*)      AS count
      FROM so_outstanding
      ${andWhere(wSO, 'qty_sisa > 0')}
      GROUP BY produk
      ORDER BY qty DESC LIMIT 10
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
          transaksi:         Number(salesSummary[0].transaksi),
          qty_so:            qtyOrder,
          qty_penjualan:     qtyTerkirim,
          pct_outstanding:   pctSisa,
        },
        monthly,          // array multi-tahun, label = "Jan 2024"
        allYears,         // [2023, 2024, 2025] — untuk legend chart
        weekly: weeklyRows.map(r => ({
          minggu:    r.week,
          penjualan: Number(r.penjualan),
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