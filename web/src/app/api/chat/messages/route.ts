import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// OPTIONS: handle CORS/preflight gracefully
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

// GET /api/chat/messages?conversationId=...
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ items: [] });
  try {
    const items = (await prisma.$queryRawUnsafe(
      'SELECT "id","conversationId","senderId","text","createdAt" FROM "Message" WHERE "conversationId" = $1 ORDER BY "createdAt" ASC',
      conversationId
    )) as Array<{ id: string; conversationId: string; senderId: string; text: string; createdAt: string }>;
    return NextResponse.json({ items: items || [] });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}

// POST { conversationId, text }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { conversationId, text } = body as { conversationId?: string; text?: string };
  if (!conversationId || !text || !text.trim()) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // Simple access check: user must be either the patient or doctor participant
  try {
    const rows = (await prisma.$queryRawUnsafe(
      'SELECT "id","patientId","doctorId" FROM "Conversation" WHERE "id" = $1 LIMIT 1',
      conversationId
    )) as Array<{ id: string; patientId: string; doctorId: string }>;
    const convo = rows?.[0];
    if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (convo.patientId !== me.id && convo.doctorId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Message" ("id","conversationId","senderId","text") VALUES ($1,$2,$3,$4)',
      id,
      convo.id,
      me.id,
      text.trim()
    );
    const out = (await prisma.$queryRawUnsafe(
      'SELECT "id","conversationId","senderId","text","createdAt" FROM "Message" WHERE "id" = $1',
      id
    )) as Array<{ id: string; conversationId: string; senderId: string; text: string; createdAt: string }>;
    return NextResponse.json({ message: out?.[0] });
  } catch (e) {
    return NextResponse.json({ error: "Failed to send" }, { status: 400 });
  }
}
