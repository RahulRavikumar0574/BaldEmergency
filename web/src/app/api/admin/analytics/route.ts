import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/analytics - global prediction aggregates
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    let summary = { total: 0, NEGATIVE: 0, NEUTRAL: 0, POSITIVE: 0 } as Record<string, number> & { total: number };
    try {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT "emotion", COUNT(*)::int AS cnt FROM "Prediction" GROUP BY "emotion"'
      )) as Array<{ emotion: string; cnt: number }>;
      for (const r of rows) {
        const e = (r.emotion || '').toUpperCase();
        summary.total += r.cnt;
        if (e in summary) (summary as any)[e] += r.cnt;
      }
    } catch {}

    // Users overview
    const usersByRole = await prisma.user.groupBy({ by: ['role'], _count: { role: true } }).catch(() => [] as any);
    const users = { PATIENT: 0, DOCTOR: 0, ADMIN: 0 } as Record<string, number>;
    for (const r of usersByRole as any[]) users[r.role] = r._count?.role || 0;

    return NextResponse.json({ summary, users });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
