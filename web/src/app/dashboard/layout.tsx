import PatientSidebar from "@/components/PatientSidebar";
import DashboardNavbar from "@/components/DashboardNavbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <PatientSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardNavbar />
        <main className="flex-1 bg-[var(--background)] p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
