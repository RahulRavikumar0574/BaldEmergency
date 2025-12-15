import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/doctor/analytics
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me || me.role !== "DOCTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Get assigned patients
    const assigns = (await prisma.$queryRawUnsafe(
      'SELECT "patientId" FROM "Assignment" WHERE "doctorId" = $1',
      me.id
    )) as Array<{ patientId: string }>;
    const patientIds = assigns.map((a) => a.patientId);
    if (patientIds.length === 0) return NextResponse.json({ summary: { total: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0 }, perPatient: [] });

    // Best-effort: Prediction table may not exist
    try {
      const placeholders = patientIds.map((_, i) => `$${i + 1}`).join(",");
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "patientId","emotion", COUNT(*)::int as cnt, MAX("createdAt") as last
         FROM "Prediction"
         WHERE "patientId" IN (${placeholders})
         GROUP BY "patientId","emotion"`,
        ...patientIds
      )) as Array<{ patientId: string; emotion: string; cnt: number; last: string | null }>;

      const byPatient = new Map<string, { NEGATIVE: number; NEUTRAL: number; POSITIVE: number; lastAt?: string | null }>();
      for (const pid of patientIds) byPatient.set(pid, { NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0, lastAt: null });
      const summary = { total: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0 } as Record<string, number> & { total: number };
      for (const r of rows) {
        const bucket = byPatient.get(r.patientId)!;
        const emo = (r.emotion || '').toUpperCase();
        if (emo in bucket) (bucket as any)[emo] += r.cnt;
        summary.total += r.cnt;
        if (emo in summary) (summary as any)[emo] += r.cnt;
        // Track last timestamp
        if (!bucket.lastAt || (r.last && new Date(r.last) > new Date(bucket.lastAt))) bucket.lastAt = r.last;
      }

      // Attach basic patient info
      const patients = await prisma.user.findMany({ where: { id: { in: patientIds } }, select: { id: true, name: true, email: true } });
      const perPatient = patients.map((p: { id: string; name: string | null; email: string }) => ({
        patient: p,
        NEGATIVE: byPatient.get(p.id)!.NEGATIVE,
        NEUTRAL: byPatient.get(p.id)!.NEUTRAL,
        POSITIVE: byPatient.get(p.id)!.POSITIVE,
        lastAt: byPatient.get(p.id)!.lastAt || null,
      }));

      return NextResponse.json({ summary, perPatient });
    } catch {
      return NextResponse.json({ summary: { total: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0 }, perPatient: [] });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
