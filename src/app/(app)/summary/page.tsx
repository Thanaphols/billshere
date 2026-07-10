import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { baht } from "@/lib/format";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n-dict";

function getRange(mode: string, dateParam?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;
  let key: string;

  if (mode === "yearly") {
    let y = now.getFullYear();
    if (dateParam && /^\d{4}$/.test(dateParam)) {
      y = Number(dateParam);
    }
    start = new Date(y, 0, 1);
    end = new Date(y + 1, 0, 1);
    key = String(y);
  } else if (mode === "monthly") {
    let y = now.getFullYear();
    let m = now.getMonth();
    if (dateParam && /^\d{4}-\d{2}$/.test(dateParam)) {
      const parts = dateParam.split("-").map(Number);
      y = parts[0];
      m = parts[1] - 1;
    }
    start = new Date(y, m, 1);
    end = new Date(y, m + 1, 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}`;
  } else {
    let y = now.getFullYear();
    let m = now.getMonth();
    let d = now.getDate();
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const parts = dateParam.split("-").map(Number);
      y = parts[0];
      m = parts[1] - 1;
      d = parts[2];
    }
    start = new Date(y, m, d);
    end = new Date(y, m, d + 1);
    key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return { start, end, key };
}

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; date?: string; q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  const mode = params.mode ?? "daily";
  const date = params.date ?? undefined;
  const q = params.q ?? "";
  const page = params.page ?? "1";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as any;

  const { start, end, key } = getRange(mode, date);

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {lang === "th" ? "สรุปรายงาน" : "Summary Report"}
        </h2>
        <a
          href={`/api/summary/export?mode=${mode}&date=${date || key}`}
          className="rounded-xl border border-brand bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.97] flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {lang === "th" ? "ส่งออก CSV" : "Export CSV"}
        </a>
      </div>

      {/* Query Form */}
      <form method="get" className="space-y-3 bg-surface p-4 rounded-2xl shadow-xs">
        <input type="hidden" name="mode" value={mode} />
        
        {/* Toggle Pills Mode */}
        <div className="flex rounded-xl border border-border p-0.5 bg-background text-[11px] font-bold w-full">
          <Link
            href={`/summary?mode=daily&date=${dailyDefault}&q=${q}`}
            className={`flex-1 py-2 text-center rounded-lg transition-all ${
              mode === "daily" ? "bg-white shadow-xs text-brand" : "text-muted font-semibold"
            }`}
          >
            {lang === "th" ? "รายวัน" : "Daily"}
          </Link>
          <Link
            href={`/summary?mode=monthly&date=${monthlyDefault}&q=${q}`}
            className={`flex-1 py-2 text-center rounded-lg transition-all ${
              mode === "monthly" ? "bg-white shadow-xs text-brand" : "text-muted font-semibold"
            }`}
          >
            {lang === "th" ? "รายเดือน" : "Monthly"}
          </Link>
          <Link
            href={`/summary?mode=yearly&date=${yearlyDefault}&q=${q}`}
            className={`flex-1 py-2 text-center rounded-lg transition-all ${
              mode === "yearly" ? "bg-white shadow-xs text-brand" : "text-muted font-semibold"
            }`}
          >
            {lang === "th" ? "รายปี" : "Yearly"}
          </Link>
        </div>

        {/* Inputs row */}
        <div className="space-y-2.5">
          <div className="flex gap-2">
            {mode === "daily" && (
              <input
                type="date"
                name="date"
                defaultValue={dailyDefault}
                className="rounded-xl border border-border bg-white px-2.5 py-2.5 text-xs outline-none focus:border-brand flex-1 min-w-0"
              />
            )}
            {mode === "monthly" && (
              <input
                type="month"
                name="date"
                defaultValue={monthlyDefault}
                className="rounded-xl border border-border bg-white px-2.5 py-2.5 text-xs outline-none focus:border-brand flex-1 min-w-0"
              />
            )}
            {mode === "yearly" && (
              <input
                type="number"
                name="date"
                defaultValue={yearlyDefault}
                min="2000"
                max="2100"
                placeholder="YYYY"
                className="no-spinner rounded-xl border border-border bg-white px-2.5 py-2.5 text-xs outline-none focus:border-brand flex-1 font-bold text-center text-sm min-w-0"
              />
            )}

            <input
              name="q"
              defaultValue={q}
              placeholder={t("bill.search.placeholder", lang)}
              className="flex-[1.8] rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand text-sm min-w-0"
            />
          </div>

          <button className="w-full rounded-xl bg-brand py-2.5 font-bold text-white text-xs hover:bg-brand/90 transition active:scale-[.98]">
            {lang === "th" ? "ค้นหา" : "Search"}
          </button>
        </div>
      </form>

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
                ? `/summary?mode=${mode}&date=${date || ""}&q=${q}&page=${pageNum - 1}`
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
                ? `/summary?mode=${mode}&date=${date || ""}&q=${q}&page=${pageNum + 1}`
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
