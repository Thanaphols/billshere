"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { baht } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { deliverySplit, groupByPayer, paginateGroups, round2 } from "@/lib/discount";
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
  postTitle,
  postNote,
  ownerName,
  ownerQr,
  ownerPromptpay,
  participants,
  deliveryFee,
  deliveryPersonCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  postNote: string | null;
  ownerName: string;
  ownerQr: string | null;
  ownerPromptpay: string | null;
  participants: ParticipantData[];
  deliveryFee: number;
  deliveryPersonCount: number;
}) {
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [guestLink, setGuestLink] = useState<string | null>(null);
  // Drag-to-pan the receipt preview on both axes — sideways drags change page,
  // and scroll-snap settles on the nearest one. Mouse only: touch already pans
  // natively, and capturing touch pointers here would fight the browser.
  const previewRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, y: 0, left: 0, top: 0, moved: false });
  const dragProps = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const el = previewRef.current;
      if (e.pointerType !== "mouse" || !el) return;
      drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
      el.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const el = previewRef.current;
      if (!el || !el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.current.moved = true;
      el.scrollLeft = drag.current.left - dx;
      el.scrollTop = drag.current.top - dy;
    },
  };
  // Which receipt page the horizontal snap carousel is resting on (0-based).
  const [page, setPage] = useState(0);
  const pageAt = (el: HTMLElement) =>
    el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0;
  // Full-screen viewer carousel: a mouse has no swipe, so drive pages by arrows
  // and by translating a vertical wheel into horizontal scroll.
  const fullRef = useRef<HTMLDivElement>(null);
  const fullDrag = useRef({ x: 0, left: 0, moved: false });
  const goPage = (dir: number) => {
    const el = fullRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { t, lang } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    getOrCreateShareLink(postId).then((token) => {
      setGuestLink(`${window.location.origin}/share/${token}`);
    });
  }, [isOpen, postId]);

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

        const canvasWidth = 375; // Tight SE viewport width target

        // Wrap long item names so they never run into the price column.
        const nameMaxWidth = canvasWidth - 60 - 65; // left/right padding + price column
        const nameLineH = 17;
        const wrapText = (text: string, maxWidth: number, font: string): string[] => {
          ctx.font = font;
          const lines: string[] = [];
          let cur = "";
          for (const ch of text) {
            const test = cur + ch;
            if (ctx.measureText(test).width > maxWidth && cur) {
              lines.push(cur);
              cur = ch;
            } else {
              cur = test;
            }
          }
          if (cur) lines.push(cur);
          const capped = lines.slice(0, 3);
          if (lines.length > 3) capped[2] = capped[2].replace(/.$/, "…");
          return capped.length ? capped : [text];
        };
        // Group items by payer; precompute wrapped name lines + per-person subtotal.
        const groups = groupByPayer(participants).map((g) => ({
          ...g,
          lines: g.items.map((p) => wrapText(p.itemName, nameMaxWidth, "bold 14px sans-serif")),
          // The actual amount owed (discount AND delivery folded in), so the page-1
          // group totals sum to the grand total on page 2. Each item's price line
          // spells out the discount + delivery that get it there.
          subtotal: g.items.reduce((s, p) => s + p.amountToPay, 0),
        }));

        // Bill-wide figures + the per-item discount lines (only items that got a discount).
        const totalDiscount = participants.reduce((s, p) => s + p.discountShare, 0);
        const totalAmountToPay = participants.reduce((s, p) => s + p.amountToPay, 0);

        // 10 item rows per image; oversized payer groups spill (see paginateGroups).
        const MAX_ROWS = 10;
        const pages = paginateGroups(groups, MAX_ROWS);
        type Chunk = (typeof pages)[number][number];

        const drawDivider = (y: number) => {
          ctx.beginPath();
          ctx.moveTo(30, y);
          ctx.lineTo(canvasWidth - 30, y);
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
          ctx.stroke();
        };
        // Always resolves — onerror/undecodable QR resolves null instead of hanging the
        // await (which would leave the modal stuck on its "generating" spinner forever).
        const loadImage = (src: string) =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          });

        // Lay out ONE page top-to-bottom with a single advancing cursor `y`. With
        // textBaseline="top" every number below is a real on-screen pixel gap, written
        // exactly once. Pass 1 (measureOnly) advances `y` without drawing to learn the
        // page height; pass 2 draws for real. No hand-kept height reserves to drift.
        const renderPage = (
          pageGroups: Chunk[],
          summaryPage: boolean,
          pageNum: number,
          pageCount: number,
          measureOnly: boolean,
          qrImg: HTMLImageElement | null
        ): number => {
          let y = 0;
          const draw = !measureOnly;
          const at = (text: string, x: number, align: CanvasTextAlign, font: string, color: string) => {
            if (!draw) return;
            ctx.font = font;
            ctx.fillStyle = color;
            ctx.textAlign = align;
            ctx.textBaseline = "top";
            ctx.fillText(text, x, y);
          };
          const L = (t: string, f: string, c: string) => at(t, 30, "left", f, c);
          const R = (t: string, f: string, c: string) => at(t, canvasWidth - 30, "right", f, c);
          const C = (t: string, f: string, c: string) => at(t, canvasWidth / 2, "center", f, c);
          const hr = () => { if (draw) drawDivider(y); };

          // Header
          y += 20;
          C("billshere", "bold 13px sans-serif", "#16a34a"); y += 20;
          C(postTitle, "bold 20px sans-serif", "#111827"); y += 26;
          C(
            `${lang === "th" ? "เจ้าของบิล" : "Creator"}: ${ownerName}${pageCount > 1 ? ` · ${lang === "th" ? "หน้า" : "Page"} ${pageNum}/${pageCount}` : ""}`,
            "12px sans-serif",
            "#6b7280"
          );
          y += 24;

          // Item pages: column header + payer groups + footer, then stop. The summary
          // and QR live entirely on their own trailing page (summaryPage === true).
          if (!summaryPage) {
          // Column header
          L(lang === "th" ? "รายการ (ผู้จ่าย)" : "Item (Payer)", "bold 11px sans-serif", "#9ca3af");
          R(lang === "th" ? "ราคา" : "Price", "bold 11px sans-serif", "#9ca3af");
          y += 19;
          hr();

          // Payer groups — each a block: [gap] name [gap] items [band top] subtotal [band bottom]
          pageGroups.forEach((g, gi) => {
            y += gi === 0 ? 12 : 18;          // space above the group name (first group tighter)
            // A spilled group repeats its payer name so a page never shows orphan items.
            L(
              g.cont ? `${g.name} (${lang === "th" ? "ต่อ" : "cont."})` : g.name,
              "bold 13px sans-serif",
              "#111827"
            );
            y += 19;                          // name → first item
            // Unassigned rows are each their own payer, so a combined group total is
            // meaningless — show each item's own net on its price line instead.
            const perItem = g.kind === "unassigned";
            g.items.forEach((p, i) => {
              g.lines[i].forEach((ln) => {
                at(ln, 42, "left", "bold 14px sans-serif", "#1f2937");
                y += nameLineH;
              });
              y += 2;
              // Net owed = amountToPay (discount AND delivery already folded in). Spell
              // both out on the price line: "฿price ลด ฿disc + ค่าส่ง ฿deliv = ฿net".
              const deliv = round2(p.amountToPay - (p.price - p.discountShare));
              let bd = `฿${p.price.toFixed(2)}`;
              if (p.discountShare > 0) bd += ` ${lang === "th" ? "ลด" : "-"} ฿${p.discountShare.toFixed(2)}`;
              if (deliv > 0) bd += ` ${lang === "th" ? "+ ค่าส่ง" : "+ delivery"} ฿${deliv.toFixed(2)}`;
              // Unassigned rows show their net in the right column, so no trailing "= net".
              if ((p.discountShare > 0 || deliv > 0) && !perItem) bd += ` = ฿${p.amountToPay.toFixed(2)}`;
              at(bd, 42, "left", "11px sans-serif", "#9ca3af");
              // Per-item net on the right for unassigned (no group subtotal follows).
              if (perItem) R(`฿${p.amountToPay.toFixed(2)}`, "bold 12px sans-serif", "#16a34a");
              y += 14;                        // price line
              y += 12;                        // gap after item (also last item → band top)
            });
            hr();                             // band top
            // Subtotal only once the payer group has actually ended (never for unassigned).
            if (g.showSubtotal && !perItem) {
              y += 11;
              L(`${lang === "th" ? "รวม" : "Subtotal"} ${g.name}`, "bold 12px sans-serif", "#374151");
              R(`฿${g.subtotal.toFixed(2)}`, "bold 13px sans-serif", "#16a34a");
              y += 24;                        // 11 pad + 13 text
              hr();                           // band bottom / separator to next group
            }
          });

            // Item-page footer. No hr() here — the last group's band-bottom
            // divider already sits right above, a second one reads as doubled.
            y += 18;
            C(window.location.origin.replace(/^https?:\/\//, ""), "10px sans-serif", "#9ca3af");
            return y + 24;
          }

          // ---- Summary page (summaryPage === true): no items, just totals + QR ----
          // Summary section — bill-wide discount total (red) + delivery. Per-item
          // discounts are already netted on each item's price line above, so no re-list.
          const hasSummary = totalDiscount > 0 || deliveryFee > 0;
          if (hasSummary) {
            y += 18;
            L(lang === "th" ? "สรุปยอดบิล" : "Summary", "bold 13px sans-serif", "#111827");
            y += 21;
            const summaryRow = (label: string, value: string, color = "#4b5563") => {
              L(label, "12px sans-serif", color);
              if (value) R(value, "12px sans-serif", color);
              y += 20;
            };
            if (totalDiscount > 0)
              summaryRow(lang === "th" ? "ส่วนลดรวมทั้งบิล" : "Total bill discount", `-฿${totalDiscount.toFixed(2)}`, "#dc2626");
            if (deliveryFee > 0) {
              const dsp = deliverySplit(deliveryFee, deliveryPersonCount);
              summaryRow(
                lang === "th"
                  ? `ค่าส่ง ฿${deliveryFee.toFixed(2)} ÷ ${deliveryPersonCount} คน`
                  : `Delivery ฿${deliveryFee.toFixed(2)} ÷ ${deliveryPersonCount}`,
                `฿${dsp.perHead.toFixed(2)}${lang === "th" ? "/คน" : " ea."}`
              );
              if (dsp.remainder > 0)
                summaryRow(
                  lang === "th"
                    ? `เศษ ฿${dsp.remainder.toFixed(2)} → เจ้าของบิลจ่าย`
                    : `Remainder ฿${dsp.remainder.toFixed(2)} → bill owner pays`,
                  `฿${dsp.ownerShare.toFixed(2)}`
                );
            }
            y += 6;
            hr();
          }

          // Grand total
          y += 14;
          L(lang === "th" ? "ยอดรวมสุทธิ" : "Grand Total", "bold 15px sans-serif", "#111827");
          R(`฿${totalAmountToPay.toFixed(2)}`, "bold 18px sans-serif", "#16a34a");
          y += 26;

          // QR / PromptPay
          hr();
          if (ownerQr) {
            y += 18;
            if (draw && qrImg) {
              const qrSize = 170;
              ctx.drawImage(qrImg, (canvasWidth - qrSize) / 2, y, qrSize, qrSize);
            }
            y += 180;
            C(lang === "th" ? "สแกนเพื่อชำระเงิน" : "Scan to Pay", "bold 13px sans-serif", "#374151");
            y += 18;
            C(`${lang === "th" ? "รับเงินปลายทาง" : "Payee"}: ${ownerPromptpay || ownerName}`, "11px sans-serif", "#6b7280");
            y += 22;
          } else {
            y += 20;
            C(lang === "th" ? "ผู้สร้างบิลยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์" : "Creator has not set PromptPay number", "italic 11px sans-serif", "#d97706");
            y += 24;
          }

          // Footer
          hr();
          y += 10;
          C(window.location.origin.replace(/^https?:\/\//, ""), "10px sans-serif", "#9ca3af");
          return y + 24;
        };

        const drawPage = async (
          pageGroups: Chunk[],
          summaryPage: boolean,
          pageNum: number,
          pageCount: number
        ): Promise<string> => {
          const scale = 2;
          const qrImg = summaryPage && ownerQr ? await loadImage(ownerQr) : null;
          const height = renderPage(pageGroups, summaryPage, pageNum, pageCount, true, null);
          canvas.width = canvasWidth * scale;
          canvas.height = height * scale;
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvasWidth, height);
          renderPage(pageGroups, summaryPage, pageNum, pageCount, false, qrImg);
          return canvas.toDataURL("image/png");
        };

        const urls: string[] = [];
        const totalPages = pages.length + 1; // +1 = the trailing summary / QR page
        for (let pi = 0; pi < pages.length; pi++) {
          urls.push(await drawPage(pages[pi], false, pi + 1, totalPages));
        }
        urls.push(await drawPage([], true, totalPages, totalPages)); // summary + QR page
        setImgUrls(urls);
        setPage(0); // fresh render → back to page 1
      } catch (err) {
        console.error(err);
      } finally {
        setGenerating(false);
      }
    };

    generateImage();
  }, [isOpen, ownerQr, ownerName, ownerPromptpay, participants, postTitle, postNote, lang, deliveryFee, deliveryPersonCount]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar w-full max-w-sm max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl border border-border flex flex-col space-y-4 animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="text-sm font-bold text-foreground">
            {lang === "th" ? "แชร์สรุปบิล (รูปภาพ)" : "Share Bill Summary (Image)"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xs font-semibold">
            {t("close")}
          </button>
        </div>

        {/* Guest link — anyone can share; no-account members join via this URL */}
        {(
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
            imgUrls.length > 0 && (
              <div
                ref={previewRef}
                {...dragProps}
                onClick={() => {
                  if (!drag.current.moved) setShowFull(true);
                }}
                onScroll={(e) => setPage(pageAt(e.currentTarget))}
                className="no-scrollbar w-full max-h-[60vh] overflow-auto overscroll-contain flex snap-x snap-mandatory p-1 active:cursor-grabbing"
              >
                {imgUrls.map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={u}
                    alt={`Bill summary receipt page ${i + 1}`}
                    className="w-full shrink-0 snap-center h-auto object-contain select-none"
                    draggable={false}
                  />
                ))}
              </div>
            )
          )}
          {imgUrls.length > 1 && !generating && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
              {page + 1} / {imgUrls.length}
            </span>
          )}
        </div>

        {/* Hidden Canvas for Generation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
        <div className="flex gap-2">
          {imgUrls.length > 0 && (
            <>
              <button
                onClick={() => {
                  // Download every page (single page keeps the old filename).
                  imgUrls.forEach((u, i) => {
                    const a = document.createElement("a");
                    a.href = u;
                    a.download =
                      imgUrls.length > 1 ? `${postTitle}-summary-${i + 1}.png` : `${postTitle}-summary.png`;
                    a.click();
                  });
                }}
                className="flex-1 rounded-xl border border-border bg-white py-3 text-center text-xs font-bold text-foreground hover:bg-muted/10 transition active:scale-[.98]"
              >
                {t("bill.download")}
              </button>
              <button
                onClick={async () => {
                  try {
                    const files = await Promise.all(
                      imgUrls.map(async (u, i) => {
                        const blob = await (await fetch(u)).blob();
                        const suffix = imgUrls.length > 1 ? `-${i + 1}` : "";
                        return new File([blob], `${postTitle}-summary${suffix}.png`, { type: "image/png" });
                      })
                    );
                    if (navigator.share && navigator.canShare({ files })) {
                      await navigator.share({
                        files,
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

      {/* Full-screen image viewer — tap anywhere or the ✕ to close. It renders
          inside the backdrop that closes the whole modal, so the clicks here
          must stop propagating or dismissing the image closes the modal too. */}
      {showFull && imgUrls.length > 0 && (
        <div className="fixed inset-0 z-[60] flex bg-black/90">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowFull(false);
            }}
            aria-label="close"
            className="fixed top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white text-xl hover:bg-white/25 transition"
          >
            ✕
          </button>
          {/* One full-viewport slide per page; each image fits the screen (no crop).
              Swipe (touch) or the arrows / mouse-wheel (desktop) move between pages. */}
          <div
            ref={fullRef}
            onScroll={(e) => setPage(pageAt(e.currentTarget))}
            onWheel={(e) => {
              const el = fullRef.current;
              if (el && imgUrls.length > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX))
                el.scrollLeft += e.deltaY;
            }}
            // Mouse drag pans between pages; touch uses native swipe. A real drag
            // sets `moved`, so the click that ends it doesn't also close the viewer.
            onPointerDown={(e) => {
              const el = fullRef.current;
              if (e.pointerType !== "mouse" || !el) return;
              fullDrag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
              el.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const el = fullRef.current;
              if (!el || !el.hasPointerCapture(e.pointerId)) return;
              const dx = e.clientX - fullDrag.current.x;
              if (Math.abs(dx) > 4) fullDrag.current.moved = true;
              el.scrollLeft = fullDrag.current.left - dx;
            }}
            onClick={() => { if (!fullDrag.current.moved) setShowFull(false); }}
            className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden cursor-pointer active:cursor-grabbing"
          >
            {imgUrls.map((u, i) => (
              <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u}
                  alt={`Bill summary receipt page ${i + 1}`}
                  className="max-h-full max-w-full w-auto object-contain select-none"
                />
              </div>
            ))}
          </div>

          {imgUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPage(-1); }}
                disabled={page === 0}
                aria-label="previous page"
                className="fixed left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white text-2xl hover:bg-white/25 disabled:opacity-30 transition"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPage(1); }}
                disabled={page >= imgUrls.length - 1}
                aria-label="next page"
                className="fixed right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white text-2xl hover:bg-white/25 disabled:opacity-30 transition"
              >
                ›
              </button>
              <span className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                {page + 1} / {imgUrls.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
