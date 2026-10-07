import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
}
