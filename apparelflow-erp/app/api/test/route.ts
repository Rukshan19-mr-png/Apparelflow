import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma/client";

export async function GET() {
  try {
    const prisma = new PrismaClient();
    const users = await prisma.user.findMany();
    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
