import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query, initDb } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await initDb();

    const body = await req.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const rows = await query<{
      id: number;
      username: string;
      password_hash: string;
      role: string;
      areas: string[];
    }>('SELECT id, username, password_hash, role, areas FROM users WHERE username=$1', [username]);

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ success: false, error: 'Username tidak ditemukan' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Password salah' }, { status: 401 });
    }


    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role as 'root' | 'admin' | 'user',
      areas: user.areas || [],
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        areas: user.areas || []
      }
    });

    response.cookies.set('so_auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    console.log('Cookie so_auth_token berhasil di-set');
    return response;

  } catch (e: any) {
    console.error('[login]', e);
    return NextResponse.json({ success: false, error: e.message || 'Internal server error' }, { status: 500 });
  }
}