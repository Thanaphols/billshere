import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { baht } from "@/lib/format";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n-dict";
import LiveRefresh from "@/components/LiveRefresh";
import SummaryFilters from "@/components/SummaryFilters";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Range for the selected view. `toParam` (optional) extends the window to a
 * span: start of the first unit → start of the unit after the last. Absent or
 * equal `toParam` = a single day/month/year. */
function getRange(mode: string, dateParam?: string, toParam?: string) {
  const now = new Date();

  if (mode === "yearly") {
    const py = (s?: string) => (s && /^\d{4}$/.test(s) ? Number(s) : null);
    let y0 = py(dateParam) ?? now.getFullYear();
    let y1 = py(toParam) ?? y0;
    if (y1 < y0) [y0, y1] = [y1, y0];
    return {
      start: new Date(y0, 0, 1),
      end: new Date(y1 + 1, 0, 1),
      key: y0 === y1 ? `${y0}` : `${y0}–${y1}`,
    };
  }
  if (mode === "monthly") {
    const pm = (s?: string) => (s && /^\d{4}-\d{2}$/.test(s) ? (s.split("-").map(Number) as [number, number]) : null);
    let a = pm(dateParam) ?? [now.getFullYear(), now.getMonth() + 1];
    let b = pm(toParam) ?? a;
    if (b[0] * 12 + b[1] < a[0] * 12 + a[1]) [a, b] = [b, a];
    return {
      start: new Date(a[0], a[1] - 1, 1),
      end: new Date(b[0], b[1], 1),
      key: a[0] === b[0] && a[1] === b[1]
        ? `${a[0]}-${pad2(a[1])}`
        : `${a[0]}-${pad2(a[1])}–${b[0]}-${pad2(b[1])}`,
    };
  }
  const pd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? (s.split("-").map(Number) as [number, number, number]) : null);
  let a = pd(dateParam) ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  let b = pd(toParam) ?? a;
  if (new Date(b[0], b[1] - 1, b[2]) < new Date(a[0], a[1] - 1, a[2])) [a, b] = [b, a];
  return {
    start: new Date(a[0], a[1] - 1, a[2]),
    end: new Date(b[0], b[1] - 1, b[2] + 1),
    key: a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
      ? `${a[0]}-${pad2(a[1])}-${pad2(a[2])}`
      : `${a[0]}-${pad2(a[1])}-${pad2(a[2])}–${b[0]}-${pad2(b[1])}-${pad2(b[2])}`,
  };
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; to?: string; q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const mode = params.mode ?? "daily";
  const date = params.date ?? undefined;
  const to = params.to ?? undefined;
  const q = params.q ?? "";
  const page = params.page ?? "1";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as any;

  const { start, end, key } = getRange(mode, date, to);

  // Filter posts
  const where: any = {
    createdAt: { gte: start, lt: end },
    deletedAt: null,
  };

  if (q.trim()) {
    const searchVal = q.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: searchVal, mode: "insensitive" } },
          { note: { contains: searchVal, mode: "insensitive" } },
          { owner: { name: { contains: searchVal, mode: "insensitive" } } },
        ],
      },
    ];
  }

  // Pagination setups
  const PAGE_SIZE = 6;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const totalCount = await prisma.post.count({ where });
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const posts = await prisma.post.findMany({
    where,
    include: { owner: true, participants: true },
    orderBy: { createdAt: "asc" },
    skip: (pageNum - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // Calculate stats
  let total = 0;
  let paid = 0;
  let people = 0;

  // For stats, we compute based on ALL matches in the date range (not just the page)
  const allPosts = await prisma.post.findMany({
    where,
    include: { participants: true },
  });

  for (const p of allPosts) {
    for (const x of p.participants) {
      total += x.amountToPay;
      people += 1;
      if (x.paymentStatus === "PAID") paid += x.amountToPay;
    }
  }
  const outstanding = total - paid;

  // Defaults for query inputs
  const now = new Date();
  let currentY = now.getFullYear();
  let currentM = now.getMonth() + 1;
  let currentD = now.getDate();

  if (date) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split("-").map(Number);
      currentY = parts[0];
      currentM = parts[1];
      currentD = parts[2];
    } else if (/^\d{4}-\d{2}$/.test(date)) {
      const parts = date.split("-").map(Number);
      currentY = parts[0];
      currentM = parts[1];
    } else if (/^\d{4}$/.test(date)) {
      currentY = Number(date);
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const dailyDefault = `${currentY}-${pad(currentM)}-${pad(currentD)}`;
  const monthlyDefault = `${currentY}-${pad(currentM)}`;
  const yearlyDefault = `${currentY}`;

  return (
    <div className="space-y-5">
      <LiveRefresh />
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {lang === "th" ? "สรุปรายงาน" : "Summary Report"}
        </h2>
        <a
          href={`/api/summary/export?mode=${mode}&date=${date || key}${to ? `&to=${to}` : ""}`}
          className="rounded-xl border border-brand bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.97] flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {lang === "th" ? "ส่งออก Excel" : "Export Excel"}
        </a>
      </div>

      {/* Live query bar (mode + date + debounced search) */}
      <SummaryFilters
        mode={mode as "daily" | "monthly" | "yearly"}
        initialDate={mode === "daily" ? dailyDefault : mode === "monthly" ? monthlyDefault : yearlyDefault}
        initialTo={to ?? ""}
        initialQ={q}
        dailyDefault={dailyDefault}
        monthlyDefault={monthlyDefault}
        yearlyDefault={yearlyDefault}
        lang={lang}
        placeholder={t("bill.search.placeholder", lang)}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={lang === "th" ? "ยอดรวม" : "Total"} value={baht(total)} />
        <Stat label={t("bill.status.paid", lang)} value={baht(paid)} tone="green" />
        <Stat label={lang === "th" ? "ค้างจ่าย" : "Outstanding"} value={baht(outstanding)} tone="amber" />
      </div>
      
      <p className="text-xs text-muted">
        {lang === "th"
          ? `${totalCount} บิล · ${people} รายการ ในวันที่ ${key}`
          : `${totalCount} bills · ${people} items on ${key}`}
      </p>

      {/* Results list */}
      <div className="space-y-2.5">
        {posts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {lang === "th" ? "ไม่มีบิลในวันนี้" : "No bills on this day"}
          </p>
        )}
        {posts.map((p) => {
          const tAmount = p.participants.reduce((s, x) => s + x.amountToPay, 0);
          const paidC = p.participants.filter(
            (x) => x.paymentStatus === "PAID"
          ).length;
          return (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="flex items-center justify-between rounded-2xl bg-surface p-3.5 shadow-sm active:scale-[.99] hover:bg-muted/10 transition border border-transparent hover:border-border/30"
            >
              <div>
                <p className="font-semibold text-sm text-foreground">{p.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  {p.owner.name} · {lang === "th" ? "จ่าย" : "Paid"} {paidC}/{p.participants.length}
                </p>
              </div>
              <span className="font-bold text-sm text-foreground">{baht(tAmount)}</span>
            </Link>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={
              pageNum > 1
                ? `/summary?mode=${mode}&date=${date || ""}${to ? `&to=${to}` : ""}&q=${q}&page=${pageNum - 1}`
                : "#"
            }
            className={`rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold transition select-none ${
              pageNum > 1 ? "hover:bg-muted/10 active:scale-[.97]" : "opacity-40 pointer-events-none"
            }`}
          >
            {lang === "th" ? "← ก่อนหน้า" : "← Prev"}
          </Link>

          <span className="text-xs text-muted font-bold">
            {lang === "th" ? `หน้า ${pageNum} จาก ${totalPages}` : `Page ${pageNum} of ${totalPages}`}
          </span>

          <Link
            href={
              pageNum < totalPages
                ? `/summary?mode=${mode}&date=${date || ""}${to ? `&to=${to}` : ""}&q=${q}&page=${pageNum + 1}`
                : "#"
            }
            className={`rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-bold transition select-none ${
              pageNum < totalPages ? "hover:bg-muted/10 active:scale-[.97]" : "opacity-40 pointer-events-none"
            }`}
          >
            {lang === "th" ? "ถัดไป →" : "Next →"}
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber";
}) {
  const color =
    tone === "green"
      ? "text-green-600"
      : tone === "amber"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-2xl bg-surface p-3 text-center shadow-sm">
      <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</p>
      <p className={`mt-1.5 text-xs font-extrabold ${color}`}>{value}</p>
    </div>
  );
}
