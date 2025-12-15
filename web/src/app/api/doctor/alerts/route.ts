import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/doctor/alerts
// Returns patients assigned to this doctor who currently have a NEGATIVE streak >= 3
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me || me.role !== "DOCTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Find assigned patients
    const assigns = (await prisma.$queryRawUnsafe(
      'SELECT "patientId" FROM "Assignment" WHERE "doctorId" = $1',
      me.id
    )) as Array<{ patientId: string }>;
    const patientIds = assigns.map((a) => a.patientId);
    if (patientIds.length === 0) return NextResponse.json({ items: [] });

    // Best-effort: Prediction table may not exist
    try {
      // Fetch latest predictions per patient (limit 50 each)
      const items: Array<{ patient: { id: string; name: string | null; email: string }, streak: number; lastAt: string | null }> = [];
      const patients = await prisma.user.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true, email: true } });

      for (const p of patients) {
        const rows = (await prisma.$queryRawUnsafe(
          'SELECT "emotion","createdAt" FROM "Prediction" WHERE "patientId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
          p.id
        )) as Array<{ emotion: string; createdAt: string }>;

        // Compute current consecutive NEGATIVE streak (from most recent backwards)
        let streak = 0;
        for (const r of rows) {
          if ((r.emotion || '').toUpperCase() === 'NEGATIVE') streak++; else break;
        }
        const lastAt = rows[0]?.createdAt || null;
        if (streak >= 3) items.push({ patient: p, streak, lastAt });
      }

      // Sort by highest streak then most recent
      items.sort((a, b) => (b.streak - a.streak) || (new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()));
      return NextResponse.json({ items });
    } catch {
      return NextResponse.json({ items: [] });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
