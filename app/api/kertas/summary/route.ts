// ============================================================
// FILE: app/api/kertas/summary/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';
 
export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();
 
    const [summary, jenis, merk] = await Promise.all([
      query<{
        total_produk: string;
        total_masuk: string;
        total_keluar: string;
        total_saldo: string;
      }>(`
        SELECT
          COUNT(*)           AS total_produk,
          COALESCE(SUM(masuk), 0)        AS total_masuk,
          COALESCE(SUM(keluar), 0)       AS total_keluar,
          COALESCE(SUM(saldo_akhir), 0)  AS total_saldo
        FROM kertas_stok
      `),
      query<{ jenis_kertas: string }>(`
        SELECT DISTINCT jenis_kertas FROM kertas_stok
        WHERE jenis_kertas IS NOT NULL AND jenis_kertas != ''
        ORDER BY jenis_kertas
      `),
      query<{ merk: string }>(`
        SELECT DISTINCT merk FROM kertas_stok
        WHERE merk IS NOT NULL AND merk != ''
        ORDER BY merk
      `),
    ]);
 
    const s = summary[0];
    return NextResponse.json({
      success: true,
      data: {
        total_produk: Number(s.total_produk),
        total_masuk:  Number(s.total_masuk),
        total_keluar: Number(s.total_keluar),
        total_saldo:  Number(s.total_saldo),
        jenis_list:   jenis.map(r => r.jenis_kertas),
        merk_list:    merk.map(r => r.merk),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}