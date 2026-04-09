import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const payload = getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await initDb();

    const [years, months, areas, types, kategoris] = await Promise.all([
      // Ekstrak tahun dari kolom tanggal (DATE)
      query<{ tahun: number }>(
        `SELECT DISTINCT EXTRACT(YEAR FROM tanggal)::INTEGER AS tahun
         FROM sales_transactions
         WHERE tanggal IS NOT NULL
         ORDER BY tahun DESC`
      ),
      // Ekstrak bulan dari kolom tanggal
      query<{ bulan: number }>(
        `SELECT DISTINCT EXTRACT(MONTH FROM tanggal)::INTEGER AS bulan
         FROM sales_transactions
         WHERE tanggal IS NOT NULL
         ORDER BY bulan ASC`
      ),
      
      query<{ area: string }>(
        `SELECT DISTINCT uf.area
         FROM uploaded_files uf
         WHERE uf.area IS NOT NULL AND uf.area != ''
         ORDER BY uf.area`
      ),
      query<{ type_customer: string }>(
        `SELECT DISTINCT type_customer
         FROM sales_transactions
         WHERE type_customer IS NOT NULL AND type_customer != ''
         ORDER BY type_customer`
      ),
      query<{ kategori: string }>(
        `SELECT DISTINCT kategori
         FROM sales_transactions
         WHERE kategori IS NOT NULL AND kategori != ''
         ORDER BY kategori`
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        years: years.map(r => r.tahun),
        months: months.map(r => r.bulan),
        areas: areas.map(r => r.area),
        typeCustomers: types.map(r => r.type_customer),
        kategoris: kategoris.map(r => r.kategori),
        keterangans: [], 
      } satisfies import('@/types').FilterOptions,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}