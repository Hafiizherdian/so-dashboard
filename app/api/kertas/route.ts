import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();

    const p = req.nextUrl.searchParams;
    const conds: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const jenis = p.get('jenis_kertas');
    if (jenis && jenis !== 'all') { conds.push(`jenis_kertas = $${i++}`); vals.push(jenis); }

    const merk = p.get('merk');
    if (merk && merk !== 'all') { conds.push(`merk = $${i++}`); vals.push(merk); }

    const periode = p.get('periode');
    if (periode && periode !== 'all') { conds.push(`periode = $${i++}`); vals.push(periode); }

    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const rows = await query(
      `SELECT id, produk, jenis_kertas, gramasi, merk, ukuran_kertas,
              lebar, panjang, unit, saldo_awal, masuk, keluar, saldo_akhir,
              periode, keterangan, created_at
       FROM kertas_stok
       ${where}
       ORDER BY jenis_kertas, gramasi, merk, produk`,
      vals
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const body = await req.json();
    const {
      produk, jenis_kertas, gramasi, merk,
      lebar, panjang, unit,
      saldo_awal, masuk, keluar, periode, keterangan,
    } = body;

    if (!produk || !jenis_kertas || !gramasi || !periode) {
      return NextResponse.json({ success: false, error: 'Produk, jenis kertas, gramasi, dan periode wajib diisi' }, { status: 400 });
    }

    const saldo_akhir = Number(saldo_awal) + Number(masuk) - Number(keluar);
    const ukuran_kertas = `${gramasi} x ${lebar} x ${panjang}`;

    const result = await query<{ id: string }>(
      `INSERT INTO kertas_stok
         (produk, jenis_kertas, gramasi, merk, ukuran_kertas, lebar, panjang, unit,
          saldo_awal, masuk, keluar, saldo_akhir, periode, keterangan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [produk, jenis_kertas, Number(gramasi), merk, ukuran_kertas, Number(lebar), Number(panjang),
       unit, Number(saldo_awal), Number(masuk), Number(keluar), saldo_akhir, periode, keterangan || '']
    );

    return NextResponse.json({ success: true, data: { id: result[0].id } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });

    const body = await req.json();
    const {
      produk, jenis_kertas, gramasi, merk,
      lebar, panjang, unit,
      saldo_awal, masuk, keluar, periode, keterangan,
    } = body;

    const saldo_akhir = Number(saldo_awal) + Number(masuk) - Number(keluar);
    const ukuran_kertas = `${gramasi} x ${lebar} x ${panjang}`;

    await query(
      `UPDATE kertas_stok SET
         produk=$1, jenis_kertas=$2, gramasi=$3, merk=$4, ukuran_kertas=$5,
         lebar=$6, panjang=$7, unit=$8,
         saldo_awal=$9, masuk=$10, keluar=$11, saldo_akhir=$12,
         periode=$13, keterangan=$14
       WHERE id=$15`,
      [produk, jenis_kertas, Number(gramasi), merk, ukuran_kertas, Number(lebar), Number(panjang),
       unit, Number(saldo_awal), Number(masuk), Number(keluar), saldo_akhir,
       periode, keterangan || '', id]
    );

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload || payload.role === 'user') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    await initDb();

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });

    await query('DELETE FROM kertas_stok WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}