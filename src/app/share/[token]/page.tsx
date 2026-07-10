import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { perHeadDeliveryFee, round2 } from "@/lib/discount";
import { promptpayQrDataUrl } from "@/lib/promptpay";
import { I18nProvider } from "@/lib/i18n";
import GuestBillView from "@/components/GuestBillView";

export default async function GuestSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const post = await prisma.post.findUnique({
    where: { shareToken: token },
    include: {
      owner: true,
      participants: { include: { user: true }, orderBy: { id: "asc" } },
    },
  });
  if (!post || post.deletedAt) notFound();

  const cookieStore = await cookies();
  const guestId = cookieStore.get(`gsid_${token}`)?.value ?? null;
  const myParticipants = guestId
    ? post.participants.filter((p) => p.guestClaimToken === guestId)
    : [];
  const myItemAmount = myParticipants.reduce((s, p) => s + p.amountToPay, 0);
  // A guest is one "head": if they claimed anything, they owe one per-head
  // delivery share on top of their items — mirrors the owner's per-person split.
  const myDelivery =
    myParticipants.length > 0
      ? perHeadDeliveryFee(post.deliveryFee, post.deliveryPersonCount)
      : 0;
  const myAmount = round2(myItemAmount + myDelivery);

  let myQr: string | null = null;
  if (myAmount > 0 && post.owner.promptpayNumber) {
    myQr = await promptpayQrDataUrl(post.owner.promptpayNumber, myAmount);
  }

  return (
    <I18nProvider lang="th">
      <div className="app-shell bg-background">
        <GuestBillView
          postId={post.id}
          shareToken={token}
          postTitle={post.title}
          postNote={post.note}
          ownerName={post.owner.name}
          postStatus={post.status}
          participants={post.participants}
          myParticipantIds={myParticipants.map((p) => p.id)}
          myQr={myQr}
          myAmount={myAmount}
          myDelivery={myDelivery}
        />
      </div>
    </I18nProvider>
  );
}
