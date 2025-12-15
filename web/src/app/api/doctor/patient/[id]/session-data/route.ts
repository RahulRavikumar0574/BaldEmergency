import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/doctor/patient/[id]/session-data
// Returns predictions (latest 50) and meetings (upcoming + last 20) for a specific patient, but only if the
// logged-in user is the patient's assigned doctor.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const patientId = id;
    if (!patientId) return NextResponse.json({ error: "Missing patient id" }, { status: 400 });

    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me || me.role !== "DOCTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Verify relationship
    const assigned = (await prisma.$queryRawUnsafe(
      'SELECT 1 FROM "Assignment" WHERE "patientId" = $1 AND "doctorId" = $2 LIMIT 1',
      patientId,
      me.id
    )) as Array<{ '?column?': number }>;
    if (!assigned?.length) return NextResponse.json({ error: "Not assigned" }, { status: 403 });

    // Patient basic info
    const patient = await prisma.user.findUnique({ where: { id: patientId }, select: { id: true, name: true, email: true } });

    // Predictions (best-effort if table exists)
    let predictions: Array<{ emotion: string; createdAt: string }> = [];
    try {
      predictions = (await prisma.$queryRawUnsafe(
        'SELECT "emotion","createdAt" FROM "Prediction" WHERE "patientId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
        patientId
      )) as Array<{ emotion: string; createdAt: string }>;
    } catch {}

    // Meetings including past recent and upcoming
    const upcoming = (await prisma.$queryRawUnsafe(
      'SELECT "id","startTime","endTime","reason","status" FROM "Meeting" WHERE "patientId" = $1 AND "doctorId" = $2 AND "endTime" >= NOW() ORDER BY "startTime" ASC',
      patientId,
      me.id
    )) as any[];
    const recent = (await prisma.$queryRawUnsafe(
      'SELECT "id","startTime","endTime","reason","status" FROM "Meeting" WHERE "patientId" = $1 AND "doctorId" = $2 AND "endTime" < NOW() ORDER BY "startTime" DESC LIMIT 20',
      patientId,
      me.id
    )) as any[];

    return NextResponse.json({ patient, predictions, meetings: { upcoming, recent } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
