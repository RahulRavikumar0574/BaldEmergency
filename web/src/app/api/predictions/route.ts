import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// POST /api/predictions
// body: { emotion: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE', at?: string }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const emotion = String(body?.emotion || '').toUpperCase();
    const atStr = body?.at as string | undefined;
    if (!emotion || !["NEGATIVE","NEUTRAL","POSITIVE"].includes(emotion)) {
      return NextResponse.json({ error: "Invalid emotion" }, { status: 400 });
    }
    const at = atStr ? new Date(atStr) : new Date();

    // Best-effort ensure Prediction table exists
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Prediction" (
          "id" TEXT PRIMARY KEY,
          "patientId" TEXT NOT NULL,
          "emotion" TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Prediction_patientId_idx" ON "Prediction" ("patientId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Prediction_createdAt_idx" ON "Prediction" ("createdAt")
      `);
    } catch {}

    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Prediction" ("id","patientId","emotion","createdAt") VALUES ($1,$2,$3,$4)'
      , id, me.id, emotion, at
    );

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to record prediction' }, { status: 500 });
  }
}
