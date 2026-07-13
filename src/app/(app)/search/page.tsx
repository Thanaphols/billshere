import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { type PostCardData } from "@/components/PostCard";
import PagedPostList from "@/components/PagedPostList";
import LiveRefresh from "@/components/LiveRefresh";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n-dict";

function dateLabel(d: Date, lang: string = "th"): string {
  return d.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { q, status } = await searchParams;
  const query = (q ?? "").trim();
  const activeStatus = status ?? "all";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as any;

  // Build where filter
  const where: any = { deletedAt: null };
  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { note: { contains: query, mode: "insensitive" } },
      { owner: { name: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (activeStatus === "open") {
    where.status = "OPEN";
  } else if (activeStatus === "closed") {
    where.status = "CLOSED";
  }

  const posts = await prisma.post.findMany({
    where,
    include: { owner: true, participants: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const cards: PostCardData[] = posts.map((p) => {
    const myRows = p.participants.filter((x) => x.userId === user.id);
    return {
      id: p.id,
      title: p.title,
      ownerName: p.owner.name,
      dateLabel: dateLabel(p.createdAt, lang),
      total: p.participants.reduce((s, x) => s + x.amountToPay, 0),
      count: p.participants.length,
      paidCount: p.participants.filter((x) => x.paymentStatus === "PAID").length,
      myAmount: myRows.length ? myRows.reduce((s, x) => s + x.amountToPay, 0) : undefined,
      myStatus: myRows[0]?.paymentStatus,
    };
  });

  return (
    <div className="space-y-4">
      <LiveRefresh />
      <h2 className="text-lg font-semibold">{t("bill.search", lang)}</h2>
      
      <form method="get" className="flex gap-2">
        {/* Preserve active status when submitting search text */}
        <input type="hidden" name="status" value={activeStatus} />
        
        <input
          name="q"
          defaultValue={query}
          placeholder={t("bill.search.placeholder", lang)}
          className="flex-1 rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm"
        />
        <button className="rounded-xl bg-brand px-5 font-bold text-white text-sm hover:bg-brand/90 transition active:scale-[.97]">
          {t("search", lang)}
        </button>
      </form>

      {/* Status Filter Pills */}
      <div className="flex gap-2 text-[11px] font-bold">
        <Link
          href={`/search?q=${query}&status=all`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none ${
            activeStatus === "all"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "ทั้งหมด" : "All"}
        </Link>
        <Link
          href={`/search?q=${query}&status=open`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none ${
            activeStatus === "open"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "เปิดบิล" : "Open"}
        </Link>
        <Link
          href={`/search?q=${query}&status=closed`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none ${
            activeStatus === "closed"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "ปิดบิลแล้ว" : "Closed"}
        </Link>
      </div>

      <PagedPostList
        initialPosts={cards}
        type="search"
        searchQuery={query}
        status={activeStatus}
        emptyText={
          query
            ? t("bill.search.empty", lang)
            : lang === "th"
            ? "ไม่พบรายการบิลที่ตรงกับสถานะนี้"
            : "No bills match this status"
        }
      />
    </div>
  );
}
