import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DoctorSidebar from "@/components/DoctorSidebar";
import DashboardNavbar from "@/components/DashboardNavbar";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || role !== "DOCTOR") {
    redirect("/doctor-login");
  }
  return (
    <div className="flex min-h-screen">
      <DoctorSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardNavbar />
        <main className="flex-1 bg-[var(--background)] p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
