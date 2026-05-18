import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('so_auth_token', '', {
    httpOnly: true,
    secure: false,        // sama dengan saat login
    sameSite: 'lax',      // sama dengan saat login
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}