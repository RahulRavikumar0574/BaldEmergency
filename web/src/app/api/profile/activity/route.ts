import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() }, select: { id: true } });
    if (!user) return NextResponse.json({ items: [] });

    // Best-effort query: only works if ActivityLog exists
    const items = await (prisma as any).activityLog?.findMany?.({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, action: true, details: true, createdAt: true },
    });
    return NextResponse.json({ items: items ?? [] });
  } catch (e) {
    return NextResponse.json({ items: [] });
  }
}
