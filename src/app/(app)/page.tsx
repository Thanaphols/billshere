import Link from "next/link";
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

export default async function DashboardPage() {
  const user = await requireUser();

  const [owned, tagged] = await Promise.all([
    prisma.post.findMany({
      where: { ownerId: user.id },
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.post.findMany({
      where: {
        ownerId: { not: user.id },
        participants: { some: { userId: user.id } },
      },
      include: { owner: true, participants: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const toCard = (p: (typeof owned)[number]): PostCardData => {
    const mine = p.participants.find((x) => x.userId === user.id);
    return {
      id: p.id,
      title: p.title,
      ownerName: p.owner.name,
      dateLabel: dateLabel(p.createdAt),
      total: p.participants.reduce((s, x) => s + x.amountToPay, 0),
      count: p.participants.length,
      paidCount: p.participants.filter((x) => x.paymentStatus === "PAID").length,
      myAmount: mine?.amountToPay,
      myStatus: mine?.paymentStatus,
    };
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">โพสของฉัน</h2>
          <Link href="/posts/new" className="text-sm font-semibold text-brand">
            + สร้างบิล
          </Link>
        </div>
        {owned.length === 0 ? (
          <Empty text="ยังไม่มีบิลที่คุณสร้าง กดปุ่มสร้างบิลเพื่อเริ่ม" />
        ) : (
          <div className="space-y-3">
            {owned.map((p) => (
              <PostCard key={p.id} post={toCard(p)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">โพสที่ถูกแท็ก</h2>
        {tagged.length === 0 ? (
          <Empty text="ยังไม่มีบิลที่คุณถูกแท็กให้จ่าย" />
        ) : (
          <div className="space-y-3">
            {tagged.map((p) => (
              <PostCard key={p.id} post={toCard(p)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
      {text}
    </p>
  );
}
