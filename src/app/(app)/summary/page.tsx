import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { baht } from "@/lib/format";
import { dayRange } from "@/lib/summary";

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireUser();
  const { date } = await searchParams;
  const { start, end, key } = dayRange(date);

  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { owner: true, participants: true },
    orderBy: { createdAt: "asc" },
  });

  let total = 0;
  let paid = 0;
  let people = 0;
  for (const p of posts) {
    for (const x of p.participants) {
      total += x.amountToPay;
      people += 1;
      if (x.paymentStatus === "PAID") paid += x.amountToPay;
    }
  }
  const outstanding = total - paid;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">สรุปรายวัน</h2>
        <a
          href={`/api/summary/export?date=${key}`}
          className="rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand"
        >
          ⬇ ส่งออก CSV
        </a>
      </div>

      <form method="get" className="flex items-center gap-2">
        <input
          type="date"
          name="date"
          defaultValue={key}
          className="rounded-xl border border-border bg-white px-3 py-2"
        />
        <button className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
          ดู
        </button>
      </form>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="ยอดรวม" value={baht(total)} />
        <Stat label="จ่ายแล้ว" value={baht(paid)} tone="green" />
        <Stat label="ค้างจ่าย" value={baht(outstanding)} tone="amber" />
      </div>
      <p className="text-xs text-muted">
        {posts.length} บิล · {people} รายการ ในวันที่ {key}
      </p>

      <div className="space-y-2">
        {posts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            ไม่มีบิลในวันนี้
          </p>
        )}
        {posts.map((p) => {
          const t = p.participants.reduce((s, x) => s + x.amountToPay, 0);
          const paidC = p.participants.filter(
            (x) => x.paymentStatus === "PAID"
          ).length;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted">
                  {p.owner.name} · จ่าย {paidC}/{p.participants.length}
                </p>
              </div>
              <span className="font-semibold">{baht(t)}</span>
            </div>
          );
        })}
      </div>
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
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
