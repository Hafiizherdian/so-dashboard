import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  console.log(' /api/auth/me dipanggil');

  const payload = await getTokenFromRequest(req);

  if (!payload) {
    console.log(' /api/auth/me: Payload = null → Unauthorized');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  console.log(' /api/auth/me: Berhasil, user =', payload.username);
  return NextResponse.json({ success: true, user: payload });
}