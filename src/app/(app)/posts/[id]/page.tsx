import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { baht } from "@/lib/format";
import { discountLabel } from "@/lib/discount";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import {
  addParticipant,
  removeParticipant,
  markPaid,
  markUnpaid,
  updatePostSettings,
  togglePostStatus,
} from "@/actions/posts";
import StatusBadge from "@/components/StatusBadge";
import SlipUpload from "@/components/SlipUpload";
import QrView from "@/components/QrView";
import SubmitButton from "@/components/SubmitButton";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      owner: true,
      participants: { include: { user: true }, orderBy: { id: "asc" } },
    },
  });
  if (!post) notFound();

  const isOwner = post.ownerId === user.id;
  const mine = post.participants.find((p) => p.userId === user.id);
  const total = post.participants.reduce((s, p) => s + p.amountToPay, 0);
  const paidCount = post.participants.filter(
    (p) => p.paymentStatus === "PAID"
  ).length;

  // QR for the current tagged user to pay the post owner.
  let myQr: string | null = null;
  if (mine && post.owner.promptpayNumber) {
    myQr = await promptpayQrDataUrl(post.owner.promptpayNumber, mine.amountToPay);
  }

  const allUsers = isOwner
    ? await prisma.user.findMany({ orderBy: { name: "asc" } })
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-surface p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{post.title}</h2>
            <p className="text-xs text-muted">
              โดย {post.owner.name}
              {post.note ? ` · ${post.note}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              post.status === "OPEN"
                ? "bg-green-100 text-green-700"
                : "bg-gray-200 text-gray-600"
            }`}
          >
            {post.status === "OPEN" ? "เปิด" : "ปิดแล้ว"}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">{discountLabel(post.discountType, post.discountValue)}</span>
          <span className="font-semibold">รวม {baht(total)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          จ่ายแล้ว {paidCount}/{post.participants.length} คน
        </p>
      </div>

      {/* Pay panel for the current tagged user */}
      {mine && (
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">ยอดที่คุณต้องจ่าย</h3>
            <StatusBadge status={mine.paymentStatus} />
          </div>
          {myQr ? (
            <QrView dataUrl={myQr} amount={mine.amountToPay} payeeName={post.owner.name} />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              ผู้สร้างบิลยังไม่ได้ตั้งเบอร์ PromptPay จึงยังสร้าง QR ไม่ได้
            </p>
          )}

          <div className="mt-3">
            {mine.slipImagePath && (
              <Link
                href={`/api/uploads/${mine.slipImagePath}`}
                target="_blank"
                className="mb-2 block text-sm text-brand underline"
              >
                ดูสลิปที่แนบไว้
              </Link>
            )}
            {mine.paymentStatus !== "PAID" && <SlipUpload participantId={mine.id} />}
          </div>
        </div>
      )}

      {/* Participant list */}
      <div className="space-y-2">
        <h3 className="font-semibold">รายชื่อผู้จ่าย</h3>
        {post.participants.length === 0 && (
          <p className="text-sm text-muted">ยังไม่มีผู้จ่ายในบิลนี้</p>
        )}
        {post.participants.map((p) => (
          <div key={p.id} className="rounded-2xl bg-surface p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.user.name}</p>
                <p className="truncate text-xs text-muted">
                  {p.itemName} · ราคา {baht(p.price)}
                  {p.discountShare > 0 ? ` · ลด ${baht(p.discountShare)}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{baht(p.amountToPay)}</p>
                <StatusBadge status={p.paymentStatus} />
              </div>
            </div>

            {isOwner && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                {p.slipImagePath && (
                  <Link
                    href={`/api/uploads/${p.slipImagePath}`}
                    target="_blank"
                    className="text-xs text-brand underline"
                  >
                    ดูสลิป
                  </Link>
                )}
                {p.paymentStatus !== "PAID" ? (
                  <form action={markPaid.bind(null, p.id)}>
                    <button className="text-xs font-semibold text-green-600">
                      ✓ ยืนยันจ่ายแล้ว
                    </button>
                  </form>
                ) : (
                  <form action={markUnpaid.bind(null, p.id)}>
                    <button className="text-xs text-amber-600">ยกเลิกการยืนยัน</button>
                  </form>
                )}
                <form action={removeParticipant.bind(null, p.id)} className="ml-auto">
                  <button className="text-xs text-red-500">ลบ</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Owner controls */}
      {isOwner && (
        <>
          <details className="rounded-2xl bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold">
              เพิ่มผู้จ่าย (แท็กสมาชิก)
            </summary>
            <form action={addParticipant.bind(null, post.id)} className="mt-3 space-y-3">
              <select
                name="userId"
                required
                defaultValue=""
                className="w-full rounded-xl border border-border bg-white px-3 py-3"
              >
                <option value="" disabled>
                  เลือกสมาชิก…
                </option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <input
                name="itemName"
                placeholder="รายการ เช่น โกโก้เข้มข้น (กลาง)"
                className="w-full rounded-xl border border-border bg-white px-3 py-3"
              />
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="ราคา (บาท)"
                className="w-full rounded-xl border border-border bg-white px-3 py-3"
              />
              <SubmitButton>เพิ่มผู้จ่าย</SubmitButton>
            </form>
          </details>

          <details className="rounded-2xl bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer font-semibold">ตั้งค่าบิล / ส่วนลด</summary>
            <form
              action={updatePostSettings.bind(null, post.id)}
              className="mt-3 space-y-3"
            >
              <input
                name="title"
                defaultValue={post.title}
                className="w-full rounded-xl border border-border bg-white px-3 py-3"
              />
              <input
                name="note"
                defaultValue={post.note ?? ""}
                placeholder="โน้ต"
                className="w-full rounded-xl border border-border bg-white px-3 py-3"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  name="discountType"
                  defaultValue={post.discountType}
                  className="w-full rounded-xl border border-border bg-white px-3 py-3"
                >
                  <option value="NONE">ไม่มี</option>
                  <option value="FIXED">รวม ÷ เท่ากัน</option>
                  <option value="PERCENT">เปอร์เซ็นต์</option>
                </select>
                <input
                  name="discountValue"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={post.discountValue}
                  className="w-full rounded-xl border border-border bg-white px-3 py-3"
                />
              </div>
              <SubmitButton>บันทึกและคำนวณใหม่</SubmitButton>
            </form>
          </details>

          <form action={togglePostStatus.bind(null, post.id)}>
            <button className="w-full rounded-xl border border-border py-2.5 text-sm text-muted">
              {post.status === "OPEN" ? "ปิดบิลนี้" : "เปิดบิลอีกครั้ง"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
