import Link from "next/link";
import { t, type Lang } from "@/lib/i18n-dict";

/** First-run guide shown in place of the owned-bills empty text. */
export default function EmptyBillGuide({ lang }: { lang: Lang }) {
  const steps = [
    { n: "1", text: t("onboard.step1", lang) },
    { n: "2", text: t("onboard.step2", lang) },
    { n: "3", text: t("onboard.step3", lang) },
  ];
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm space-y-4">
      <p className="text-sm font-semibold text-foreground">{t("onboard.title", lang)}</p>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
              {s.n}
            </span>
            <span className="text-sm text-foreground/90">{s.text}</span>
          </li>
        ))}
      </ol>
      <Link
        href="/posts/new"
        className="block w-full rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white transition active:scale-[.98]"
      >
        + {t("onboard.cta", lang)}
      </Link>
    </div>
  );
}
