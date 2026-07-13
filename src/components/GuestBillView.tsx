"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { baht, paymentLabel } from "@/lib/format";
import { syncGuestClaims, uploadSlipAsGuest } from "@/actions/guest";
import type { SlipState } from "@/actions/slips";
import QrView from "@/components/QrView";

type ParticipantRow = {
  id: string;
  itemName: string;
  amountToPay: number;
  userId: string | null;
  guestName: string | null;
  guestClaimToken: string | null;
  slipImagePath: string | null;
  paymentStatus: string;
  user?: { name: string } | null;
};

export default function GuestBillView({
  postId,
  shareToken,
  postTitle,
  postNote,
  ownerName,
  postStatus,
  participants,
  myParticipantIds,
  myQr,
  myAmount,
}: {
  postId: string;
  shareToken: string;
  postTitle: string;
  postNote: string | null;
  ownerName: string;
  postStatus: "OPEN" | "CLOSED";
  participants: ParticipantRow[];
  myParticipantIds: string[];
  myQr: string | null;
  myAmount: number;
}) {
  const router = useRouter();
  const closed = postStatus === "CLOSED";
  const mine = new Set(myParticipantIds);

  // Existing name from any row I already claimed, to prefill the single input.
  const existingName =
    participants.find((p) => mine.has(p.id))?.guestName ?? "";
  const myKey = myParticipantIds.join(",");

  const [name, setName] = useState(existingName);
  const [selected, setSelected] = useState<Set<string>>(new Set(myParticipantIds));
  const [claimPending, setClaimPending] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resync selection + name with server truth after refresh / confirm.
  useEffect(() => {
    setSelected(new Set(myKey ? myKey.split(",") : []));
    if (existingName) setName(existingName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myKey]);

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const claimDirty =
    selected.size !== myParticipantIds.length ||
    myParticipantIds.some((id) => !selected.has(id)) ||
    name.trim() !== existingName;

  const uploadable = participants.filter((p) => mine.has(p.id) && !p.slipImagePath);
  const uploadIds = uploadable.map((p) => p.id);

  const [state, formAction] = useActionState<SlipState, FormData>(
    uploadSlipAsGuest.bind(null, shareToken, uploadIds),
    undefined
  );

  useEffect(() => {
    const eventSource = new EventSource(`/api/posts/${postId}/stream`);
    eventSource.onmessage = (event) => {
      if (event.data === "update") router.refresh();
    };
    return () => eventSource.close();
  }, [postId, router]);

  const confirmClaims = async () => {
    if (selected.size > 0 && !name.trim()) return;
    setClaimPending(true);
    try {
      await syncGuestClaims(shareToken, [...selected], name.trim());
    } catch {
      // SSE refresh resyncs state either way.
    } finally {
      setClaimPending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const closeUpload = () => {
    setIsUploadOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    if (state?.ok) closeUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="rounded-2xl bg-surface p-4 shadow-sm">
        <p className="text-xs font-bold text-brand">billshere · ลิงก์เชิญเพื่อน</p>
        <h2 className="text-lg font-bold text-foreground mt-0.5">{postTitle}</h2>
        {postNote && <p className="text-xs text-muted mt-0.5">{postNote}</p>}
        <p className="text-[10px] text-muted mt-1.5">โดย {ownerName}</p>
        {closed && (
          <p className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600">
            บิลนี้ปิดแล้ว ไม่สามารถจองรายการหรือแนบสลิปได้
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-sm space-y-2">
        <h3 className="text-sm font-semibold text-foreground mb-1">รายการทั้งหมด</h3>

        {!closed && (
          <input
            type="text"
            placeholder="ชื่อของคุณ"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand"
          />
        )}

        {participants.map((p) => {
          const isMine = mine.has(p.id);
          const isUnassigned = !p.userId && !p.guestName && !p.guestClaimToken;
          const locked = !!p.slipImagePath;
          const displayName = p.user?.name ?? p.guestName ?? null;
          const selectable = !closed && !locked && (isMine || isUnassigned);

          return (
            <label
              key={p.id}
              className={`flex items-center gap-2.5 rounded-xl border border-border p-2.5 ${
                selectable ? "cursor-pointer hover:bg-muted/10" : ""
              }`}
            >
              {selectable ? (
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleSel(p.id)}
                  className="w-4 h-4 shrink-0 accent-brand"
                />
              ) : locked && isMine ? (
                <input type="checkbox" checked disabled className="w-4 h-4 shrink-0 accent-brand" />
              ) : (
                <span className="w-4 shrink-0" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{p.itemName}</span>
                {locked && isMine ? (
                  <span className="block text-[10px] text-brand font-semibold">
                    คุณจองไว้ · {paymentLabel(p.paymentStatus)}
                  </span>
                ) : !isMine && !isUnassigned ? (
                  <span className="block text-[10px] text-muted">
                    {displayName ? `ถูกจองโดย ${displayName}` : "มีคนอื่นจองไว้แล้ว"}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-xs font-bold text-foreground">{baht(p.amountToPay)}</span>
            </label>
          );
        })}

        {!closed && (
          <button
            onClick={confirmClaims}
            disabled={!claimDirty || claimPending || (selected.size > 0 && !name.trim())}
            className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ยืนยันการเลือกลงชื่อเมนู
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-3">ยอดที่คุณต้องจ่าย</h3>
        {myAmount > 0 ? (
          myQr ? (
            <QrView dataUrl={myQr} amount={myAmount} payeeName={ownerName} />
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              ผู้สร้างบิลยังไม่ได้ตั้งเบอร์ PromptPay จึงยังสร้าง QR ไม่ได้
            </p>
          )
        ) : (
          <p className="text-sm text-muted">จองรายการของคุณด้านบนก่อน เพื่อดูยอดที่ต้องจ่าย</p>
        )}

        {myParticipantIds.length > 0 && !closed && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-3 w-full rounded-xl border border-brand bg-white px-4 py-2.5 text-sm font-bold text-brand hover:bg-brand/5 active:scale-[.98] transition"
          >
            แนบสลิปการโอน
          </button>
        )}
      </div>

      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm font-bold text-foreground">แนบสลิปสำหรับรายการของคุณ</h3>
              <button onClick={closeUpload} className="text-muted hover:text-foreground text-xs font-semibold">
                ✕
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {uploadable.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-2.5">
                  <span className="truncate text-xs font-semibold text-foreground">{p.itemName}</span>
                  <span className="text-xs font-bold text-foreground">{baht(p.amountToPay)}</span>
                </div>
              ))}
            </div>

            <form action={formAction} className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                name="slip"
                accept="image/png,image/jpeg,image/webp"
                required
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-border hover:border-brand/40 rounded-xl p-4 flex flex-col items-center justify-center bg-muted/5 min-h-[120px] text-center hover:bg-muted/10 transition-colors"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Transfer Slip Preview" className="max-h-[160px] rounded-lg object-contain" />
                ) : (
                  <p className="text-xs font-semibold text-foreground">กดเพื่อเลือกรูปภาพสลิป</p>
                )}
              </div>

              {state?.error && (
                <p className="text-xs font-semibold text-red-600 text-center">{state.error}</p>
              )}

              <div className="flex gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={closeUpload}
                  className="flex-1 rounded-xl border border-border bg-white py-2.5 text-xs font-bold text-muted hover:bg-muted/10 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploadIds.length === 0 || !previewUrl}
                  className="flex-1 rounded-xl bg-brand text-white py-2.5 text-xs font-bold hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]"
                >
                  อัปโหลดสลิป
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
