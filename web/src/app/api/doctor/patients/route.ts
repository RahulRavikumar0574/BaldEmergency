import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/doctor/patients - list patients assigned to this doctor
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const me = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true, role: true } });
    if (!me || me.role !== "DOCTOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const assigns = (await prisma.$queryRawUnsafe(
      'SELECT "patientId" FROM "Assignment" WHERE "doctorId" = $1',
      me.id
    )) as Array<{ patientId: string }>;

    const ids = assigns.map((a) => a.patientId);
    if (ids.length === 0) return NextResponse.json({ patients: [] });

    const patients = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, rollNo: true, instituteName: true },
    });

    return NextResponse.json({ patients });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
