import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/flags - global patients with NEGATIVE streak >= 3
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    // All patient IDs
    const patients = await prisma.user.findMany({ where: { role: "PATIENT" }, select: { id: true, name: true, email: true } });

    const items: Array<{ patient: { id: string; name: string | null; email: string }, streak: number; lastAt: string | null }> = [];
    for (const p of patients) {
      try {
        const rows = (await prisma.$queryRawUnsafe(
          'SELECT "emotion","createdAt" FROM "Prediction" WHERE "patientId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
          p.id
        )) as Array<{ emotion: string; createdAt: string }>;
        let streak = 0;
        for (const r of rows) {
          if ((r.emotion || '').toUpperCase() === 'NEGATIVE') streak++; else break;
        }
        const lastAt = rows[0]?.createdAt || null;
        if (streak >= 3) items.push({ patient: p, streak, lastAt });
      } catch {
        // ignore missing Prediction table
      }
    }
    items.sort((a, b) => (b.streak - a.streak) || (new Date(b.lastAt || 0).getTime() - new Date(a.lastAt || 0).getTime()));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
