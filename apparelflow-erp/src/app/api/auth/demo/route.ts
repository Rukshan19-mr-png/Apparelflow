import { NextRequest, NextResponse } from 'next/server';
import { createSession, sessionCookie, type AuthUser } from '@/lib/auth';

const demos: Record<string, AuthUser> = {
  cutting_supervisor: { id: 'demo-cutting-supervisor', email: 'alex@demo.apparelflow.test', fullName: 'Maleesha Rukshan', role: 'cutting_supervisor' },
  cutting_verifier: { id: 'demo-cutting-verifier', email: 'maya@demo.apparelflow.test', fullName: 'Maya Bandara', role: 'cutting_verifier' },
  sewing_supervisor: { id: 'demo-sewing-supervisor', email: 'jordan@demo.apparelflow.test', fullName: 'Sugath Lokuge', role: 'sewing_supervisor' },
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 }); }
  const role = (body as { role?: unknown } | null)?.role;
  if (typeof role !== 'string' || !demos[role]) return NextResponse.json({ error: 'Choose a valid demo role.' }, { status: 422 });
  const account = demos[role];
  const response = NextResponse.json({ user: account });
  response.cookies.set(sessionCookie, await createSession(account), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
