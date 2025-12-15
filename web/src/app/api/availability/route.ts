import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

// GET /api/availability?doctorId=...&from=ISO&to=ISO
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!doctorId) {
      return NextResponse.json({ error: "doctorId is required" }, { status: 400 });
    }

    const clauses: string[] = ['"doctorId" = $1'];
    const params: any[] = [doctorId];
    if (from) { clauses.push('"startTime" >= $' + (params.length + 1)); params.push(new Date(from)); }
    if (to) { clauses.push('"startTime" <= $' + (params.length + 1)); params.push(new Date(to)); }

    const sql = `SELECT "id","doctorId","startTime","endTime" FROM "Availability"
                 WHERE ${clauses.join(" AND ")}
                 ORDER BY "startTime" ASC`;
    const slots = (await prisma.$queryRawUnsafe(sql, ...params)) as Array<{
      id: string; doctorId: string; startTime: string; endTime: string;
    }>;

    return NextResponse.json({ slots });
  } catch (err: any) {
    console.error("/api/availability GET error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/availability - create or upsert doctor slots
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as any)?.role as string | undefined;
    const email = (session.user as any)?.email as string | undefined;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, role: true } });
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (role !== "DOCTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { slots } = body as { slots?: Array<{ startTime: string; endTime: string }>; };
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: "slots array required" }, { status: 400 });
    }

    // Create slots via raw SQL; no overlap validation for now
    for (const s of slots) {
      if (!s?.startTime || !s?.endTime) continue;
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        'INSERT INTO "Availability" ("id","doctorId","startTime","endTime") VALUES ($1,$2,$3,$4)',
        id,
        me.id,
        new Date(s.startTime),
        new Date(s.endTime)
      );
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("/api/availability POST error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

