"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { baht } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getOrCreateShareLink } from "@/actions/posts";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ParticipantData = {
  itemName: string;
  price: number;
  discountShare: number;
  amountToPay: number;
  userId: string | null;
  guestName: string | null;
  user?: UserOption | null;
};

export default function ShareBillModal({
  isOpen,
  onClose,
  postId,
  isOwner,
  postTitle,
  postNote,
  ownerName,
  ownerQr,
  participants,
  deliveryFee,
  deliveryPersonCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  isOwner: boolean;
  postTitle: string;
  postNote: string | null;
  ownerName: string;
  ownerQr: string | null;
  participants: ParticipantData[];
  deliveryFee: number;
  deliveryPersonCount: number;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [guestLink, setGuestLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { t, lang } = useI18n();

  useEffect(() => {
    if (!isOpen || !isOwner) return;
    setCopied(false);
    getOrCreateShareLink(postId).then((token) => {
      setGuestLink(`${window.location.origin}/share/${token}`);
    });
  }, [isOpen, isOwner, postId]);

  const copyGuestLink = async () => {
    if (!guestLink) return;
    await navigator.clipboard.writeText(guestLink);
    setCopied(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    setGenerating(true);
    const generateImage = async () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Calculate heights dynamically
        const canvasWidth = 375; // Tight SE viewport width target
        const headerHeight = postNote ? 145 : 125;
        const itemRowHeight = 44;
        const itemsListHeight = participants.length * itemRowHeight;
        const totalsSectionHeight = deliveryFee > 0 ? 130 : 110;
        const qrSectionHeight = ownerQr ? 245 : 70;
        const footerHeight = 40;

        const canvasHeight =
          headerHeight +
          itemsListHeight +
          totalsSectionHeight +
          qrSectionHeight +
          footerHeight;

        // Scale canvas for high-DPI crispness
        const scale = 2;
        canvas.width = canvasWidth * scale;
        canvas.height = canvasHeight * scale;
        ctx.scale(scale, scale);

        // 1. Draw Clean Premium White Background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Helper: Draw Center-aligned Text
        const drawCenteredText = (
          text: string,
          y: number,
          font: string,
          color: string
        ) => {
          ctx.font = font;
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          ctx.fillText(text, canvasWidth / 2, y);
        };

        // Helper: Draw Horizontal Line Dividers
        const drawDivider = (y: number) => {
          ctx.beginPath();
          ctx.moveTo(30, y);
          ctx.lineTo(canvasWidth - 30, y);
          ctx.strokeStyle = "#f3f4f6";
          ctx.lineWidth = 1;
          ctx.stroke();
        };

        // 2. Fetch calculations
        const totalOriginalPrice = participants.reduce((s, p) => s + p.price, 0);
        const totalDiscount = participants.reduce((s, p) => s + p.discountShare, 0);
        const totalAmountToPay = participants.reduce((s, p) => s + p.amountToPay, 0);

        // 3. Header Text
        drawCenteredText("billshere", 32, "bold 13px sans-serif", "#16a34a");
        drawCenteredText(postTitle, 65, "bold 20px sans-serif", "#111827");

        if (postNote) {
          drawCenteredText(postNote, 90, "13px sans-serif", "#4b5563");
        }

        drawCenteredText(
          `${lang === "th" ? "เจ้าของบิล" : "Creator"}: ${ownerName}`,
          postNote ? 115 : 95,
          "12px sans-serif",
          "#6b7280"
        );

        // 4. Draw Header Divider
        const dividerY = postNote ? 135 : 115;
        drawDivider(dividerY);

        // 5. Items Header
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#9ca3af";
        ctx.textAlign = "left";
        ctx.fillText(lang === "th" ? "รายการ (ผู้จ่าย)" : "Item (Payer)", 30, dividerY + 22);
        ctx.textAlign = "right";
        ctx.fillText(lang === "th" ? "รวม (บาท)" : "Total (Baht)", canvasWidth - 30, dividerY + 22);

        // Draw items divider
        drawDivider(dividerY + 30);

        // 6. Draw Menu Items
        let currentY = dividerY + 30;
        ctx.textAlign = "left";

        for (const p of participants) {
          const displayName = p.user?.name ?? p.guestName ?? (lang === "th" ? "ยังไม่ระบุคน" : "Unassigned");
          const isGuest = !p.userId && p.guestName;
          const isUnassigned = !p.userId && !p.guestName;

          // Item Name (Left)
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#1f2937";
          ctx.textAlign = "left";
          ctx.fillText(p.itemName, 30, currentY + 20);

          // Sub-details (Payee name + Price breakdown)
          let breakdown = `฿${p.price.toFixed(2)}`;
          if (p.discountShare > 0) breakdown += ` · ${lang === "th" ? "ลด" : "disc"} ฿${p.discountShare.toFixed(2)}`;

          ctx.font = "11px sans-serif";
          ctx.fillStyle = isUnassigned
            ? "#9ca3af"
            : isGuest
            ? "#d97706" // amber-600
            : "#16a34a"; // brand green
          ctx.fillText(`${lang === "th" ? "ผู้จ่าย" : "Payer"}: ${displayName} (${breakdown})`, 30, currentY + 35);

          // Total amount (Right)
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#16a34a";
          ctx.textAlign = "right";
          ctx.fillText(`฿${p.amountToPay.toFixed(2)}`, canvasWidth - 30, currentY + 25);

          currentY += itemRowHeight;
        }

        // 7. Grand Total Section
        drawDivider(currentY);
        currentY += 15;

        // Sub-totals helper
        const drawSummaryRow = (label: string, value: string, isBold = false) => {
          ctx.font = isBold ? "bold 13px sans-serif" : "12px sans-serif";
          ctx.fillStyle = isBold ? "#111827" : "#4b5563";
          ctx.textAlign = "left";
          ctx.fillText(label, 30, currentY);
          ctx.textAlign = "right";
          ctx.fillText(value, canvasWidth - 30, currentY);
          currentY += 20;
        };

        drawSummaryRow(lang === "th" ? "ค่าอาหารทั้งหมด" : "Food Subtotal", `฿${totalOriginalPrice.toFixed(2)}`);

        if (totalDiscount > 0) {
          drawSummaryRow(lang === "th" ? "ส่วนลดทั้งหมด" : "Total Discount", `-฿${totalDiscount.toFixed(2)}`);
        }

        if (deliveryFee > 0) {
          drawSummaryRow(
            lang === "th"
              ? `รวมค่าส่ง ฿${deliveryFee.toFixed(2)} (หาร ${deliveryPersonCount} คน) แล้ว`
              : `Incl. ฿${deliveryFee.toFixed(2)} delivery (split ${deliveryPersonCount})`,
            ""
          );
        }

        drawDivider(currentY - 10);
        currentY += 15;

        ctx.font = "bold 15px sans-serif";
        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        ctx.fillText(lang === "th" ? "ยอดรวมสุทธิ" : "Grand Total", 30, currentY);

        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = "#16a34a";
        ctx.textAlign = "right";
        ctx.fillText(`฿${totalAmountToPay.toFixed(2)}`, canvasWidth - 30, currentY);

        currentY += 25;

        // 8. Draw PromptPay QR Code
        if (ownerQr) {
          drawDivider(currentY);

          // Load QR image from base64
          const qrImg = new Image();
          qrImg.src = ownerQr;
          await new Promise((resolve) => {
            qrImg.onload = () => {
              // Draw QR code image centered
              const qrSize = 170;
              const qrX = (canvasWidth - qrSize) / 2;
              const qrY = currentY + 20;
              ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
              resolve(null);
            };
          });

          drawCenteredText(lang === "th" ? "สแกนเพื่อชำระเงิน" : "Scan to Pay", currentY + 212, "bold 13px sans-serif", "#374151");
          drawCenteredText(
            `${lang === "th" ? "รับเงินปลายทาง" : "Payee"}: ${ownerName}`,
            currentY + 230,
            "11px sans-serif",
            "#6b7280"
          );

          currentY += qrSectionHeight;
        } else {
          drawDivider(currentY);
          drawCenteredText(
            lang === "th" ? "ผู้สร้างบิลยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์" : "Creator has not set PromptPay number",
            currentY + 30,
            "italic 11px sans-serif",
            "#d97706"
          );
          currentY += qrSectionHeight;
        }

        // 9. Footer
        drawDivider(currentY);
        drawCenteredText("billshere.app", currentY + 22, "10px sans-serif", "#9ca3af");

        // Convert canvas image to Blob URL
        const dataUrl = canvas.toDataURL("image/png");
        setImgUrl(dataUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setGenerating(false);
      }
    };

    generateImage();
  }, [isOpen, ownerQr, ownerName, participants, postTitle, postNote, lang, deliveryFee, deliveryPersonCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4 animate-fade-in my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="text-sm font-bold text-foreground">
            {lang === "th" ? "แชร์สรุปบิล (รูปภาพ)" : "Share Bill Summary (Image)"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xs font-semibold">
            {t("close")}
          </button>
        </div>

        {/* Guest link — no-account members can join via this URL */}
        {isOwner && (
          <div className="rounded-xl bg-background/80 p-3 border border-border/50 space-y-1.5">
            <p className="text-xs font-bold text-foreground">
              {lang === "th" ? "ลิงก์เชิญเพื่อน (ไม่ต้องล็อกอิน)" : "Invite link (no login needed)"}
            </p>
            {guestLink ? (
              <div className="flex gap-1.5">
                <input
                  readOnly
                  value={guestLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-muted"
                />
                <button
                  onClick={copyGuestLink}
                  className="shrink-0 rounded-lg bg-brand px-3 text-xs font-bold text-white hover:bg-brand/90 transition active:scale-[.98]"
                >
                  {copied ? (lang === "th" ? "คัดลอกแล้ว" : "Copied") : lang === "th" ? "คัดลอก" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                {lang === "th" ? "กำลังสร้างลิงก์..." : "Generating link..."}
              </p>
            )}
          </div>
        )}

        {/* Image / Spinner */}
        <div className="flex justify-center bg-background rounded-xl overflow-hidden border border-border/80 min-h-[300px] items-center relative">
          {generating ? (
            <div className="flex flex-col items-center space-y-2 text-muted">
              <div className="w-6 h-6 rounded-full border-2 border-muted border-t-brand animate-spin" />
              <span className="text-xs font-semibold">
                {lang === "th" ? "กำลังสร้างรูปภาพสรุปยอด..." : "Generating receipt image..."}
              </span>
            </div>
          ) : (
            imgUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                alt="Bill summary receipt"
                className="w-full h-auto object-contain max-h-[60vh] select-none"
              />
            )
          )}
        </div>

        {/* Hidden Canvas for Generation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Info */}
        <div className="rounded-xl bg-background/80 p-3 border border-border/50 text-[10px] text-muted flex items-start gap-1.5 leading-relaxed">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-500 shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 5.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0-9.75h.008v.008H12V8.25Z" />
          </svg>
          <span>
            {lang === "th"
              ? "บนมือถือ: กดค้างที่รูปภาพเพื่อบันทึกรูป หรือกดปุ่มด้านล่างเพื่อแชร์เข้าแชท"
              : "On Mobile: Long press the image to save, or use buttons below to share."}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {imgUrl && (
            <>
              <a
                href={imgUrl}
                download={`${postTitle}-summary.png`}
                className="flex-1 rounded-xl border border-border bg-white py-3 text-center text-xs font-bold text-foreground hover:bg-muted/10 transition active:scale-[.98]"
              >
                {t("bill.download")}
              </a>
              <button
                onClick={async () => {
                  try {
                    const blob = await (await fetch(imgUrl)).blob();
                    const file = new File([blob], `${postTitle}-summary.png`, {
                      type: "image/png",
                    });
                    if (navigator.share && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        files: [file],
                        title: postTitle,
                        text: lang === "th" ? `สรุปยอดบิล ${postTitle}` : `Bill summary for ${postTitle}`,
                      });
                    } else {
                      alert(lang === "th" ? "เบราว์เซอร์นี้ไม่รองรับการแชร์รูปภาพโดยตรง" : "Direct image sharing is not supported on this browser.");
                    }
                  } catch (err) {
                    console.error("Error sharing image:", err);
                  }
                }}
                className="flex-1 rounded-xl bg-brand py-3 text-center text-xs font-bold text-white hover:bg-brand/90 transition active:scale-[.98]"
              >
                {t("bill.share")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
