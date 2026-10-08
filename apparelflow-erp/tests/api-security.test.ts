import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../src/lib/auth';

vi.mock('@/lib/auth', () => ({ getSession: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    cuttingOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    recipe: { findUnique: vi.fn() },
    verificationItem: { update: vi.fn() },
    verificationLog: { create: vi.fn() },
  },
}));

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { POST as createOrder } from '../src/app/api/orders/route';
import { POST as verifyOrder } from '../src/app/api/orders/[id]/verify/route';
import { POST as startSewing } from '../src/app/api/sewing/queue/route';

const supervisor: AuthUser = {
  id: 'supervisor-1',
  email: 'supervisor@example.test',
  fullName: 'Cutting Supervisor',
  role: 'cutting_supervisor',
};
const verifier: AuthUser = {
  id: 'verifier-1',
  email: 'verifier@example.test',
  fullName: 'Cutting Verifier',
  role: 'cutting_verifier',
};
function request(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const verifyContext = { params: Promise.resolve({ id: 'order-1' }) };

describe('API role boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated order creation', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const response = await createOrder(
      request('http://localhost/api/orders', {}),
    );

    expect(response.status).toBe(401);
    expect(prisma.recipe.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow a verifier to create a cutting order', async () => {
    vi.mocked(getSession).mockResolvedValue(verifier);

    const response = await createOrder(
      request('http://localhost/api/orders', {}),
    );

    expect(response.status).toBe(403);
    expect(prisma.recipe.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow a supervisor to verify a batch', async () => {
    vi.mocked(getSession).mockResolvedValue(supervisor);

    const response = await verifyOrder(
      request('http://localhost/api/orders/order-1/verify', {
        decision: 'APPROVED',
        items: [],
      }),
      verifyContext,
    );

    expect(response.status).toBe(403);
    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
  });

  it('does not allow a cutting verifier to start sewing', async () => {
    vi.mocked(getSession).mockResolvedValue(verifier);

    const response = await startSewing(
      request('http://localhost/api/sewing/queue', { orderId: 'order-1' }),
    );

    expect(response.status).toBe(403);
    expect(prisma.cuttingOrder.findUnique).not.toHaveBeenCalled();
  });
});

describe('server-side approval hard stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(verifier);
    vi.mocked(prisma.cuttingOrder.findUnique).mockResolvedValue({
      id: 'order-1',
      status: 'PENDING_VERIFICATION',
      targetQty: 10,
      actualFabricYds: 18,
      recipe: { stdFabricYards: 1.8 },
      items: [
        {
          id: 'item-1',
          componentId: 'front-panel',
          expectedQty: 10,
          actualQty: null,
          component: { componentName: 'Front panel' },
        },
        {
          id: 'item-2',
          componentId: 'sleeves',
          expectedQty: 20,
          actualQty: null,
          component: { componentName: 'Sleeves' },
        },
      ],
    } as never);
  });

  it('blocks approval with a shortage before any database write', async () => {
    const response = await verifyOrder(
      request('http://localhost/api/orders/order-1/verify', {
        decision: 'APPROVED',
        items: [
          { componentId: 'front-panel', actualQty: 10 },
          { componentId: 'sleeves', actualQty: 19 },
        ],
      }),
      verifyContext,
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe('This batch cannot be approved.');
    expect(body.details.join(' ')).toContain('Sleeves');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
