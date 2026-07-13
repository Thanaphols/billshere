"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { baht } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { uploadSlip, type SlipState } from "@/actions/slips";
import QrView from "@/components/QrView";

type ParticipantRow = {
  id: string;
  itemName: string;
  amountToPay: number;
  userId: string | null;
  guestName: string | null;
  slipImagePath: string | null;
  user?: { name: string } | null;
};

export default function PaySlipPanel({
  participants,
  currentUserId,
  postStatus,
  ownerName,
  myQr,
  myAmount,
}: {
  participants: ParticipantRow[];
  currentUserId: string;
  postStatus: "OPEN" | "CLOSED";
  ownerName: string;
  myQr: string | null;
  myAmount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { lang } = useI18n();

  // Rows this user signed up for (claim happens in the menu table now).
  const hasClaims = participants.some((p) => p.userId === currentUserId);
  const uploadable = participants.filter(
    (p) => p.userId === currentUserId && !p.slipImagePath
  );
  const uploadIds = uploadable.map((p) => p.id);

  const [state, formAction] = useActionState<SlipState, FormData>(
    uploadSlip.bind(null, uploadIds),
    undefined
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  useEffect(() => {
    if (state?.ok) handleClose();
  }, [state]);

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {lang === "th" ? "ยอดที่คุณต้องจ่าย" : "Your share to pay"}
        </h3>
      </div>

      {myAmount > 0 ? (
        myQr ? (
          <QrView dataUrl={myQr} amount={myAmount} payeeName={ownerName} />
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {lang === "th"
              ? "ผู้สร้างบิลยังไม่ได้ตั้งเบอร์ PromptPay จึงยังสร้าง QR ไม่ได้"
              : "The bill owner has not set their PromptPay number yet, QR unavailable."}
          </p>
        )
      ) : (
        <p className="text-sm text-muted">
          {lang === "th" ? "ยังไม่มีรายการที่กำหนดให้คุณ" : "No items assigned to you yet."}
        </p>
      )}

      {hasClaims && (
        <button
          onClick={() => setIsOpen(true)}
          className="mt-3 w-full rounded-xl border border-brand bg-white px-4 py-2.5 text-sm font-bold text-brand hover:bg-brand/5 active:scale-[.98] transition"
        >
          {lang === "th" ? "แนบสลิปการโอน" : "Attach Transfer Slip"}
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-sm font-bold text-foreground">
                {lang === "th" ? "แนบสลิปสำหรับเมนูของคุณ" : "Attach slip for your items"}
              </h3>
              <button onClick={handleClose} className="text-muted hover:text-foreground text-xs font-semibold">
                ✕
              </button>
            </div>

            {postStatus === "CLOSED" ? (
              <p className="text-sm text-muted text-center py-6">
                {lang === "th" ? "บิลปิดแล้ว ไม่สามารถแนบสลิปได้" : "This bill is closed — slips can no longer be attached."}
              </p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {uploadable.length === 0 ? (
                    <p className="text-xs text-muted text-center py-4">
                      {lang === "th"
                        ? "ทุกเมนูของคุณแนบสลิปแล้ว"
                        : "All your items already have a slip"}
                    </p>
                  ) : (
                    uploadable.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-border p-2.5"
                      >
                        <span className="truncate text-xs font-semibold text-foreground">{p.itemName}</span>
                        <span className="text-xs font-bold text-foreground shrink-0">{baht(p.amountToPay)}</span>
                      </div>
                    ))
                  )}
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
                      <p className="text-xs font-semibold text-foreground">
                        {lang === "th" ? "กดเพื่อเลือกรูปภาพสลิป" : "Click to select slip image"}
                      </p>
                    )}
                  </div>

                  {state?.error && (
                    <p className="text-xs font-semibold text-red-600 text-center">{state.error}</p>
                  )}

                  <div className="flex gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 rounded-xl border border-border bg-white py-2.5 text-xs font-bold text-muted hover:bg-muted/10 transition-colors"
                    >
                      {lang === "th" ? "ยกเลิก" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      disabled={uploadIds.length === 0 || !previewUrl}
                      className="flex-1 rounded-xl bg-brand text-white py-2.5 text-xs font-bold hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]"
                    >
                      {lang === "th" ? "อัปโหลดสลิป" : "Upload Slip"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
