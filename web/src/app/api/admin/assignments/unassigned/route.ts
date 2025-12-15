import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/assignments/unassigned - list patients without an assignment
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const rows = (await prisma.$queryRawUnsafe(
      'SELECT u."id", u."name", u."email", u."rollNo", u."instituteName"\
       FROM "User" u\
       LEFT JOIN "Assignment" a ON a."patientId" = u."id"\
       WHERE u."role"::text = $1 AND a."patientId" IS NULL\
       ORDER BY u."createdAt" DESC\
       LIMIT 500',
      'PATIENT'
    )) as Array<{ id: string; name: string | null; email: string; rollNo: string | null; instituteName: string | null }>;
    return NextResponse.json({ patients: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
