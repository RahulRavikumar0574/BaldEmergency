"use client";

import { useEffect, useMemo, useState } from "react";

type Meeting = {
  id: string;
  patientId: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  reason: string;
  status: string;
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function fmtDateKey(d: Date) { return startOfDay(d).toISOString().slice(0,10); }

export default function PatientMeetingsPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch all my meetings
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch("/api/meetings", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load meetings");
        setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
      } catch (e: any) {
        setError(e.message || "Failed to load meetings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Calendar grid for the current cursor month
  const { monthLabel, weeks, map } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay(); // 0 Sun ... 6 Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = first.toLocaleString(undefined, { month: "long", year: "numeric" });

    // map meetings by date key (YYYY-MM-DD)
    const mm = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const dkey = fmtDateKey(new Date(m.startTime));
      const arr = mm.get(dkey) || [];
      arr.push(m);
      mm.set(dkey, arr);
    }

    const cells: Array<{ date: Date | null }>[] = [];
    let day = 1;
    for (let w = 0; w < 6; w++) {
      const week: Array<{ date: Date | null }> = [];
      for (let wd = 0; wd < 7; wd++) {
        const idx = w * 7 + wd;
        const inMonth = idx >= startWeekday && day <= daysInMonth;
        if (inMonth) {
          week.push({ date: new Date(year, month, day++) });
        } else {
          week.push({ date: null });
        }
      }
      cells.push(week);
      if (day > daysInMonth) break;
    }
    return { monthLabel, weeks: cells, map: mm };
  }, [cursor, meetings]);

  const onPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const onNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-4">My Meetings</h1>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <div className="rounded-xl border bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onPrev} className="px-3 py-1 border rounded">←</button>
          <div className="font-semibold">{monthLabel}</div>
          <button onClick={onNext} className="px-3 py-1 border rounded">→</button>
        </div>

        <div className="grid grid-cols-7 text-xs font-medium text-[var(--color-foreground)]/70 mb-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="p-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-rows-6 gap-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell, di) => {
                const date = cell.date;
                const dkey = date ? fmtDateKey(date) : "";
                const dayMeetings = date ? (map.get(dkey) || []) : [];
                const isToday = date && fmtDateKey(date) === fmtDateKey(new Date());
                const isSelected = selectedDate && date && dkey === selectedDate;
                return (
                  <button
                    key={di}
                    className={`h-24 rounded border text-left p-1 overflow-hidden ${isSelected ? 'ring-2 ring-[var(--color-primary)]' : ''} ${isToday ? 'bg-white/50 dark:bg-black/20' : ''}`}
                    onClick={() => date && setSelectedDate(dkey)}
                    disabled={!date}
                    title={dayMeetings.map(m => m.reason).join('\n')}
                  >
                    <div className="text-[10px] opacity-70 text-right">{date ? date.getDate() : ''}</div>
                    <div className="space-y-1">
                      {dayMeetings.slice(0,3).map((m) => (
                        <div key={m.id} className="truncate text-[10px] px-1 py-0.5 rounded bg-teal-500 text-white" title={`${new Date(m.startTime).toLocaleTimeString()} - ${m.reason}`}>
                          {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {m.reason}
                        </div>
                      ))}
                      {dayMeetings.length > 3 && (
                        <div className="text-[10px] opacity-70">+{dayMeetings.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected day details */}
      <div className="mt-4">
        {selectedDate && (
          <div className="rounded border p-3 bg-[var(--color-surface)]">
            <div className="font-medium mb-2">Meetings on {new Date(selectedDate).toLocaleDateString()}</div>
            <ul className="space-y-2 text-sm">
              {(map.get(selectedDate) || []).map((m) => (
                <li key={m.id} className="p-2 rounded border">
                  <div className="font-medium">{new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(m.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="opacity-80">{m.reason}</div>
                  <div className="text-xs opacity-60 mt-1">Status: {m.status}</div>
                </li>
              ))}
              {(map.get(selectedDate) || []).length === 0 && (
                <li className="text-sm opacity-70">No meetings.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {loading && <p className="text-sm mt-3">Loading meetings…</p>}
    </div>
  );
}

