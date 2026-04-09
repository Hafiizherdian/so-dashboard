import { NextRequest, NextResponse } from 'next/server';
import { clearCookieHeader } from '@/lib/auth';

export async function POST() {
  return NextResponse.json({ success: true }, { headers: { 'Set-Cookie': clearCookieHeader() } });
}
