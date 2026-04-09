import { NextRequest, NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? ' Ada' : ' TIDAK ADA — isi di .env.local',
      JWT_SECRET: process.env.JWT_SECRET ? ' Ada' : '⚠️ Tidak ada (pakai fallback)',
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ...info,
      success: false,
      error: 'DATABASE_URL belum diisi di .env.local',
      fix: 'Isi DATABASE_URL=postgresql://user:pass@localhost:5432/nama_db di file .env.local',
    }, { status: 500 });
  }

  try {
    await initDb();

    const [dbVer, users, tables] = await Promise.all([
      query<{ version: string }>('SELECT version()'),
      query<{ id: number; username: string; role: string; created_at: string }>(
        'SELECT id, username, role, created_at FROM users ORDER BY id'
      ),
      query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
      ),
    ]);

    return NextResponse.json({
      ...info,
      success: true,
      db_version: dbVer[0]?.version?.split(' ').slice(0, 2).join(' '),
      tables: tables.map(t => t.tablename),
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
      })),
      total_users: users.length,
      login_hint: 'Gunakan username: admin, password: admin123',
    });
  } catch (e: any) {
    return NextResponse.json({
      ...info,
      success: false,
      error: e.message,
      fix: 'Periksa apakah PostgreSQL berjalan dan DATABASE_URL benar',
    }, { status: 500 });
  }
}
