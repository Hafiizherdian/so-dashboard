import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTokenFromRequest } from '@/lib/auth';
import { query, initDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const payload = await getTokenFromRequest(req);
    if (!payload) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    await initDb();
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: 'Password lama dan baru wajib diisi' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'Password baru minimal 6 karakter' }, { status: 400 });
    }
    const rows = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=$1', [payload.userId]
    );
    if (!rows[0]) return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return NextResponse.json({ success: false, error: 'Password lama tidak sesuai' }, { status: 400 });
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, payload.userId]);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
