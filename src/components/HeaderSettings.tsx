"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { updateAppSettings } from "@/actions/profile";
import { t, type Lang } from "@/lib/i18n-dict";

export default function HeaderSettings({
  initialLang,
  initialTheme,
  userName,
}: {
  initialLang: Lang;
  initialTheme: "green" | "blue";
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggleLang = () => {
    const nextLang: Lang = initialLang === "th" ? "en" : "th";
    startTransition(async () => {
      await updateAppSettings(nextLang, initialTheme);
    });
  };

  const toggleTheme = () => {
    const nextTheme = initialTheme === "green" ? "blue" : "green";
    startTransition(async () => {
      await updateAppSettings(initialLang, nextTheme);
    });
  };

  return (
    <div ref={ref} className="relative flex items-center gap-2.5">
      {/* User Name */}
      <span className="text-xs font-semibold text-muted max-w-[100px] truncate">
        {userName}
      </span>

      {/* Gear */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("settings.title", initialLang)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted transition hover:bg-muted/10 hover:text-brand active:scale-[.93]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.431l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {/* Dropdown with the original toggles */}
      {open && (
        <div className="absolute right-0 top-10 z-50 flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2.5 shadow-lg animate-fade-in">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            disabled={isPending}
            className="rounded-xl border border-border bg-background px-2 py-1 text-[10px] font-extrabold text-foreground hover:bg-muted/10 transition active:scale-[.93] disabled:opacity-50 select-none cursor-pointer flex items-center justify-center w-8 h-8 shrink-0"
          >
            {initialLang === "th" ? "TH" : "EN"}
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            disabled={isPending}
            className="relative w-8 h-8 rounded-full border border-border bg-background hover:bg-muted/10 transition active:scale-[.93] disabled:opacity-50 flex items-center justify-center cursor-pointer select-none shrink-0"
          >
            <span
              className={`w-3.5 h-3.5 rounded-full transition shadow-xs ${
                initialTheme === "green" ? "bg-green-600" : "bg-blue-600"
              }`}
            />
            {isPending && (
              <span className="absolute inset-0 rounded-full border-2 border-t-brand border-transparent animate-spin" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
