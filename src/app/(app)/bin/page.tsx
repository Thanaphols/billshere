import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { restorePost } from "@/actions/posts";
import { baht } from "@/lib/format";

export default async function BinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as "th" | "en";

  const posts = await prisma.post.findMany({
    where: { ownerId: user.id, deletedAt: { not: null } },
    include: { participants: true },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/profile" className="text-muted text-lg leading-none">‹</Link>
        <h2 className="text-lg font-semibold">{lang === "th" ? "ถังขยะ" : "Bin"}</h2>
      </div>
      <p className="text-xs text-muted">
        {lang === "th"
          ? "บิลที่ลบจะเก็บไว้ที่นี่ กู้คืนเพื่อใช้ต่อได้"
          : "Deleted bills are kept here — restore to use again."}
      </p>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted">
          {lang === "th" ? "ถังขยะว่าง" : "Bin is empty"}
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => {
            const total = p.participants.reduce((s, x) => s + x.amountToPay, 0);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {p.participants.length} {lang === "th" ? "รายการ" : "items"} · {baht(total)}
                  </p>
                </div>
                <form action={restorePost.bind(null, p.id)}>
                  <button className="shrink-0 rounded-xl border border-brand bg-brand/5 px-3 py-2 text-xs font-bold text-brand hover:bg-brand/10 transition active:scale-[.96]">
                    {lang === "th" ? "กู้คืน" : "Restore"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
