import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { randomUUID } from "crypto";

// POST /api/admin/assign-random
// Assign all unassigned PATIENTs to random DOCTORs (best-effort).
export async function POST() {
  // Optional: require ADMIN; comment out if you want to allow local testing without admin
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && process.env.NODE_ENV === "production")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const doctors = await prisma.user.findMany({ where: { role: Role.DOCTOR }, select: { id: true } });
    if (doctors.length === 0) return NextResponse.json({ updated: 0, message: "No doctors found" });

    const patients = (await prisma.$queryRawUnsafe(
      'SELECT u."id" FROM "User" u LEFT JOIN "Assignment" a ON a."patientId" = u."id" WHERE u."role" = $1 AND a."patientId" IS NULL',
      "PATIENT"
    )) as Array<{ id: string }>;

    let updated = 0;
    for (const p of patients) {
      const pick = doctors[Math.floor(Math.random() * doctors.length)];
      try {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "Assignment" ("id","patientId","doctorId") VALUES ($1,$2,$3) ON CONFLICT ("patientId") DO NOTHING',
          randomUUID(),
          p.id,
          pick.id
        );
        updated++;
      } catch {
        // ignore and continue
      }
    }
    return NextResponse.json({ updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to assign" }, { status: 500 });
  }
}
