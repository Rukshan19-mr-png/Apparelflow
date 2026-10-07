import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const recipes = await prisma.recipe.findMany({ include: { components: true }, orderBy: { recipeCode: 'asc' } });
    return NextResponse.json({ recipes });
  } catch (error) {
    console.error('Unable to fetch production recipes', error);
    return NextResponse.json({ error: 'Production recipes are unavailable.' }, { status: 503 });
  }
}
