// app/api/stock-level-pabrik/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasMenuAccess } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

interface WeeklyEntry { label: string; value: number | string }

function sumLastNWeeks(weekly: WeeklyEntry[] | null | undefined, n = 4): number {
  if (!Array.isArray(weekly) || weekly.length === 0) return 0;
  const slice = weekly.slice(Math.max(0, weekly.length - n));
  return slice.reduce((s, w) => s + (Number(w?.value) || 0), 0);
}

function normKey(pabrik: string | null | undefined, brand: string | null | undefined): string {
  const norm = (s: string | null | undefined) =>
    (s ?? '').toString().toUpperCase().replace(/\s+/g, '');
  return `${norm(pabrik)}__${norm(brand)}`;
}

function baseBrandCode(kodeBrand: string | null | undefined): string {
  return (kodeBrand ?? '').replace(/\s*\(\d+\)\s*$/, '').trim();
}

function tipeToProductJenis(tipe: string | null): 'ETIKET' | 'DOS' {
  const t = (tipe ?? '').toLowerCase();
  if (t.includes('dos')) return 'DOS';
  return 'ETIKET';
}

const DEBUG_BRAND_FILTER: string | null = 'ON LINE JAHE 16 K';
function debugMatch(brand: string | null | undefined): boolean {
  if (!DEBUG_BRAND_FILTER) return true;
  return (brand ?? '').toUpperCase().includes(DEBUG_BRAND_FILTER.toUpperCase());
}

type ProductRow = {
  kode_pabrik: string; kode_brand: string; jenis: string;
  nama_brand: string; up: number | null;
  bks_per_slop: number | null; slop_per_bal: number | null; bal_per_dos: number | null;
};

/**
 * Cari faktor konversi produk untuk (kode_pabrik, kode_brand, jenis) TERTENTU.
 * Coba match PERSIS dulu, kalau tidak ketemu fallback ke base brand code
 * (varian pertama yang match untuk jenis yang sama).
 */
