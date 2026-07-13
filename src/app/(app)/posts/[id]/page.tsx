import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import { ownerKeyOf } from "@/lib/discount";
import {
  updatePostSettings,
  togglePostStatus,
} from "@/actions/posts";
import PaySlipPanel from "@/components/PaySlipPanel";
import DiscountSettings from "@/components/DiscountSettings";
import ParticipantTable from "@/components/ParticipantTable";
import EditPostModal from "@/components/EditPostModal";
import DeletePostButton from "@/components/DeletePostButton";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n-dict";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const lang = (cookieStore.get("billshere_lang")?.value || "th") as any;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      owner: true,
      participants: { include: { user: true }, orderBy: { id: "asc" } },
    },
  });
  if (!post || post.deletedAt) notFound();

  const isOwner = post.ownerId === user.id;
  const myParticipants = post.participants.filter((p) => p.userId === user.id);
  const myAmount = myParticipants.reduce((s, p) => s + p.amountToPay, 0);
  const paidCount = post.participants.filter(
    (p) => p.paymentStatus === "PAID"
  ).length;

  // QR for the current user to pay the post owner, sized to everything owed across all their rows.
  let myQr: string | null = null;
  if (myAmount > 0 && post.owner.promptpayNumber) {
    myQr = await promptpayQrDataUrl(post.owner.promptpayNumber, myAmount);
  }

  // Generic QR for the owner to receive payment (with no preset amount) for sharing.
  let ownerQr: string | null = null;
  if (post.owner.promptpayNumber) {
    ownerQr = await promptpayQrDataUrl(post.owner.promptpayNumber);
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
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-foreground">{post.title}</h2>
              {isOwner && (
                <EditPostModal
                  postId={post.id}
                  defaultTitle={post.title}
                  defaultNote={post.note}
                />
              )}
            </div>
            {post.note && (
              <p className="text-xs text-muted mt-0.5">{post.note}</p>
            )}
            <p className="text-[10px] text-muted mt-1.5">
              {lang === "th"
                ? `โดย ${post.owner.name} · จ่ายแล้ว ${paidCount}/${post.participants.length} คน`
                : `By ${post.owner.name} · Paid ${paidCount}/${post.participants.length} users`}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              post.status === "OPEN"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {post.status === "OPEN" ? t("bill.status.open", lang) : t("bill.status.closed", lang)}
          </span>
        </div>
      </div>

      {/* Pay panel — visible to any visitor, whether or not they already own any item */}
      <PaySlipPanel
        participants={post.participants}
        currentUserId={user.id}
        postStatus={post.status}
        ownerName={post.owner.name}
        myQr={myQr}
        myAmount={myAmount}
      />

      {/* Participant list */}
      <ParticipantTable
        participants={post.participants}
        allUsers={allUsers}
        isOwner={isOwner}
        currentUserId={user.id}
        postId={post.id}
        postStatus={post.status}
        deliveryFee={post.deliveryFee}
        deliveryPersonCount={post.deliveryPersonCount}
        ownerQr={ownerQr}
        ownerName={post.owner.name}
        postTitle={post.title}
        postNote={post.note}
      />

      {/* Owner controls */}
      {isOwner && (
        <>
          <DiscountSettings
            action={updatePostSettings.bind(null, post.id)}
            rows={post.participants.map((p) => ({
              id: p.id,
              price: p.price,
              ownerKey: ownerKeyOf(p),
            }))}
            defaultType={post.discountType}
            defaultValue={post.discountValue}
            defaultDeliveryFee={post.deliveryFee}
            defaultDeliveryPersonCount={post.deliveryPersonCount}
          />

          <div className="space-y-2">
            <form action={togglePostStatus.bind(null, post.id)}>
              <button className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold text-foreground hover:bg-muted/10 transition active:scale-[.98]">
                {post.status === "OPEN" ? t("bill.closeBill", lang) : t("bill.reopenBill", lang)}
              </button>
            </form>

            <DeletePostButton postId={post.id} />
          </div>
        </>
      )}
    </div>
  );
}
