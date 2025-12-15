import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/records/predictions
// Exports all Prediction rows as CSV with patient info
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    // Aggregate predictions per patient (no email) with counts of each emotion
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT p."patientId" AS "patientId",
              SUM(CASE WHEN UPPER(p."emotion") = 'NEGATIVE' THEN 1 ELSE 0 END)::int AS "negative",
              SUM(CASE WHEN UPPER(p."emotion") = 'NEUTRAL'  THEN 1 ELSE 0 END)::int AS "neutral",
              SUM(CASE WHEN UPPER(p."emotion") = 'POSITIVE' THEN 1 ELSE 0 END)::int AS "positive",
              COUNT(*)::int AS "total",
              MAX(p."createdAt") AS "lastAt"
         FROM "Prediction" p
         GROUP BY p."patientId"
         ORDER BY "total" DESC`
    )) as Array<{
      patientId: string;
      negative: number;
      neutral: number;
      positive: number;
      total: number;
      lastAt: Date | null;
    }>;

    const header = [
      'patient_id','negative_count','neutral_count','positive_count','total','last_prediction_at'
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
        esc(r.patientId),
        esc(r.negative),
        esc(r.neutral),
        esc(r.positive),
        esc(r.total),
        esc(r.lastAt ? (r.lastAt as any)?.toISOString?.() ?? r.lastAt : ''),
      ].join(','));
    }

    const csv = lines.join('\n');
    const filename = `predictions-aggregated-${new Date().toISOString().slice(0,10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return new NextResponse('Failed to export CSV (predictions)', { status: 500 });
  }
}
