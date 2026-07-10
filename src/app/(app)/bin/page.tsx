import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BinBillModal from "@/components/BinBillModal";

export default async function BinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as "th" | "en";

  const posts = await prisma.post.findMany({
    where: { ownerId: user.id, deletedAt: { not: null } },
    include: { participants: { include: { user: true }, orderBy: { id: "asc" } } },
    orderBy: { deletedAt: "desc" },
  });

  const unassigned = lang === "th" ? "ยังไม่ระบุคน" : "Unassigned";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/profile" className="text-muted text-lg leading-none">‹</Link>
        <h2 className="text-lg font-semibold">{lang === "th" ? "ถังขยะ" : "Bin"}</h2>
      </div>
      <p className="text-xs text-muted">
        {lang === "th"
          ? "บิลที่ลบจะเก็บไว้ที่นี่ กดดูรายละเอียดก่อนกู้คืนได้"
          : "Deleted bills are kept here — view details, then restore."}
      </p>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
          {lang === "th" ? "ถังขยะว่าง" : "Bin is empty"}
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <BinBillModal
              key={p.id}
              postId={p.id}
              title={p.title}
              note={p.note}
              deliveryFee={p.deliveryFee}
              deliveryPersonCount={p.deliveryPersonCount}
              items={p.participants.map((x) => ({
                id: x.id,
                itemName: x.itemName,
                who: x.user?.name ?? x.guestName ?? unassigned,
                price: x.price,
                amountToPay: x.amountToPay,
                paymentStatus: x.paymentStatus,
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
