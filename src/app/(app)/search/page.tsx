import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PostCard, { type PostCardData } from "@/components/PostCard";

function dateLabel(d: Date): string {
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const posts = await prisma.post.findMany({
    where: query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { note: { contains: query, mode: "insensitive" } },
            { owner: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {},
    include: { owner: true, participants: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const cards: PostCardData[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    ownerName: p.owner.name,
    dateLabel: dateLabel(p.createdAt),
    total: p.participants.reduce((s, x) => s + x.amountToPay, 0),
    count: p.participants.length,
    paidCount: p.participants.filter((x) => x.paymentStatus === "PAID").length,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">ค้นหาบิล</h2>
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="ชื่อบิล / โน้ต / ชื่อผู้สร้าง"
          className="flex-1 rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand"
        />
        <button className="rounded-xl bg-brand px-4 font-semibold text-white">
          ค้นหา
        </button>
      </form>

      {cards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {query ? "ไม่พบบิลที่ตรงกับคำค้น" : "ยังไม่มีบิลในระบบ"}
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <PostCard key={c.id} post={c} />
          ))}
        </div>
      )}
    </div>
  );
}
