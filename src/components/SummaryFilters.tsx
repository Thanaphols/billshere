"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "daily" | "monthly" | "yearly";

/** Query bar for the summary report — updates the URL live (debounced search),
 * so filtering feels instant instead of a form submit + reload. */
export default function SummaryFilters({
  mode,
  initialDate,
  initialQ,
  dailyDefault,
  monthlyDefault,
  yearlyDefault,
  lang,
  placeholder,
}: {
  mode: Mode;
  initialDate: string;
  initialQ: string;
  dailyDefault: string;
  monthlyDefault: string;
  yearlyDefault: string;
  lang: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [q, setQ] = useState(initialQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync when the server sends new props (e.g. after navigation).
  useEffect(() => setDate(initialDate), [initialDate]);
  useEffect(() => setQ(initialQ), [initialQ]);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const go = (m: Mode, d: string, query: string) => {
    const params = new URLSearchParams({ mode: m, date: d, q: query });
    router.replace(`/summary?${params.toString()}`, { scroll: false });
  };

  const switchMode = (m: Mode) => {
    const d = m === "daily" ? dailyDefault : m === "monthly" ? monthlyDefault : yearlyDefault;
    go(m, d, q);
  };

  const onDate = (v: string) => {
    setDate(v);
    go(mode, v, q);
  };

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(mode, date, v), 350);
  };

  const pill = (m: Mode, label: string) =>
    `flex-1 py-2 text-center rounded-lg transition-all ${
      mode === m ? "bg-white shadow-xs text-brand" : "text-muted font-semibold"
    }`;

  const dateCls =
    "rounded-xl border border-border bg-white px-2.5 py-2.5 text-xs outline-none focus:border-brand flex-1 min-w-0";

  return (
    <div className="space-y-3 bg-surface p-4 rounded-2xl shadow-xs">
      {/* Mode pills */}
      <div className="flex rounded-xl border border-border p-0.5 bg-background text-[11px] font-bold w-full">
        <button type="button" onClick={() => switchMode("daily")} className={pill("daily", "")}>
          {lang === "th" ? "รายวัน" : "Daily"}
        </button>
        <button type="button" onClick={() => switchMode("monthly")} className={pill("monthly", "")}>
          {lang === "th" ? "รายเดือน" : "Monthly"}
        </button>
        <button type="button" onClick={() => switchMode("yearly")} className={pill("yearly", "")}>
          {lang === "th" ? "รายปี" : "Yearly"}
        </button>
      </div>

      {/* Date + live search */}
      <div className="flex gap-2">
        {mode === "daily" && (
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} className={dateCls} />
        )}
        {mode === "monthly" && (
          <input type="month" value={date} onChange={(e) => onDate(e.target.value)} className={dateCls} />
        )}
        {mode === "yearly" && (
          <input
            type="number"
            value={date}
            onChange={(e) => onDate(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            min="2000"
            max="2100"
            placeholder="YYYY"
            className={`no-spinner ${dateCls} font-bold text-center text-sm`}
          />
        )}

        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-[1.8] rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand text-sm min-w-0"
        />
      </div>
    </div>
  );
}
