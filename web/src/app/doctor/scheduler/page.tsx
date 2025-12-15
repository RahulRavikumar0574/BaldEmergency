"use client";

import { useState } from "react";

export default function DoctorSchedulerPage() {
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string }>>([
    { startTime: "", endTime: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onAddRow = () => setSlots((s) => [...s, { startTime: "", endTime: "" }]);
  const onChange = (idx: number, key: "startTime" | "endTime", value: string) => {
    setSlots((s) => s.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };
  const onRemove = (idx: number) => setSlots((s) => s.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const valid = slots.filter((r) => r.startTime && r.endTime);
      if (valid.length === 0) throw new Error("Add at least one slot");
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save availability");
      setSuccess("Availability saved.");
    } catch (e: any) {
      setError(e.message || "Failed to save availability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Scheduler</h1>
      <p className="text-sm text-[var(--color-foreground)]/70">Set the time slots when patients can book with you.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          {slots.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="datetime-local"
                value={row.startTime}
                onChange={(e) => onChange(idx, "startTime", e.target.value)}
                className="border rounded px-2 py-1"
              />
              <span>to</span>
              <input
                type="datetime-local"
                value={row.endTime}
                onChange={(e) => onChange(idx, "endTime", e.target.value)}
                className="border rounded px-2 py-1"
              />
              <button type="button" className="text-red-600 text-sm" onClick={() => onRemove(idx)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onAddRow} className="px-3 py-2 border rounded">Add slot</button>
          <button type="submit" className="px-3 py-2 rounded bg-[var(--color-primary)] text-white" disabled={loading}>
            {loading ? "Saving..." : "Save availability"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}
      </form>
    </div>
  );
}
