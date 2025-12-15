import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users?role=STUDENT|COUNSELLOR|ADMIN
export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const r = searchParams.get("role");
  try {
    const users = await prisma.user.findMany({
      where: r ? { role: r as any } : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        rollNo: true,
        instituteName: true,
        profileImageUrl: true,
        phone: true,
        shareReports: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}
