import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // 1. Tambahkan await
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (payload.role !== 'root' && payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();
    const rows = await query(
      `SELECT id, username, role, areas, allowed_menus, created_at FROM users ORDER BY created_at DESC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 2. Tambahkan await
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (payload.role !== 'root' && payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();
    const { username, password, role, areas, allowedMenus } = await req.json();
    if (!username || !password) return NextResponse.json({ success: false, error: 'Username dan password wajib' }, { status: 400 });
    
    if (payload.role === 'admin' && role === 'root') {
      return NextResponse.json({ success: false, error: 'Admin tidak bisa membuat akun root' }, { status: 403 });
    }
    const hash = await bcrypt.hash(password, 10);
    const rows = await query<{ id: number }>(
      `INSERT INTO users (username, password_hash, role, areas, allowed_menus) VALUES ($1,$2,$3,$4, $5) RETURNING id`,
      [username, hash, role || 'user', areas || [], allowedMenus || null]
    );
    return NextResponse.json({ success: true, data: { id: rows[0].id } });
  } catch (e: any) {
    if (e.message?.includes('unique')) return NextResponse.json({ success: false, error: 'Username sudah digunakan' }, { status: 409 });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // 3. Tambahkan await
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (payload.role !== 'root' && payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    await initDb();
    const { id, username, password, role, areas, allowedMenus } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });
    if (payload.role === 'admin' && role === 'root') {
      return NextResponse.json({ success: false, error: 'Admin tidak bisa mengubah role menjadi root' }, { status: 403 });
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query(
        `UPDATE users SET username=$1, password_hash=$2, role=$3, areas=$4 ,allowed_menus=$5 WHERE id=$6`,
        [username, hash, role, areas || [], allowedMenus || null, id]
      );
    } else {
      await query(
        `UPDATE users SET username=$1, role=$2, areas=$3, allowed_menus=$4 WHERE id=$5`,
        [username, role, areas || [], allowedMenus || null, id]
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('unique')) return NextResponse.json({ success: false, error: 'Username sudah digunakan' }, { status: 409 });
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 4. Tambahkan await
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (payload.role !== 'root') return NextResponse.json({ success: false, error: 'Hanya root yang bisa menghapus user' }, { status: 403 });
    await initDb();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID wajib' }, { status: 400 });
    if (Number(id) === payload.userId) return NextResponse.json({ success: false, error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
    await query('DELETE FROM users WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}