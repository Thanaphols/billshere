import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { type PostCardData } from "@/components/PostCard";
import PagedPostList from "@/components/PagedPostList";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n-dict";

function dateLabel(d: Date, lang: string = "th"): string {
  return d.toLocaleDateString(lang === "en" ? "en-US" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { status } = await searchParams;
  const activeStatus = status ?? "all";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as any;

  // Build filters based on active status
  const whereOwned: any = { ownerId: user.id, deletedAt: null };
  const whereTagged: any = {
    ownerId: { not: user.id },
    participants: { some: { userId: user.id } },
    deletedAt: null,
  };

  if (activeStatus === "open") {
    whereOwned.status = "OPEN";
    whereTagged.status = "OPEN";
  } else if (activeStatus === "closed") {
    whereOwned.status = "CLOSED";
    whereTagged.status = "CLOSED";
  }

  const [owned, tagged] = await Promise.all([
    prisma.post.findMany({
      where: whereOwned,
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.post.findMany({
      where: whereTagged,
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const toCard = (p: (typeof owned)[number]): PostCardData => {
    const mine = p.participants.find((x) => x.userId === user.id);
    return {
      id: p.id,
      title: p.title,
      ownerName: p.owner.name,
      dateLabel: dateLabel(p.createdAt, lang),
      total: p.participants.reduce((s, x) => s + x.amountToPay, 0),
      count: p.participants.length,
      paidCount: p.participants.filter((x) => x.paymentStatus === "PAID").length,
      myAmount: mine?.amountToPay,
      myStatus: mine?.paymentStatus,
    };
  };

  const ownedCards = owned.map(toCard);
  const taggedCards = tagged.map(toCard);

  return (
    <div className="space-y-5">
      {/* Status Filter Pills at top of page */}
      <div className="flex gap-2 text-[11px] font-bold bg-surface p-2.5 rounded-2xl shadow-xs">
        <Link
          href={`/?status=all`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none flex-1 text-center ${
            activeStatus === "all"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "ทั้งหมด" : "All"}
        </Link>
        <Link
          href={`/?status=open`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none flex-1 text-center ${
            activeStatus === "open"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "เปิดบิล" : "Open"}
        </Link>
        <Link
          href={`/?status=closed`}
          className={`rounded-xl px-4 py-2 border transition active:scale-[.96] select-none flex-1 text-center ${
            activeStatus === "closed"
              ? "bg-brand border-brand text-white shadow-xs"
              : "bg-surface border-border text-muted hover:bg-muted/10"
          }`}
        >
          {lang === "th" ? "ปิดบิลแล้ว" : "Closed"}
        </Link>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{t("bill.my", lang)}</h2>
          <Link href="/posts/new" className="text-sm font-semibold text-brand">
            + {t("bill.create", lang)}
          </Link>
        </div>
        <PagedPostList
          initialPosts={ownedCards}
          type="owned"
          status={activeStatus}
          emptyText={
            activeStatus === "all"
              ? t("bill.empty.owned", lang)
              : lang === "th"
              ? "ไม่พบรายการบิลที่สร้างในสถานะนี้"
              : "No bills created with this status"
          }
        />
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t("bill.tagged", lang)}</h2>
        <PagedPostList
          initialPosts={taggedCards}
          type="tagged"
          status={activeStatus}
          emptyText={
            activeStatus === "all"
              ? t("bill.empty.tagged", lang)
              : lang === "th"
              ? "ไม่พบรายการบิลที่ถูกแท็กในสถานะนี้"
              : "No tagged bills with this status"
          }
        />
      </section>
    </div>
  );
}
