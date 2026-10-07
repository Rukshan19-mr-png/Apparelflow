import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canTransitionOrder, calculateExpectedCount, validateOrderInput } from '@/lib/verification';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, context: RouteContext<'/api/orders/[id]/resubmit'>) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'cutting_supervisor') return NextResponse.json({ error: 'Only cutting supervisors can resubmit recut batches.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 }); }
  const input = body as { fabricRollId?: unknown; actualFabricYds?: unknown } | null;
  const { id } = await context.params;
  try {
    const order = await prisma.cuttingOrder.findUnique({ where: { id }, include: { recipe: { include: { components: true } } } });
    if (!order) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    if (order.createdBy !== session.id) return NextResponse.json({ error: 'You can only resubmit batches created by your account.' }, { status: 403 });
    if (!canTransitionOrder(order.status, 'PENDING_VERIFICATION')) return NextResponse.json({ error: 'Only rejected batches can be resubmitted.' }, { status: 409 });
    const validation = validateOrderInput({ targetQty: order.targetQty, fabricRollId: input?.fabricRollId, actualFabricYds: input?.actualFabricYds });
    if (!validation.valid) return NextResponse.json({ errors: validation.errors }, { status: 422 });

    const changed = await prisma.$transaction(async (tx) => {
      const stateChange = await tx.cuttingOrder.updateMany({ where: { id, createdBy: session.id, status: 'REJECTED' }, data: { status: 'PENDING_VERIFICATION', fabricRollId: (input!.fabricRollId as string).trim().toUpperCase(), actualFabricYds: input!.actualFabricYds as number } });
      if (stateChange.count !== 1) return false;
      for (const item of order.recipe.components) {
        await tx.verificationItem.upsert({
          where: { orderId_componentId: { orderId: order.id, componentId: item.id } },
          create: { orderId: order.id, componentId: item.id, expectedQty: calculateExpectedCount(order.targetQty, item.piecesPerGarment) },
          update: { expectedQty: calculateExpectedCount(order.targetQty, item.piecesPerGarment), actualQty: null, status: null },
        });
      }
      return true;
    });
    if (!changed) return NextResponse.json({ error: 'Batch has already changed state. Refresh the order list.' }, { status: 409 });
    return NextResponse.json({ ok: true, status: 'PENDING_VERIFICATION' });
  } catch (error) {
    console.error('Unable to resubmit recut batch', error);
    return NextResponse.json({ error: 'Recut batch could not be resubmitted.' }, { status: 503 });
  }
}
