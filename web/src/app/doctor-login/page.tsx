"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DoctorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("doctor-credentials", {
      email,
      employeeId,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.ok) {
      router.push("/doctor/scheduler");
    } else {
      setError(res?.error || "Invalid credentials");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-semibold mb-1">Doctor Login</h1>
        <p className="text-sm text-[var(--color-foreground)]/70 mb-4">
          Doctors, sign in with your institute email and employee ID.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2 bg-white/80 dark:bg-black/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Employee ID</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 bg-white/80 dark:bg-black/20"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2 bg-white/80 dark:bg-black/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded py-2 disabled:opacity-60 bg-[var(--color-primary)] text-white hover:opacity-90 transition"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
