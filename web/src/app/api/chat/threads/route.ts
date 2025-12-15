import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true, name: true } });
  if (!user) return NextResponse.json({ items: [] });

  // Best-effort queries using tables Assignment, Conversation, Message.
  try {
    if (user.role === "PATIENT") {
      // Find assigned doctor; if none, auto-assign a random doctor (best-effort) via SQL
      const aRows = (await prisma.$queryRawUnsafe(
        'SELECT "doctorId" FROM "Assignment" WHERE "patientId" = $1 LIMIT 1',
        user.id
      )) as Array<{ doctorId: string }>;
      let doctorId = aRows?.[0]?.doctorId;
      if (!doctorId) {
        const pool = await prisma.user.findMany({ where: { role: "DOCTOR" }, select: { id: true } });
        if (pool.length > 0) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          doctorId = pick.id;
          try {
            const aid = randomUUID();
            await prisma.$executeRawUnsafe(
              'INSERT INTO "Assignment" ("id","patientId","doctorId") VALUES ($1,$2,$3) ON CONFLICT ("patientId") DO NOTHING',
              aid,
              user.id,
              doctorId
            );
          } catch {}
        }
      }
      if (!doctorId) return NextResponse.json({ items: [] });
      // Ensure conversation exists
      const cRows = (await prisma.$queryRawUnsafe(
        'SELECT "id" FROM "Conversation" WHERE "patientId" = $1 AND "doctorId" = $2 LIMIT 1',
        user.id,
        doctorId
      )) as Array<{ id: string }>;
      let conversationId = cRows?.[0]?.id;
      if (!conversationId) {
        try {
          conversationId = randomUUID();
          await prisma.$executeRawUnsafe(
            'INSERT INTO "Conversation" ("id","patientId","doctorId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            conversationId,
            user.id,
            doctorId
          );
        } catch {}
      }
      const doctor = await prisma.user.findUnique({ where: { id: doctorId }, select: { id: true, name: true, email: true } });
      const lastRows = (await prisma.$queryRawUnsafe(
        'SELECT "text","createdAt" FROM "Message" WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
        conversationId
      )) as Array<{ text: string; createdAt: string }>;
      const last = lastRows?.[0] || null;
      return NextResponse.json({ items: conversationId ? [{ conversationId, peer: doctor, last }] : [] });
    } else if (user.role === "DOCTOR") {
      // List all patients assigned to this doctor with last message preview
      const assigns = (await prisma.$queryRawUnsafe(
        'SELECT "patientId" FROM "Assignment" WHERE "doctorId" = $1',
        user.id
      )) as Array<{ patientId: string }>;
      const items: any[] = [];
      for (const a of assigns || []) {
        const patient = await prisma.user.findUnique({ where: { id: a.patientId }, select: { id: true, name: true, email: true } });
        // Ensure conversation exists
        const cRows = (await prisma.$queryRawUnsafe(
          'SELECT "id" FROM "Conversation" WHERE "patientId" = $1 AND "doctorId" = $2 LIMIT 1',
          a.patientId,
          user.id
        )) as Array<{ id: string }>;
        let conversationId = cRows?.[0]?.id;
        if (!conversationId) {
          try {
            conversationId = randomUUID();
            await prisma.$executeRawUnsafe(
              'INSERT INTO "Conversation" ("id","patientId","doctorId") VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
              conversationId,
              a.patientId,
              user.id
            );
          } catch {}
        }
        const lastRows = (await prisma.$queryRawUnsafe(
          'SELECT "text","createdAt" FROM "Message" WHERE "conversationId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
          conversationId
        )) as Array<{ text: string; createdAt: string }>;
        const last = lastRows?.[0] || null;
        if (conversationId && patient) items.push({ conversationId, peer: patient, last });
      }
      items.sort((a, b) => (new Date(b.last?.createdAt || 0).getTime() - new Date(a.last?.createdAt || 0).getTime()));
      return NextResponse.json({ items });
    }
    return NextResponse.json({ items: [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Chat tables missing" }, { status: 500 });
  }
}
