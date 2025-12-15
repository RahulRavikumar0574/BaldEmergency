import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/assignments
// - If caller is PATIENT: returns their assigned doctor's basic info
// - If caller is DOCTOR: returns list of assigned patients' basic info
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (me.role === "PATIENT") {
      const rows = (await prisma.$queryRawUnsafe(
        'SELECT "doctorId" FROM "Assignment" WHERE "patientId" = $1 LIMIT 1',
        me.id
      )) as Array<{ doctorId: string }>;
      const assign = rows?.[0];
      if (!assign) return NextResponse.json({ doctor: null });
      const doctor = await prisma.user.findUnique({ where: { id: assign.doctorId }, select: { id: true, name: true, email: true, rollNo: true, instituteName: true } });
      return NextResponse.json({ doctor });
    }
    if (me.role === "DOCTOR") {
      const assigns = (await prisma.$queryRawUnsafe(
        'SELECT "patientId" FROM "Assignment" WHERE "doctorId" = $1',
        me.id
      )) as Array<{ patientId: string }>;
      const patients: any[] = [];
      for (const a of assigns || []) {
        const p = await prisma.user.findUnique({ where: { id: a.patientId }, select: { id: true, name: true, email: true, rollNo: true, instituteName: true } });
        if (p) patients.push(p);
      }
      return NextResponse.json({ patients });
    }
    return NextResponse.json({});
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load assignments" }, { status: 500 });
  }
}
