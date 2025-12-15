import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { currentPassword, newPassword, confirmPassword } = body as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Best-effort log
  try {
    await (prisma as any).activityLog?.create?.({
      data: {
        userId: updated.id,
        action: "PASSWORD_CHANGED",
        details: JSON.stringify({ at: new Date().toISOString() }),
      },
    });
  } catch {}

  return NextResponse.json({ success: true });
}
