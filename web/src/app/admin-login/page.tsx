"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("admin-credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.ok) {
        router.push("/admin");
      } else {
        setError(res?.error || "Invalid credentials");
      }
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={loading} className="w-full px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
      <div className="text-sm mt-3">
        Don&apos;t have an admin account? <a className="text-blue-600 underline" href="/admin-signup">Create one</a>
      </div>
    </div>
  );
}
