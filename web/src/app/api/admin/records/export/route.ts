import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/records/export
// Exports all Meeting records as CSV with patient & doctor info
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT m."id", m."patientId", m."doctorId", m."startTime", m."endTime", m."reason", m."status", m."createdAt",
              (SELECT u."name"  FROM "User" u WHERE u."id" = m."patientId")   AS "patientName",
              (SELECT u."email" FROM "User" u WHERE u."id" = m."patientId")   AS "patientEmail",
              (SELECT u."name"  FROM "User" u WHERE u."id" = m."doctorId") AS "doctorName",
              (SELECT u."email" FROM "User" u WHERE u."id" = m."doctorId") AS "doctorEmail"
         FROM "Meeting" m
         ORDER BY m."startTime" DESC`
    )) as Array<{
      id: string;
      patientId: string; doctorId: string;
      startTime: Date; endTime: Date; reason: string | null; status: string; createdAt: Date;
      patientName: string | null; patientEmail: string | null;
      doctorName: string | null; doctorEmail: string | null;
    }>;

    const header = [
      'meeting_id','patient_email','doctor_id','doctor_name','doctor_email','start_time','end_time','reason','status','created_at'
    ];

    function esc(v: any): string {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      if (/[",\n]/.test(s)) return '"' + s + '"';
      return s;
    }

    const lines: string[] = [];
    lines.push(header.join(','));
    for (const r of rows) {
      lines.push([
        esc(r.id),
        esc(r.patientEmail ?? ''),
        esc(r.doctorId),
        esc(r.doctorName ?? ''),
        esc(r.doctorEmail ?? ''),
        esc(r.startTime?.toISOString?.() ?? r.startTime),
        esc(r.endTime?.toISOString?.() ?? r.endTime),
        esc(r.reason ?? ''),
        esc(r.status),
        esc(r.createdAt?.toISOString?.() ?? r.createdAt),
      ].join(','));
    }

    const csv = lines.join('\n');
    const filename = `meetings-export-${new Date().toISOString().slice(0,10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return new NextResponse('Failed to export CSV', { status: 500 });
  }
}