function getConversion(
  productMap: Map<string, ProductRow>,
  productBaseMap: Map<string, ProductRow>,
  kodePabrik: string,
  kodeBrand: string,
  jenis: 'ETIKET' | 'DOS'
): { bks: number; slop: number; bal: number; matched: ProductRow | null; source: 'EXACT' | 'FALLBACK' | 'NONE' } {
  const exactKey = `${normKey(kodePabrik, kodeBrand)}__${jenis}`;
  const baseKey  = `${normKey(kodePabrik, baseBrandCode(kodeBrand))}__${jenis}`;

  let conv = productMap.get(exactKey) ?? null;
  let source: 'EXACT' | 'FALLBACK' | 'NONE' = conv ? 'EXACT' : 'NONE';
  if (!conv) {
    conv = productBaseMap.get(baseKey) ?? null;
    source = conv ? 'FALLBACK' : 'NONE';
  }

  return {
    bks: Number(conv?.bks_per_slop) || 0,
    slop: Number(conv?.slop_per_bal) || 0,
    bal: Number(conv?.bal_per_dos) || 0,
    matched: conv,
    source,
  };
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (!hasMenuAccess(payload, 'StockLevel')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();

    const p = req.nextUrl.searchParams;
    const search = p.get('search');
    const jenis = p.get('jenis');
    const jenisEtiket = p.get('jenisEtiket');
    const tipe = p.get('tipe');

    const uploadRows = await query<{
      id: string; periode_awal: string; periode_akhir: string;
    }>(`SELECT id, periode_awal::TEXT, periode_akhir::TEXT
        FROM stock_level_uploads
        ORDER BY periode_akhir DESC, created_at DESC
        LIMIT 1`);
    const latestUpload = uploadRows[0] ?? null;

    if (!latestUpload) {
      return NextResponse.json({
        success: true,
        data: { periode_awal: '', periode_akhir: '', rows: [] },
      });
    }

    const slConds: string[] = ['upload_id = $1'];
    const slVals: unknown[] = [latestUpload.id];

    if (jenisEtiket) {
      slVals.push(jenisEtiket);
      slConds.push(`jenis_etiket = $${slVals.length}`);
    }
    if (tipe) {
      slVals.push(tipe);
      slConds.push(`tipe = $${slVals.length}`);
    }
    if (search) {
      slVals.push(`%${search}%`);
      slConds.push(`
        (
          kode_brand ILIKE $${slVals.length}
          OR kode_pabrik ILIKE $${slVals.length}
          OR nama_produk ILIKE $${slVals.length}
        )
      `);
    }

    const uploadRowsData = await query<{
      kode_pabrik: string; kode_brand: string; jenis_etiket: string; tipe: string; nama_produk: string;
      stok_pabrik: string; pengiriman: string; stok_aktual: string;
      wip: string | null; bj: string | null; kiriman: string | null;
      plan_produksi: string | null; keterangan: string | null;
    }>(`SELECT kode_pabrik, kode_brand, jenis_etiket, tipe, nama_produk,
              stok_pabrik, pengiriman, stok_aktual,
              wip, bj, kiriman, plan_produksi, keterangan
        FROM stock_level_rows
        WHERE ${slConds.join(' AND ')}
        ORDER BY kode_brand, jenis_etiket, tipe`, slVals);

    if (uploadRowsData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          periode_awal:  latestUpload.periode_awal,
          periode_akhir: latestUpload.periode_akhir,
          rows: [],
        },
      });
    }

    /**
     * 3. Master produk. productMap: key PERSIS (kode_pabrik+kode_brand+jenis).
     * productBaseMap: key BASE brand code (tanpa suffix pack-size)+jenis —
     * fallback kalau kode_brand di MSMR tidak match persis.
     */

    const productRows = await query<ProductRow>(`
        SELECT kode_pabrik, kode_brand, jenis, nama_brand, up, bks_per_slop, slop_per_bal, bal_per_dos
        FROM products`);

    const productMap = new Map<string, ProductRow>();
    const productBaseMap = new Map<string, ProductRow>();

    productRows.forEach(r => {
      productMap.set(`${normKey(r.kode_pabrik, r.kode_brand)}__${r.jenis}`, r);

      const baseKey = `${normKey(r.kode_pabrik, baseBrandCode(r.kode_brand))}__${r.jenis}`;
      if (!productBaseMap.has(baseKey)) {
        productBaseMap.set(baseKey, r);
      }
    });

    /**
     * 4. Pemakaian per bulan dari MSMR, key = BASE brand code (suffix dibuang).
     * DIPISAH JADI 2 MAP karena tipe pemakaiannya beda:
     *  - msmrMapEtiket : dos * bks_per_slop * slop_per_bal * bal_per_dos
     *                    (dipakai untuk tipe Etiket/Inner)
     *  - msmrMapDos    : dos * slop_per_bal * bal_per_dos
     *                    (TANPA bks_per_slop — dipakai untuk tipe Dos/Slop Dos)
     *
     * PENTING: slop_per_bal & bal_per_dos HANYA diambil dari row jenis='ETIKET'
     * (bukan lookup terpisah ke row jenis='DOS'). Ini karena rasio kemasan
     * slop->bal->dos itu sama untuk brand yang sama, tidak peduli jenisnya
     * ETIKET atau DOS — yang beda cuma bks_per_slop (khusus etiket/bungkus).
     * Row products.jenis='DOS' saat ini banyak yang kolom slop_per_bal /
     * bal_per_dos-nya masih NULL (belum diisi), jadi kalau tetap lookup
     * terpisah ke situ hasilnya selalu 0. Dengan ambil dari row ETIKET,
     * perhitungan DOS tetap benar walau data row DOS belum lengkap.
     */

    const msmrRows = await query<{
      kode_pabrik: string;
      kode_brand: string | null;
      brand: string;
      purchase_order_weekly: WeeklyEntry[];
    }>(`
        WITH latest_per_brand AS (
            SELECT
                UPPER(REGEXP_REPLACE(r.kode_pabrik, '\\s+', '', 'g')) AS nk_pabrik,
                UPPER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(r.kode_brand), ''), r.brand), '\\s+', '', 'g')) AS nk_brand,
                MAX(rep.bulan) AS latest_bulan
            FROM msmr_rows r
            JOIN msmr_reports rep ON rep.id = r.report_id AND rep.deleted_at IS NULL
            WHERE r.row_type = 'detail'
              AND r.kode_pabrik IS NOT NULL AND TRIM(r.kode_pabrik) <> ''
            GROUP BY 1, 2
        )
        SELECT
            r.kode_pabrik,
            r.kode_brand,
            r.brand,
            r.purchase_order_weekly
        FROM msmr_rows r
        JOIN msmr_reports rep
            ON rep.id = r.report_id AND rep.deleted_at IS NULL
        JOIN latest_per_brand lb
            ON lb.nk_pabrik = UPPER(REGEXP_REPLACE(r.kode_pabrik, '\\s+', '', 'g'))
          AND lb.nk_brand  = UPPER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(r.kode_brand), ''), r.brand), '\\s+', '', 'g'))
          AND lb.latest_bulan = rep.bulan
        WHERE r.row_type = 'detail'
          AND r.kode_pabrik IS NOT NULL AND TRIM(r.kode_pabrik) <> ''
    `);

    console.log('[stock-level-pabrik] msmrRows count:', msmrRows.length);

    const msmrMapEtiket = new Map<string, number>();
    const msmrMapDos = new Map<string, number>();

    msmrRows.forEach(r => {
      const brandSource = (r.kode_brand && r.kode_brand.trim()) ? r.kode_brand : r.brand;
      const base = baseBrandCode(brandSource);
      const key = normKey(r.kode_pabrik, base);
      const dos = sumLastNWeeks(r.purchase_order_weekly, 6);

      // Konversi diambil SEKALI dari row jenis='ETIKET'. slop_per_bal &
      // bal_per_dos dari sini dipakai bareng untuk hitungan ETIKET maupun DOS.
      const conv = getConversion(productMap, productBaseMap, r.kode_pabrik, brandSource, 'ETIKET');

      // --- ETIKET/Inner: pakai bks_per_slop juga ---
      const bungkusEtiket = dos * conv.bks * conv.slop * conv.bal;
      msmrMapEtiket.set(key, (msmrMapEtiket.get(key) || 0) + bungkusEtiket);

      // --- DOS/Slop Dos: TANPA bks_per_slop ---
      const bungkusDos = dos * conv.slop * conv.bal;
      msmrMapDos.set(key, (msmrMapDos.get(key) || 0) + bungkusDos);

      if (debugMatch(brandSource)) {
        console.log('[stock-level-pabrik][msmrMap] ---');
        console.log('  kode_pabrik      :', r.kode_pabrik);
        console.log('  kode_brand (raw) :', brandSource);
        console.log('  base_brand_code  :', base, ' key:', key);
        console.log('  dos (sum 6 weeks):', dos);
        console.log('  conv source:', conv.source, 'matched:', conv.matched?.kode_brand ?? '-',
          'bks:', conv.bks, 'slop:', conv.slop, 'bal:', conv.bal);
        console.log('  bungkusEtiket:', bungkusEtiket, ' bungkusDos (tanpa bks):', bungkusDos);
        console.log('  msmrMapEtiket[key] ->', msmrMapEtiket.get(key), ' | msmrMapDos[key] ->', msmrMapDos.get(key));
      }
    });

    console.log('[stock-level-pabrik] msmrMapEtiket FULL (filtered):');
    msmrMapEtiket.forEach((val, key) => { if (debugMatch(key)) console.log(`  ${key} => ${val}`); });
    console.log('[stock-level-pabrik] msmrMapDos FULL (filtered):');
    msmrMapDos.forEach((val, key) => { if (debugMatch(key)) console.log(`  ${key} => ${val}`); });

    /**
     * 5. Gabungkan jadi 1 baris output per baris upload.
     * pemakaian_per_bulan diambil dari map yang sesuai jenis produk
     * (ETIKET/Inner -> msmrMapEtiket, DOS/Slop Dos -> msmrMapDos).
     */

    let rows = uploadRowsData.map(u => {
      const productKey = normKey(u.kode_pabrik, u.kode_brand);
      const msmrKey     = normKey(u.kode_pabrik, baseBrandCode(u.kode_brand));
      const productJenis = tipeToProductJenis(u.tipe);
      const product = productMap.get(`${productKey}__${productJenis}`);

      const pemakaian = productJenis === 'DOS'
        ? (msmrMapDos.get(msmrKey) ?? 0)
        : (msmrMapEtiket.get(msmrKey) ?? 0);

      if (debugMatch(u.kode_brand)) {
        console.log('[stock-level-pabrik][rows.map] ---');
        console.log('  kode_brand (upload):', u.kode_brand, ' tipe:', u.tipe, ' -> productJenis:', productJenis);
        console.log('  msmrKey:', msmrKey, ' pemakaian_per_bulan:', pemakaian,
          `(dari ${productJenis === 'DOS' ? 'msmrMapDos' : 'msmrMapEtiket'})`);
      }

      return {
        id: `${u.kode_pabrik}__${u.kode_brand}__${u.jenis_etiket}__${u.tipe}`,
        jenis: product?.jenis ?? productJenis,
        jenis_etiket: u.jenis_etiket,
        tipe:          u.tipe,
        kode_brand:    u.kode_brand,
        kode_pabrik:   u.kode_pabrik,
        nama_produk:   u.nama_produk || product?.nama_brand || `${u.kode_pabrik} / ${u.kode_brand}`,
        up:            product?.up ?? null,
        stok_pabrik:   Number(u.stok_pabrik) || 0,
        pengiriman:    Number(u.pengiriman) || 0,
        stok_aktual:   Number(u.stok_aktual) || 0,
        pemakaian_per_bulan: pemakaian,
        wip:           u.wip !== null ? Number(u.wip) : null,
        bj:            u.bj !== null ? Number(u.bj) : null,
        kiriman:       u.kiriman !== null ? Number(u.kiriman) : null,
        plan_produksi: u.plan_produksi !== null ? Number(u.plan_produksi) : null,
        keterangan:    u.keterangan,
      };
    });

    if (jenis === 'ETIKET' || jenis === 'DOS') {
      rows = rows.filter(r => r.jenis === jenis);
    }

    return NextResponse.json({
      success: true,
      data: {
        periode_awal:  latestUpload.periode_awal,
        periode_akhir: latestUpload.periode_akhir,
        rows,
      },
    });
  } catch (e: any) {
    console.error('[stock-level-pabrik GET]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}