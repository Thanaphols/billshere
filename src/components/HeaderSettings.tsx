"use client";

import React, { useTransition } from "react";
import { updateAppSettings } from "@/actions/profile";
import { type Lang } from "@/lib/i18n-dict";

export default function HeaderSettings({
  initialLang,
  initialTheme,
  userName,
}: {
  initialLang: Lang;
  initialTheme: "green" | "blue";
  userName: string;
}) {
  const [isPending, startTransition] = useTransition();

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
    <div className="flex items-center gap-2.5">
      {/* User Name */}
      <span className="text-xs font-semibold text-muted max-w-[100px] truncate">
        {userName}
      </span>

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
  );
}
