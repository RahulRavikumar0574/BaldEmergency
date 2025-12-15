import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Define a more specific type based on the query
type MeetingWithDoctor = {
  id: string;
  startTime: Date;
  endTime: Date;
  reason: string | null;
  doctor: {
    name: string | null;
  };
};

export default async function PatientDashboardPage() {
  const session = await auth();
  if (!session || (session.user as any).role !== "PATIENT") {
    redirect("/patient-login");
  }

  const meetings: MeetingWithDoctor[] = await prisma.meeting.findMany({
    where: {
      patientId: (session.user as any).id,
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
    include: { doctor: { select: { name: true } } },
  });

  const grouped = meetings.reduce((acc: Record<string, MeetingWithDoctor[]>, m) => {
    const date = m.startTime.toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(m);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Upcoming Meetings</h1>
      {Object.keys(grouped).length === 0 ? (
        <p>No upcoming meetings.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, meetings]) => (
            <div key={date}>
              <h2 className="font-semibold text-lg mb-2">{date}</h2>
              <ul className="space-y-2">
                {meetings.map((m) => (
                  <li key={m.id} className="p-3 rounded-lg border bg-gray-50">
                    <div className="font-semibold">
                      {m.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {m.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm text-gray-600">With Dr. {m.doctor.name}</div>
                    <div className="text-sm text-gray-500 mt-1">Reason: {m.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

