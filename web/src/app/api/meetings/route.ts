import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// GET /api/meetings - list current user's meetings
// - If PATIENT: meetings where patientId = me.id
// - If DOCTOR: meetings where doctorId = me.id
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email = (session.user as any)?.email as string | undefined;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let meetings: any[] = [];
    if ((me as any).role === "DOCTOR") {
      meetings = (await prisma.$queryRawUnsafe(
        'SELECT "id","patientId","doctorId","startTime","endTime","reason","status","createdAt" FROM "Meeting" WHERE "doctorId" = $1 ORDER BY "startTime" ASC',
        me.id
      )) as any[];
      // Attach patient info
      const cache = new Map<string, { id: string; name: string | null; email: string }>();
      for (const m of meetings) {
        const pid = m.patientId as string;
        if (!cache.has(pid)) {
          const pat = await prisma.user.findUnique({ where: { id: pid }, select: { id: true, name: true, email: true } });
          if (pat) cache.set(pid, pat);
        }
        (m as any).patient = cache.get(pid) || null;
      }
    } else {
      meetings = (await prisma.$queryRawUnsafe(
        'SELECT "id","patientId","doctorId","startTime","endTime","reason","status","createdAt" FROM "Meeting" WHERE "patientId" = $1 ORDER BY "startTime" ASC',
        me.id
      )) as any[];
    }
    return NextResponse.json({ meetings: meetings || [] });
  } catch (err: any) {
    console.error("/api/meetings GET error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/meetings - book a meeting
// body: { slotId, doctorId, startTime, endTime, reason }
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const email = (session.user as any)?.email as string | undefined;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { slotId, doctorId, startTime, endTime, reason } = body as {
      slotId?: string;
      doctorId?: string;
      startTime?: string;
      endTime?: string;
      reason?: string;
    };

    if (!doctorId || !startTime || !endTime || !reason) {
      return NextResponse.json({ error: "doctorId, startTime, endTime, reason required" }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!(start < end)) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    // Optional: enforce slot exists and is not booked
    if (slotId) {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT "id","doctorId","startTime","endTime" FROM "Availability" WHERE "id" = $1 LIMIT 1',
        slotId
      )) as Array<{ id: string; doctorId: string; startTime: string; endTime: string }>;
      const slot = rows?.[0];
      if (!slot || slot.doctorId !== doctorId) {
        return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
      }
      const s = new Date(slot.startTime);
      const e = new Date(slot.endTime);
      if (s.getTime() !== start.getTime() || e.getTime() !== end.getTime()) {
        return NextResponse.json({ error: "Slot time mismatch" }, { status: 400 });
      }
    }

    // Create meeting and best-effort mark slot booked
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Meeting" ("id","patientId","doctorId","startTime","endTime","reason","status") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      id,
      me.id,
      doctorId,
      start,
      end,
      reason,
      'PENDING'
    );
    if (slotId) {
      try {
        await prisma.$executeRawUnsafe(
          'UPDATE "Availability" SET "isBooked" = TRUE WHERE "id" = $1',
          slotId
        );
      } catch {}
    }

    const created = (await prisma.$queryRawUnsafe(
      'SELECT "id","patientId","doctorId","startTime","endTime","reason","status","createdAt" FROM "Meeting" WHERE "id" = $1',
      id
    )) as any[];

    // Stub: generate meeting link and send notifications in background later
    return NextResponse.json({ success: true, meeting: created?.[0] });
  } catch (err: any) {
    console.error("/api/meetings POST error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

