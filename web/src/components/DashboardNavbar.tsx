"use client";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function DashboardNavbar() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userName = session?.user?.name || (role === 'DOCTOR' ? 'Doctor' : 'Patient');
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as
      | "light"
      | "dark"
      | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <nav className="w-full flex items-center justify-between bg-[var(--color-surface)] border-b border-gray-200 dark:border-gray-700 px-6 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[var(--color-primary)] text-xl">🎓</span>
        <span className="font-semibold text-[var(--color-primary)] text-lg">{userName}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="px-3 py-2 rounded border border-transparent hover:border-[var(--color-primary)] text-sm"
          title="Toggle theme"
        >
          {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="bg-[var(--color-primary)] text-white px-4 py-2 rounded font-medium hover:opacity-90 transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
