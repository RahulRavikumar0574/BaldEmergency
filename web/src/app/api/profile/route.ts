import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
    });

    return NextResponse.json({ user });
  } catch (e: any) {
    console.error("/api/profile GET error", e);
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, gender, age, height, weight, specialCondition, address, shareReports, profileImageUrl } = body as {
      name?: string;
      gender?: "MALE" | "FEMALE" | "OTHER" | null;
      age?: number | null;
      height?: number | null;
      weight?: number | null;
      specialCondition?: string | null;
      address?: string | null;
      shareReports?: boolean | null;
      profileImageUrl?: string | null;
    };

    const updatedUser = await prisma.user.update({
      where: { email: session.user.email.toLowerCase() },
      data: {
        name: name ?? undefined,
        gender: gender ?? undefined,
        age: age ?? undefined,
        height: height ?? undefined,
        weight: weight ?? undefined,
        specialCondition: specialCondition ?? undefined,
        address: address ?? undefined,
        shareReports: shareReports ?? undefined,
        profileImageUrl: profileImageUrl ?? undefined,
      },
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        id: randomUUID(),
        userId: updatedUser.id,
        action: "PROFILE_UPDATED",
        details: JSON.stringify(body),
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (e) {
    console.error("/api/profile PUT error", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
  }
}

