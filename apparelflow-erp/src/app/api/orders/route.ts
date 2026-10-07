import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { validateOrderInput, calculateExpectedCount, calculateFabricWastage } from '@/lib/verification';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const where = session.role === 'cutting_supervisor'
      ? { createdBy: session.id }
      : session.role === 'cutting_verifier'
        ? { status: { in: ['PENDING_VERIFICATION', 'REJECTED'] } }
        : { status: { in: ['VERIFIED', 'SEWING_STARTED'] } };
    const orders = await prisma.cuttingOrder.findMany({
      where, include: { recipe: { include: { components: true } }, creator: { select: { id: true, fullName: true } }, items: { include: { component: true } },
        logs: { include: { verifier: { select: { fullName: true } } }, orderBy: { timestamp: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Unable to fetch orders', error);
    return NextResponse.json({ error: 'Orders are unavailable.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (session.role !== 'cutting_supervisor') return NextResponse.json({ error: 'Only cutting supervisors can create orders.' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 }); }
  const data = body as { recipeId?: unknown; targetQty?: unknown; fabricRollId?: unknown; actualFabricYds?: unknown } | null;
  const validation = validateOrderInput({ targetQty: data?.targetQty, fabricRollId: data?.fabricRollId, actualFabricYds: data?.actualFabricYds });
  if (!validation.valid || typeof data?.recipeId !== 'string') return NextResponse.json({ errors: [...validation.errors, ...(typeof data?.recipeId !== 'string' ? ['A valid recipe ID is required.'] : [])] }, { status: 422 });
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: data.recipeId }, include: { components: true } });
    if (!recipe || recipe.components.length === 0) return NextResponse.json({ error: 'Production recipe not found or has no components.' }, { status: 422 });
    const targetQty = data.targetQty as number;
    const actualFabricYds = data.actualFabricYds as number;
    const order = await prisma.cuttingOrder.create({ data: {
      orderNo: `CUT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, recipeId: recipe.id, targetQty,
      fabricRollId: (data.fabricRollId as string).trim().toUpperCase(), actualFabricYds, status: 'PENDING_VERIFICATION', createdBy: session.id,
      items: { create: recipe.components.map((component) => ({ componentId: component.id, expectedQty: calculateExpectedCount(targetQty, component.piecesPerGarment) })) },
    }, include: { recipe: { include: { components: true } }, items: { include: { component: true } } } });
    const wastage = calculateFabricWastage(actualFabricYds, targetQty, recipe.stdFabricYards);
    return NextResponse.json({ order, expectedFabricYds: wastage.expectedFabricYds }, { status: 201 });
  } catch (error) {
    console.error('Unable to create order', error);
    return NextResponse.json({ error: 'Order could not be saved.' }, { status: 503 });
  }
}
