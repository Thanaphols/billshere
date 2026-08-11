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

  // Native date/month inputs render their value in the browser locale (not the app
  // language), so we overlay our own localized label and keep the native input
  // transparent on top purely as the picker trigger. Gregorian year, Thai month.
  const localeTag = lang === "en" ? "en-GB" : "th-TH-u-ca-gregory";
  const fmtDate = (): string => {
    if (!date) return lang === "en" ? "Select date" : "เลือกวันที่";
    if (mode === "monthly") {
      const [y, m] = date.split("-").map(Number);
      if (!y || !m) return date;
      return new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
    }
    const d = new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return date;
    return new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "long", year: "numeric" }).format(d);
  };

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
        {(mode === "daily" || mode === "monthly") && (
          <div className={`relative flex items-center gap-1.5 cursor-pointer ${dateCls}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 text-muted">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="truncate font-medium text-foreground">{fmtDate()}</span>
            <input
              type={mode === "monthly" ? "month" : "date"}
              value={date}
              onChange={(e) => onDate(e.target.value)}
              aria-label={lang === "en" ? "Pick date" : "เลือกวันที่"}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            />
          </div>
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
