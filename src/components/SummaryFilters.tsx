"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

type Mode = "daily" | "monthly" | "yearly";

/** Query bar for the summary report — updates the URL live (debounced search),
 * so filtering feels instant instead of a form submit + reload. */
export default function SummaryFilters({
  mode,
  initialDate,
  initialTo,
  initialQ,
  dailyDefault,
  monthlyDefault,
  yearlyDefault,
  lang,
  placeholder,
}: {
  mode: Mode;
  initialDate: string;
  initialTo: string;
  initialQ: string;
  dailyDefault: string;
  monthlyDefault: string;
  yearlyDefault: string;
  lang: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [to, setTo] = useState(initialTo);
  const [q, setQ] = useState(initialQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync when the server sends new props (e.g. after navigation).
  useEffect(() => setDate(initialDate), [initialDate]);
  useEffect(() => setTo(initialTo), [initialTo]);
  useEffect(() => setQ(initialQ), [initialQ]);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const go = (m: Mode, d: string, toV: string, query: string) => {
    const params = new URLSearchParams({ mode: m, date: d, q: query });
    if (toV && toV !== d) params.set("to", toV);
    router.replace(`/summary?${params.toString()}`, { scroll: false });
  };

  const switchMode = (m: Mode) => {
    const d = m === "daily" ? dailyDefault : m === "monthly" ? monthlyDefault : yearlyDefault;
    setTo("");
    go(m, d, "", q);
  };

  const onDate = (from: string, toV: string) => {
    setDate(from);
    setTo(toV);
    go(mode, from, toV, q);
  };

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(mode, date, to, v), 350);
  };

  const pill = (m: Mode) =>
    `flex-1 py-2 text-center rounded-lg transition-all ${
      mode === m ? "bg-white shadow-xs text-brand" : "text-muted font-semibold"
    }`;

  return (
    <div className="space-y-3 bg-surface p-4 rounded-2xl shadow-xs">
      {/* Mode pills */}
      <div className="flex rounded-xl border border-border p-0.5 bg-background text-[11px] font-bold w-full">
        <button type="button" onClick={() => switchMode("daily")} className={pill("daily")}>
          {lang === "th" ? "รายวัน" : "Daily"}
        </button>
        <button type="button" onClick={() => switchMode("monthly")} className={pill("monthly")}>
          {lang === "th" ? "รายเดือน" : "Monthly"}
        </button>
        <button type="button" onClick={() => switchMode("yearly")} className={pill("yearly")}>
          {lang === "th" ? "รายปี" : "Yearly"}
        </button>
      </div>

      {/* Date + live search */}
      <div className="flex gap-2">
        <DatePicker mode={mode} value={date} valueTo={to} lang={lang} onChange={onDate} />
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

/** Custom localized range picker. The native date/month popup renders in the
 * browser UI locale (not the element lang), so a Thai calendar isn't achievable
 * with a native <input>. This popover draws its own grid using Intl — Thai
 * (Buddhist-era) or English labels — and lets you pick a range: first click sets
 * the start, second click sets the end. Values (URL, comparisons) stay Gregorian.
 * Every value format (YYYY-MM-DD / YYYY-MM / YYYY) is fixed-width, so range math
 * is plain lexicographic string comparison — no Date arithmetic needed. */
function DatePicker({
  mode,
  value,
  valueTo,
  lang,
  onChange,
}: {
  mode: Mode;
  value: string;
  valueTo: string;
  lang: string;
  onChange: (from: string, to: string) => void;
}) {
  const localeTag = lang === "en" ? "en-GB" : "th-TH-u-ca-buddhist";
  const showY = (y: number) => (lang === "en" ? y : y + 543);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const parsed = value.split("-").map(Number);
  const now = new Date();
  const [viewY, setViewY] = useState(parsed[0] || now.getFullYear());
  const [viewM, setViewM] = useState((parsed[1] || now.getMonth() + 1) - 1);
  const [decade, setDecade] = useState(Math.floor((parsed[0] || now.getFullYear()) / 12) * 12);

  // Range selection by drag: press a cell to anchor, drag across cells to extend,
  // release to apply. A plain tap (down + up on one cell) = a single day/month/year.
  const [range, setRange] = useState({ from: value, to: valueTo || value });
  const rangeRef = useRef(range);
  const anchorRef = useRef<string | null>(null);
  const setRng = (r: { from: string; to: string }) => {
    rangeRef.current = r;
    setRange(r);
  };
  useEffect(() => setRng({ from: value, to: valueTo || value }), [value, valueTo]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {
        setOpen(false);
        anchorRef.current = null;
        setRng({ from: value, to: valueTo || value });
      }
    };
    // Finish the drag even if the pointer is released outside the grid.
    const onUp = () => finishDrag();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, valueTo]);

  // The value under the pointer — a grid cell carries its value in data-val.
  const valAt = (x: number, y: number): string | null =>
    (document.elementFromPoint(x, y)?.closest("[data-val]") as HTMLElement | null)?.dataset.val ?? null;

  const startDrag = (v: string) => {
    anchorRef.current = v;
    setRng({ from: v, to: v });
  };
  const moveDrag = (v: string | null) => {
    const a = anchorRef.current;
    if (!a || !v) return;
    setRng(a <= v ? { from: a, to: v } : { from: v, to: a });
  };
  const finishDrag = () => {
    if (!anchorRef.current) return;
    anchorRef.current = null;
    const r = rangeRef.current;
    onChange(r.from, r.to);
    setOpen(false);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthLong = (y: number, m: number) =>
    new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric" }).format(new Date(y, m, 1));
  const monthShort = (m: number) =>
    new Intl.DateTimeFormat(localeTag, { month: "short" }).format(new Date(2000, m, 1));
  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "narrow" }).format(new Date(2000, 0, 2 + d)),
  );

  const labelOf = (v: string): string => {
    if (mode === "yearly") return String(showY(Number(v)));
    const p = v.split("-").map(Number);
    if (mode === "monthly") return monthLong(p[0], (p[1] || 1) - 1);
    const d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return v;
    return new Intl.DateTimeFormat(localeTag, { day: "numeric", month: "long", year: "numeric" }).format(d);
  };

  const label = (): string => {
    if (!value) return lang === "en" ? "Select date" : "เลือกวันที่";
    return valueTo && valueTo !== value ? `${labelOf(value)} – ${labelOf(valueTo)}` : labelOf(value);
  };

  // Pointer handlers for the cell container — hit-test by coordinate so a single
  // drag works for both mouse and touch (touch doesn't fire enter/leave reliably).
  const gridProps = {
    style: { touchAction: "none" as const },
    onPointerDown: (e: ReactPointerEvent) => {
      const v = valAt(e.clientX, e.clientY);
      if (v) {
        e.preventDefault();
        startDrag(v);
      }
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (anchorRef.current) moveDrag(valAt(e.clientX, e.clientY));
    },
  };

  const inRange = (v: string) => range.from && v >= range.from && v <= range.to;
  const cell = "h-9 w-9 rounded-lg text-sm flex items-center justify-center transition-colors";
  const cls = (v: string) => `${cell} ${inRange(v) ? "bg-brand text-white" : "hover:bg-background"}`;
  const cellBox = (v: string) => `h-10 rounded-lg text-sm ${inRange(v) ? "bg-brand text-white" : "hover:bg-background"}`;

  const grid = () => {
    if (mode === "yearly") {
      return (
        <>
          <div className="flex items-center justify-between mb-2">
            <NavBtn dir="prev" onClick={() => setDecade((d) => d - 12)} />
            <span className="font-bold text-sm">{showY(decade)}–{showY(decade + 11)}</span>
            <NavBtn dir="next" onClick={() => setDecade((d) => d + 12)} />
          </div>
          <div className="grid grid-cols-4 gap-1" {...gridProps}>
            {Array.from({ length: 12 }, (_, i) => decade + i).map((y) => (
              <button key={y} type="button" data-val={y} className={cellBox(String(y))}>
                {showY(y)}
              </button>
            ))}
          </div>
        </>
      );
    }
    if (mode === "monthly") {
      return (
        <>
          <div className="flex items-center justify-between mb-2">
            <NavBtn dir="prev" onClick={() => setViewY((y) => y - 1)} />
            <span className="font-bold text-sm">{showY(viewY)}</span>
            <NavBtn dir="next" onClick={() => setViewY((y) => y + 1)} />
          </div>
          <div className="grid grid-cols-3 gap-1" {...gridProps}>
            {Array.from({ length: 12 }, (_, m) => {
              const v = `${viewY}-${pad(m + 1)}`;
              return (
                <button key={m} type="button" data-val={v} className={cellBox(v)}>
                  {monthShort(m)}
                </button>
              );
            })}
          </div>
        </>
      );
    }
    // daily
    const first = new Date(viewY, viewM, 1).getDay();
    const days = new Date(viewY, viewM + 1, 0).getDate();
    return (
      <>
        <div className="flex items-center justify-between mb-2">
          <NavBtn
            dir="prev"
            onClick={() => (viewM === 0 ? (setViewM(11), setViewY((y) => y - 1)) : setViewM((m) => m - 1))}
          />
          <span className="font-bold text-sm">{monthLong(viewY, viewM)}</span>
          <NavBtn
            dir="next"
            onClick={() => (viewM === 11 ? (setViewM(0), setViewY((y) => y + 1)) : setViewM((m) => m + 1))}
          />
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted mb-1">
          {weekdays.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5" {...gridProps}>
          {Array.from({ length: first }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
            const v = `${viewY}-${pad(viewM + 1)}-${pad(d)}`;
            return (
              <button key={d} type="button" data-val={v} className={cls(v)}>
                {d}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div ref={box} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl border border-border bg-white px-2.5 py-2.5 text-xs flex items-center gap-1.5 outline-none focus:border-brand"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 text-muted">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <span className="truncate font-medium text-foreground">{label()}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-72 max-w-[85vw] rounded-xl border border-border bg-white p-3 shadow-lg">
          <p className="text-[10px] text-muted mb-2">
            {lang === "en" ? "Tap one, or drag to select a range" : "แตะเลือกวันเดียว หรือลากคลุมเป็นช่วง"}
          </p>
          {grid()}
        </div>
      )}
    </div>
  );
}

function NavBtn({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-8 w-8 rounded-lg hover:bg-background flex items-center justify-center text-muted">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d={dir === "prev" ? "M15.75 19.5 8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} />
      </svg>
    </button>
  );
}
