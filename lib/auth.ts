// lib/auth.ts
import { SignJWT, jwtVerify, JWTPayload as JoseJWTPayload } from 'jose';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'so-dashboard-super-secret-key-2024';
const secret = new TextEncoder().encode(JWT_SECRET);

const COOKIE_NAME = 'so_auth_token';

export interface JwtPayload extends JoseJWTPayload {
  userId: number;
  username: string;
  role: 'root' | 'admin' | 'user';
  areas: string[];
}

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return token;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    // Type assertion dengan pengecekan sederhana
    const customPayload = payload as JwtPayload;

    if (!customPayload.userId || !customPayload.username || !customPayload.role) {
      console.error('❌ Payload JWT tidak lengkap');
      return null;
    }

    console.log('✅ JWT Verify berhasil untuk user:', customPayload.username);
    return customPayload;
  } catch (err: any) {
    console.error('❌ JWT Verify GAGAL:', err.message);
    return null;
  }
}

export async function getTokenFromRequest(req: NextRequest): Promise<JwtPayload | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;

  if (!cookie) {
    console.log(' Tidak ada cookie so_auth_token');
    return null;
  }

  console.log(' Cookie ditemukan, verifikasi JWT...');
  return await verifyToken(cookie);
}

export { COOKIE_NAME };