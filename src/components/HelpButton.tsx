"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n-dict";

/** Header "?" that opens a bottom sheet explaining how to use the app. */
export default function HelpButton({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const steps = [t("onboard.step1", lang), t("onboard.step2", lang), t("onboard.step3", lang)];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("help.aria", lang)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-muted transition hover:bg-muted/10 hover:text-brand active:scale-[.93]"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl border border-border animate-fade-in space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm font-bold text-foreground">{t("help.title", lang)}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-muted hover:text-foreground"
              >
                {t("close", lang)}
              </button>
            </div>

            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground/90">{s}</span>
                </li>
              ))}
            </ol>

            <p className="rounded-xl bg-brand/5 px-3 py-2 text-xs text-muted">
              💡 {t("help.tip.fees", lang)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
