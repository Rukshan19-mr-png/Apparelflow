import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { UserRole } from '@/types';

const cookieName = 'apparelflow_session';
const roles = ['cutting_supervisor', 'cutting_verifier', 'sewing_supervisor'];
const secret = () => {
  const configured = process.env.AUTH_SECRET;
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be configured in production.');
  return new TextEncoder().encode(configured || 'development-only-apparelflow-secret-change-before-deploy');
};

export type AuthUser = { id: string; email: string; fullName: string; role: UserRole };

export async function createSession(user: AuthUser) {
  return new SignJWT({ email: user.email, fullName: user.fullName, role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('12h').sign(secret());
}

export async function getSession(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' || typeof payload.fullName !== 'string' || !roles.includes(String(payload.role))) return null;
    return { id: payload.sub, email: payload.email, fullName: payload.fullName, role: payload.role as UserRole };
  } catch { return null; }
}

export const sessionCookie = cookieName;
