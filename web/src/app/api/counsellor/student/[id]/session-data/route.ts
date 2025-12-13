import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/counsellor/student/[id]/session-data
// Returns predictions (latest 50) and meetings (upcoming + last 20) for a specific student, but only if the
// logged-in user is the student's assigned counsellor.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const studentId = id;
    if (!studentId) return NextResponse.json({ error: "Missing student id" }, { status: 400 });

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me || me.role !== "COUNSELLOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify relationship
    const assigned = (await prisma.$queryRawUnsafe(
      'SELECT 1 FROM "Assignment" WHERE "studentId" = $1 AND "counsellorId" = $2 LIMIT 1',
      studentId,
      me.id
    )) as Array<{ '?column?': number }>;
    if (!assigned?.length) return NextResponse.json({ error: "Not assigned" }, { status: 403 });

    // Student basic info
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, email: true } });

    // Predictions (best-effort if table exists)
    let predictions: Array<{ emotion: string; createdAt: string }> = [];
    try {
      predictions = (await prisma.$queryRawUnsafe(
        'SELECT "emotion","createdAt" FROM "Prediction" WHERE "studentId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
        studentId
      )) as Array<{ emotion: string; createdAt: string }>;
    } catch {}

    // Meetings including past recent and upcoming
    const upcoming = (await prisma.$queryRawUnsafe(
      'SELECT "id","startTime","endTime","reason","status" FROM "Meeting" WHERE "studentId" = $1 AND "counsellorId" = $2 AND "endTime" >= NOW() ORDER BY "startTime" ASC',
      studentId,
      me.id
    )) as any[];
    const recent = (await prisma.$queryRawUnsafe(
      'SELECT "id","startTime","endTime","reason","status" FROM "Meeting" WHERE "studentId" = $1 AND "counsellorId" = $2 AND "endTime" < NOW() ORDER BY "startTime" DESC LIMIT 20',
      studentId,
      me.id
    )) as any[];

    return NextResponse.json({ student, predictions, meetings: { upcoming, recent } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
