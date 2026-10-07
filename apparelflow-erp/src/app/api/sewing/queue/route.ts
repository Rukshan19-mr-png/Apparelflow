import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canTransitionOrder } from '@/lib/verification';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'sewing_supervisor') return NextResponse.json({ error: 'Only the sewing supervisor can access the sewing queue.' }, { status: 403 });
  try {
    const orders = await prisma.cuttingOrder.findMany({ where: { status: 'VERIFIED' }, include: { recipe: true, items: { include: { component: true } }, logs: { include: { verifier: { select: { fullName: true } } }, orderBy: { timestamp: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'asc' } });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Unable to fetch sewing queue', error);
    return NextResponse.json({ error: 'Sewing queue is unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'sewing_supervisor') return NextResponse.json({ error: 'Only the sewing supervisor can start assembly.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 }); }
  const id = (body as { orderId?: unknown } | null)?.orderId;
  if (typeof id !== 'string') return NextResponse.json({ error: 'Order ID is required.' }, { status: 422 });
  try {
    const order = await prisma.cuttingOrder.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    if (!canTransitionOrder(order.status, 'SEWING_STARTED')) return NextResponse.json({ error: 'Only verified batches can start sewing.' }, { status: 422 });
    const updated = await prisma.cuttingOrder.updateMany({ where: { id, status: 'VERIFIED' }, data: { status: 'SEWING_STARTED' } });
    if (updated.count !== 1) return NextResponse.json({ error: 'Batch changed state. Reload the sewing queue.' }, { status: 409 });
    return NextResponse.json({ ok: true, status: 'SEWING_STARTED' });
  } catch (error) {
    console.error('Unable to start sewing assembly', error);
    return NextResponse.json({ error: 'Batch could not be released to assembly.' }, { status: 503 });
  }
}
