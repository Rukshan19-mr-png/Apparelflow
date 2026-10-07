import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canTransitionOrder, validateComponentCounts, calculateFabricWastage, validateRejectionNote } from '@/lib/verification';
import { prisma } from '@/lib/prisma';

type SubmittedItem = { componentId?: unknown; actualQty?: unknown };

function matchComponents(orderItems: Array<{ componentId: string; expectedQty: number; component: { componentName: string } }>, submitted: unknown) {
  if (!Array.isArray(submitted) || submitted.length !== orderItems.length) {
    return { error: 'Every recipe component must be counted exactly once.' as string, counts: null };
  }
  const byId = new Map<string, unknown>();
  for (const entry of submitted as SubmittedItem[]) {
    if (typeof entry?.componentId !== 'string' || byId.has(entry.componentId)) return { error: 'Invalid or duplicate component count.' as string, counts: null };
    byId.set(entry.componentId, entry.actualQty);
  }
  if (orderItems.some((item) => !byId.has(item.componentId))) return { error: 'Every recipe component must be counted exactly once.' as string, counts: null };
  const counts = validateComponentCounts(orderItems.map((item) => ({ componentName: item.component.componentName, expectedQty: item.expectedQty, actualQty: byId.get(item.componentId) })));
  return counts.errors.some((error) => error.includes('must have a whole number count'))
    ? { error: counts.errors.join(' '), counts: null }
    : { error: null, counts };
}

export async function POST(request: NextRequest, context: RouteContext<'/api/orders/[id]/verify'>) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'cutting_verifier') return NextResponse.json({ error: 'Only a cutting verifier can review batches.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 }); }
  const input = body as { decision?: unknown; items?: unknown; rejectionNote?: unknown } | null;
  if (!input || (input.decision !== 'APPROVED' && input.decision !== 'REJECTED')) return NextResponse.json({ error: 'Choose APPROVED or REJECTED.' }, { status: 422 });
  const rejectionNote = validateRejectionNote(input.rejectionNote);
  if (input.decision === 'REJECTED' && !rejectionNote.valid) return NextResponse.json({ error: rejectionNote.error }, { status: 422 });
  if (input.decision === 'APPROVED' && !Array.isArray(input.items)) return NextResponse.json({ error: 'Submit component counts to approve this batch.' }, { status: 422 });
  const { id } = await context.params;
  try {
    const order = await prisma.cuttingOrder.findUnique({ where: { id }, include: { recipe: true, items: { include: { component: true } } } });
    if (!order) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    const destination = input.decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
    if (!canTransitionOrder(order.status, destination)) return NextResponse.json({ error: `Batch cannot transition from ${order.status} to ${destination}.` }, { status: 409 });

    const wastagePct = calculateFabricWastage(order.actualFabricYds, order.targetQty, order.recipe.stdFabricYards).wastagePct;
    if (input.decision === 'REJECTED') {
      const matched = input.items === undefined ? null : matchComponents(order.items, input.items);
      if (matched?.error) return NextResponse.json({ error: matched.error }, { status: 422 });
      await prisma.$transaction(async (tx) => {
        const changed = await tx.cuttingOrder.updateMany({ where: { id: order.id, status: 'PENDING_VERIFICATION' }, data: { status: 'REJECTED' } });
        if (changed.count !== 1) throw new Error('BATCH_STATE_CHANGED');
        if (matched?.counts) {
          for (let index = 0; index < order.items.length; index++) {
            const stored = order.items[index];
            const actualQty = matched.counts.items[index].actualQty!;
            const status = actualQty < stored.expectedQty ? 'RED' : actualQty === stored.expectedQty ? 'GREEN' : 'YELLOW';
            await tx.verificationItem.update({ where: { id: stored.id }, data: { actualQty, status } });
          }
        }
        const componentVariance = matched?.counts ? JSON.stringify(order.items.map((item, index) => ({ componentId: item.componentId, componentName: item.component.componentName, expectedQty: item.expectedQty, actualQty: matched.counts!.items[index].actualQty, variance: matched.counts!.items[index].actualQty! - item.expectedQty }))) : null;
        await tx.verificationLog.create({ data: { orderId: order.id, verifierId: session.id, decision: 'REJECTED', rejectionNote: (input.rejectionNote as string).trim(), wastagePct, componentVariance } });
      });
      return NextResponse.json({ ok: true, status: 'REJECTED' });
    }

    const matched = matchComponents(order.items, input.items);
    if (matched.error || !matched.counts) return NextResponse.json({ error: matched.error || 'Invalid component counts.' }, { status: 422 });
    if (matched.counts.errors.length > 0) return NextResponse.json({ error: 'This batch cannot be approved.', details: matched.counts.errors }, { status: 422 });
    const componentVariance = JSON.stringify(order.items.map((item, index) => ({ componentId: item.componentId, componentName: item.component.componentName, expectedQty: item.expectedQty, actualQty: matched.counts!.items[index].actualQty, variance: matched.counts!.items[index].actualQty! - item.expectedQty })));
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.cuttingOrder.updateMany({ where: { id: order.id, status: 'PENDING_VERIFICATION' }, data: { status: 'VERIFIED' } });
      if (changed.count !== 1) throw new Error('BATCH_STATE_CHANGED');
      for (let index = 0; index < order.items.length; index++) {
        const componentItem = order.items[index];
        const actualQty = matched.counts!.items[index].actualQty!;
        const status = actualQty === componentItem.expectedQty ? 'GREEN' : 'YELLOW';
        await tx.verificationItem.update({ where: { id: componentItem.id }, data: { actualQty, status } });
      }
      await tx.verificationLog.create({ data: { orderId: order.id, verifierId: session.id, decision: 'APPROVED', wastagePct, componentVariance } });
      return tx.cuttingOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: { include: { component: true } } } });
    });
    return NextResponse.json({ ok: true, status: result.status, wastagePct, order: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'BATCH_STATE_CHANGED') return NextResponse.json({ error: 'Batch has already been reviewed. Refresh the QC station.' }, { status: 409 });
    console.error('Unable to verify batch', error);
    return NextResponse.json({ error: 'Batch verification could not be saved.' }, { status: 503 });
  }
}
