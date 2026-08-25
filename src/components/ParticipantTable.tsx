"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { baht } from "@/lib/format";
import { deliverySplit, groupByPayer, ownerKeyOf, round2 } from "@/lib/discount";
import type { DiscountType } from "@prisma/client";
import AddMenuItemForm from "@/components/AddMenuItemForm";
import ShareBillModal from "@/components/ShareBillModal";
import ConfirmModal from "@/components/ConfirmModal";
import DiscountSettings from "@/components/DiscountSettings";
import Dropdown from "@/components/Dropdown";
import { useI18n } from "@/lib/i18n";
import {
  addMenuItems,
  editMenuItem,
  assignParticipantUser,
  removeParticipant,
  markPaid,
  markUnpaid,
  syncMyClaims,
  updatePostSettings,
} from "@/actions/posts";
import { deleteSlip } from "@/actions/slips";

type UserOption = {
  id: string;
  name: string;
  email: string;
};

type ParticipantData = {
  id: string;
  itemName: string;
  price: number;
  itemDiscount: number;
  discountShare: number;
  amountToPay: number;
  paymentStatus: string;
  slipImagePath: string | null;
  paidAt: Date | null;
  userId: string | null;
  guestName: string | null;
  packId: string | null;
  packName: string | null;
  user?: UserOption | null;
};

export default function ParticipantTable({
  participants,
  allUsers,
  isOwner,
  currentUserId,
  postId,
  postStatus,
  deliveryFee,
  deliveryPersonCount,
  discountType,
  discountValue,
  ownerQr,
  ownerName,
  ownerPromptpay,
  postTitle,
  postNote,
}: {
  participants: ParticipantData[];
  allUsers: UserOption[];
  isOwner: boolean;
  currentUserId: string;
  postId: string;
  postStatus: "OPEN" | "CLOSED";
  deliveryFee: number;
  deliveryPersonCount: number;
  discountType: DiscountType;
  discountValue: number;
  ownerQr: string | null;
  ownerName: string;
  ownerPromptpay: string | null;
  postTitle: string;
  postNote: string | null;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTabs, setActiveTabs] = useState<Record<string, "edit" | "owner" | "payment">>({});
  const [openPacks, setOpenPacks] = useState<Set<string>>(new Set());
  const togglePack = (id: string) =>
    setOpenPacks((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [assignModes, setAssignModes] = useState<Record<string, "user" | "guest">>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Only dismiss the settings modal when the press STARTED on the backdrop —
  // otherwise a text drag inside an input that ends on the backdrop closes it.
  const settingsDownOnBackdrop = useRef(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [slipToDelete, setSlipToDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  // Multi-select filters — empty set means "no filter" (show all).
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [claimFilters, setClaimFilters] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const toggleFilter = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    val: string
  ) =>
    setter((s) => {
      const n = new Set(s);
      if (n.has(val)) n.delete(val);
      else n.add(val);
      return n;
    });
  const activeFilterCount = statusFilters.size + claimFilters.size;
  const { t, lang } = useI18n();

  // Non-owner self-claim: tick your items, then confirm (batch sync).
  const claimCol = !isOwner && postStatus === "OPEN";
  const colCount = claimCol ? 3 : 2;
  const myIds = participants.filter((p) => p.userId === currentUserId).map((p) => p.id);
  const myKey = myIds.join(",");
  const [selected, setSelected] = useState<Set<string>>(new Set(myIds));
  const [claimPending, startClaim] = useTransition();
  // Resync selection with server truth on refresh / after a confirm.
  useEffect(() => {
    setSelected(new Set(myKey ? myKey.split(",") : []));
  }, [myKey]);
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const claimDirty =
    selected.size !== myIds.length || myIds.some((id) => !selected.has(id));
  const confirmClaims = () =>
    startClaim(async () => {
      try {
        await syncMyClaims(postId, [...selected]);
      } catch {
        // SSE refresh resyncs either way.
      }
    });

  const isPending = useLiveRefresh(`/api/posts/${postId}/stream`);

  const toggleExpand = (id: string) => {
    setEditErrors((e) => ({ ...e, [id]: "" }));
    setActiveTabs((t) => ({ ...t, [id]: postStatus === "OPEN" ? "edit" : "owner" }));
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const getAssignMode = (pId: string, hasGuest: boolean, hasUser: boolean) => {
    if (assignModes[pId]) return assignModes[pId];
    if (hasGuest && !hasUser) return "guest";
    return "user";
  };

  const setAssignMode = (pId: string, mode: "user" | "guest") => {
    setAssignModes((prev) => ({ ...prev, [pId]: mode }));
  };

  // Grand totals
  const totalOriginalPrice = participants.reduce((s, p) => s + p.price, 0);
  const totalDiscount = participants.reduce((s, p) => s + p.discountShare, 0);
  // Bill-level net: items − discount + delivery (added once, not per payer).
  const billNet = round2(Math.max(0, totalOriginalPrice - totalDiscount + deliveryFee));
  // One authoritative count of every unassigned row bill-wide — pack sub-items
  // count individually, exactly like standalone rows.
  const unassignedCount = participants.filter((p) => !p.userId && !p.guestName).length;

  // Client-side view filter — data is already loaded, no server round-trip.
  const q = search.trim().toLowerCase();
  const filtered = participants.filter((p) => {
    const name = (p.user?.name ?? p.guestName ?? "").toLowerCase();
    const matchText = !q || p.itemName.toLowerCase().includes(q) || name.includes(q);
    const matchStatus = statusFilters.size === 0 || statusFilters.has(p.paymentStatus);
    const claimed = !!(p.userId || p.guestName);
    const matchAssign =
      claimFilters.size === 0 || claimFilters.has(claimed ? "claimed" : "unclaimed");
    return matchText && matchStatus && matchAssign;
  });

  return (
    <div className="space-y-2">
      {/* Header and Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground">{t("bill.menu")}</h3>
          {isPending && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
              className="w-3.5 h-3.5 text-brand animate-spin shrink-0"
            >
              <title>{t("syncing")}</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Share Bill Button */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="rounded-full w-7 h-7 flex items-center justify-center border bg-white text-muted border-border hover:bg-muted/10 hover:text-brand hover:border-brand/40 active:scale-[.95] transition"
            title="แชร์สรุปบิลเป็นรูปภาพพร้อม QR"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
              />
            </svg>
          </button>

          {/* Settings (discount/delivery) modal trigger */}
          {isOwner && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-full w-7 h-7 flex items-center justify-center border bg-white text-muted border-border hover:bg-muted/10 hover:text-brand hover:border-brand/40 active:scale-[.95] transition"
              title={lang === "th" ? "ตั้งค่าการหารและค่าส่ง" : "Split & delivery settings"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setShowAddForm((prev) => !prev)}
              className={`rounded-full w-7 h-7 flex items-center justify-center font-bold transition-all border text-sm shadow-xs ${showAddForm
                  ? "bg-brand text-white border-brand rotate-45"
                  : "bg-white text-brand border-border hover:bg-brand/5 active:scale-[.95] hover:border-brand/40"
                }`}
              title="เพิ่มเมนู"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Settings modal — portaled to body so it escapes nested stacking contexts and covers the bottom nav */}
      {isOwner && showSettings && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            settingsDownOnBackdrop.current = e.target === e.currentTarget;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && settingsDownOnBackdrop.current) setShowSettings(false);
          }}
        >
          <div className="relative w-full max-w-sm my-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowSettings(false)}
              aria-label="close"
              className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-muted/20 text-muted hover:bg-muted/30 hover:text-foreground transition"
            >
              ✕
            </button>
            <DiscountSettings
              action={async (fd) => {
                await updatePostSettings(postId, fd);
                setShowSettings(false);
              }}
              rows={participants.map((p) => ({ id: p.id, price: p.price, discount: p.itemDiscount, ownerKey: ownerKeyOf(p) }))}
              defaultType={discountType}
              defaultValue={discountValue}
              defaultDeliveryFee={deliveryFee}
              defaultDeliveryPersonCount={deliveryPersonCount}
              ownerKey={"u:" + currentUserId}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Toggleable Add Menu Item Form */}
      {isOwner && showAddForm && (
        <div className="p-4 bg-surface rounded-2xl border border-border shadow-xs animate-fade-in space-y-2">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-bold text-foreground">เพิ่มเมนูใหม่</span>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-muted hover:text-foreground text-xs font-semibold"
            >
              ✕
            </button>
          </div>
          <AddMenuItemForm
            action={async (items) => {
              await addMenuItems(postId, items);
              setShowAddForm(false);
            }}
            allUsers={allUsers}
          />
        </div>
      )}

      {/* Search + status filter */}
      {participants.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "th" ? "ค้นหาเมนู หรือชื่อผู้จ่าย" : "Search item or payer"}
            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-xs outline-none focus:border-brand"
          />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              aria-label={lang === "th" ? "ตัวกรอง" : "Filter"}
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                activeFilterCount > 0
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-border bg-white text-muted hover:bg-muted/10"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
              </svg>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-border bg-white p-3 shadow-lg space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      {lang === "th" ? "สถานะจ่าย" : "Payment"}
                    </p>
                    {[
                      { value: "UNPAID", label: t("bill.status.unpaid") },
                      { value: "SLIP_UPLOADED", label: t("bill.status.uploaded") },
                      { value: "PAID", label: t("bill.status.paid") },
                    ].map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={statusFilters.has(o.value)}
                          onChange={() => toggleFilter(setStatusFilters, o.value)}
                          className="w-3.5 h-3.5 accent-brand"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      {lang === "th" ? "การเคลม" : "Claim"}
                    </p>
                    {[
                      { value: "claimed", label: lang === "th" ? "มีคนเคลมแล้ว" : "Claimed" },
                      { value: "unclaimed", label: lang === "th" ? "ยังไม่มีคนเคลม" : "Unclaimed" },
                    ].map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={claimFilters.has(o.value)}
                          onChange={() => toggleFilter(setClaimFilters, o.value)}
                          className="w-3.5 h-3.5 accent-brand"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilters(new Set());
                        setClaimFilters(new Set());
                      }}
                      className="w-full rounded-lg border border-border py-1.5 text-[11px] font-bold text-muted hover:bg-muted/10"
                    >
                      {lang === "th" ? "ล้างตัวกรอง" : "Clear filters"}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-xs text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-background text-muted uppercase tracking-wider border-b border-border">
              {claimCol && <th className="p-3 w-9" aria-label="select" />}
              <th className={`p-3 font-semibold ${claimCol ? "w-[60%]" : "w-[66%]"}`}>{lang === "th" ? "รายการ (ผู้จ่าย)" : "Item (Payer)"}</th>
              <th className="p-3 text-right font-semibold w-[34%]">{t("bill.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-8 text-center text-sm text-muted">
                  {t("bill.empty")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="p-8 text-center text-sm text-muted">
                  {lang === "th" ? "ไม่พบรายการที่ค้นหา" : "No matching items"}
                </td>
              </tr>
            ) : (
              (() => {
                const renderItemRow = (p: ParticipantData, inPack = false, isLast = false) => {
                const isExpanded = expandedIds.has(p.id);
                // Per-row tab + error state so several rows can stay open at once.
                const activeTab = activeTabs[p.id] ?? (postStatus === "OPEN" ? "edit" : "owner");
                const editError = editErrors[p.id] ?? "";
                const setEditError = (msg: string) =>
                  setEditErrors((e) => ({ ...e, [p.id]: msg }));
                const displayName = p.user?.name ?? p.guestName ?? (lang === "th" ? "ยังไม่ระบุคน" : "Unassigned");
                const isGuest = !p.userId && p.guestName;
                const isUnassigned = !p.userId && !p.guestName;
                const mode = getAssignMode(p.id, !!p.guestName, !!p.userId);

                return (
                  <React.Fragment key={p.id}>
                    {/* Main row, clicking anywhere on it toggles expanded view for owner */}
                    <tr
                      onClick={() => isOwner && toggleExpand(p.id)}
                      className={`hover:bg-muted/5 transition-colors select-none ${inPack ? "" : "border-t border-border"} ${isOwner ? "cursor-pointer" : ""
                        } ${isExpanded ? "bg-muted/5" : ""}`}
                    >
                      {claimCol && (
                        <td className="p-3 align-top" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const mine = p.userId === currentUserId;
                            if (p.slipImagePath)
                              return mine ? (
                                <input type="checkbox" checked disabled className="w-4 h-4 accent-brand" />
                              ) : null;
                            if (!(mine || isUnassigned)) return null;
                            return (
                              <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={() => toggleSel(p.id)}
                                className="w-4 h-4 accent-brand cursor-pointer"
                              />
                            );
                          })()}
                        </td>
                      )}
                      <td className={`p-3 min-w-0 ${inPack ? "relative pl-8" : ""}`}>
                        {inPack && (
                          <>
                            {/* vertical trunk — full height links to next row, half on the last */}
                            <span
                              aria-hidden
                              className={`absolute left-3 top-0 border-l border-border/70 ${isLast ? "h-1/2" : "bottom-0"}`}
                            />
                            {/* horizontal branch into the row */}
                            <span aria-hidden className="absolute left-3 top-1/2 w-3 border-t border-border/70" />
                          </>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p
                            className={`truncate text-foreground ${inPack ? "text-xs font-medium" : "font-semibold text-sm"}`}
                          >
                            {p.itemName}
                          </p>
                          {isOwner && (
                            <span className="text-[9px] text-muted/80 shrink-0 font-normal">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5 flex-wrap">
                          <span
                            className={`truncate max-w-[100px] ${isUnassigned
                                ? "text-muted font-normal"
                                : isGuest
                                  ? "text-amber-600 font-medium"
                                  : "text-brand font-medium"
                              }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 inline-block mr-0.5 align-text-bottom text-muted">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                            </svg>
                            {displayName}
                          </span>
                          <span className="text-muted/50">•</span>
                          <span
                            className={
                              p.paymentStatus === "PAID"
                                ? "text-green-600 font-semibold"
                                : p.paymentStatus === "SLIP_UPLOADED"
                                  ? "text-amber-600 font-semibold animate-pulse"
                                  : "text-muted font-normal"
                            }
                          >
                            {p.paymentStatus === "PAID"
                              ? t("bill.status.paid")
                              : p.paymentStatus === "SLIP_UPLOADED"
                                ? t("bill.status.uploaded")
                                : t("bill.status.unpaid")}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <p className={`font-medium ${p.discountShare > 0 ? "text-muted/60" : "text-foreground"}`}>
                          {baht(p.price)}
                        </p>
                        {p.discountShare > 0 && (
                          <>
                            <p className="text-[10px] text-red-500 font-medium">-{baht(p.discountShare)}</p>
                            <p className="font-semibold text-foreground">{baht(round2(p.price - p.discountShare))}</p>
                          </>
                        )}
                      </td>
                    </tr>

                    {/* Tabbed actions panel — pick one section to show */}
                    {isOwner && isExpanded && (
                      <tr className="bg-white">
                        <td colSpan={colCount} className="p-3 bg-white border-t border-border">
                          <div className="space-y-3">
                            {/* Tab selector + delete icon on the same row */}
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-1 min-w-0 rounded-xl border border-border bg-background p-0.5 text-[10px] font-bold">
                                {[
                                  ...(postStatus === "OPEN"
                                    ? [{ key: "edit" as const, label: lang === "th" ? "แก้ไขรายการ" : "Edit item" }]
                                    : []),
                                  { key: "owner" as const, label: t("bill.owner") },
                                  { key: "payment" as const, label: t("bill.payment") },
                                ].map((tb) => (
                                  <button
                                    key={tb.key}
                                    type="button"
                                    onClick={() => setActiveTabs((t) => ({ ...t, [p.id]: tb.key }))}
                                    className={`flex-1 min-w-0 truncate rounded-lg px-1 py-1.5 text-center transition-all ${
                                      activeTab === tb.key
                                        ? "bg-muted/40 text-foreground shadow-xs"
                                        : "text-muted font-medium hover:text-foreground"
                                    }`}
                                  >
                                    {tb.label}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => setItemToDelete({ id: p.id, name: p.itemName })}
                                aria-label={lang === "th" ? "ลบรายการ" : "Delete item"}
                                title={lang === "th" ? "ลบรายการ" : "Delete item"}
                                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>

                            {/* Edit item name / price */}
                            {activeTab === "edit" && postStatus === "OPEN" && (
                              <div className="space-y-2">
                                <form
                                  action={async (fd) => {
                                    try {
                                      await editMenuItem(p.id, fd);
                                      setEditError("");
                                    } catch {
                                      setEditError(
                                        p.packName
                                          ? lang === "th"
                                            ? "ราคารวมของแพ็คเกินราคาที่กำหนด"
                                            : "Sub-items exceed the pack price"
                                          : lang === "th"
                                            ? "บันทึกไม่สำเร็จ"
                                            : "Save failed"
                                      );
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="space-y-2"
                                >
                                  <div className="flex gap-2">
                                    <input
                                      name="itemName"
                                      defaultValue={p.itemName}
                                      placeholder={lang === "th" ? "ชื่อเมนู" : "Item name"}
                                      className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                                    />
                                    <input
                                      name="price"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={p.price}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="no-spinner w-24 rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                                    />
                                  </div>
                                  <input
                                    name="discount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    defaultValue={p.itemDiscount}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    placeholder={lang === "th" ? "ส่วนลดต่อรายการ (บาท) — 0 ถ้าไม่มี" : "Item discount (Baht) — 0 if none"}
                                    className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                                  />
                                  {editError && (
                                    <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600">
                                      {editError}
                                    </p>
                                  )}
                                  <button
                                    type="submit"
                                    className="w-full rounded-xl bg-brand text-white py-2 px-4 text-xs font-bold hover:bg-brand/90 transition active:scale-[.98]"
                                  >
                                    {lang === "th" ? "บันทึกรายการ" : "Save item"}
                                  </button>
                                </form>
                              </div>
                            )}

                            {/* Assignment form */}
                            {activeTab === "owner" && (
                            <div className="space-y-2">
                              {postStatus === "OPEN" ? (
                                <>
                                  {/* Segment selector toggle */}
                                  <div className="flex rounded-xl border border-border p-0.5 bg-background text-[10px] w-full font-bold">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAssignMode(p.id, "user");
                                      }}
                                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${mode === "user" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
                                        }`}
                                    >
                                      {lang === "th" ? "เลือกจากสมาชิก" : "Select Member"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAssignMode(p.id, "guest");
                                      }}
                                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${mode === "guest" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
                                        }`}
                                    >
                                      {lang === "th" ? "กำหนดเอง (พิมพ์ชื่อ)" : "Custom Name"}
                                    </button>
                                  </div>

                                  <form
                                    action={async (fd) => {
                                      await assignParticipantUser(p.id, fd);
                                    }}
                                    className="space-y-2"
                                    onClick={(e) => e.stopPropagation()} // Prevent closing row
                                  >
                                    {mode === "user" ? (
                                      <Dropdown
                                        name="userId"
                                        defaultValue={p.userId ?? ""}
                                        placeholder={lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —"}
                                        options={[
                                          { value: "", label: lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —" },
                                          ...allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
                                        ]}
                                      />
                                    ) : (
                                      <input
                                        name="guestName"
                                        defaultValue={p.guestName ?? ""}
                                        placeholder={lang === "th" ? "พิมพ์ชื่อคนจ่ายเอง (ไม่มีบัญชี)" : "Type guest name"}
                                        className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand"
                                      />
                                    )}

                                    <button
                                      type="submit"
                                      className="w-full rounded-xl bg-accent text-white py-2 px-4 text-xs font-bold hover:bg-accent/90 transition active:scale-[.98]"
                                    >
                                      {t("bill.save")}
                                    </button>
                                  </form>
                                </>
                              ) : (
                                <p className="text-xs text-muted italic">
                                  {lang === "th"
                                    ? "บิลปิดแล้ว ไม่สามารถแก้ไขผู้รับผิดชอบได้"
                                    : "Bill is closed — assignment is locked"}
                                </p>
                              )}
                            </div>
                            )}

                            {/* Payment actions */}
                            {activeTab === "payment" && (
                            <div className="space-y-1.5">
                              <div
                                className="flex flex-wrap items-center gap-3"
                                onClick={(e) => e.stopPropagation()} // Prevent closing row
                              >
                                <div className="flex flex-wrap gap-2">
                                  {p.slipImagePath && (
                                    <Link
                                      href={`/api/uploads/${p.slipImagePath}`}
                                      target="_blank"
                                      className="rounded-xl border border-border bg-white px-3.5 py-2.5 text-xs text-brand font-bold hover:bg-brand/5 shadow-xs inline-flex items-center gap-1.5 transition"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                      </svg>
                                      {t("bill.viewSlip")}
                                    </Link>
                                  )}
                                  {p.slipImagePath && (
                                    <button
                                      type="button"
                                      onClick={() => setSlipToDelete({ id: p.id, name: p.itemName })}
                                      className="rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-xs text-red-600 font-bold hover:bg-red-50 shadow-xs transition"
                                    >
                                      {lang === "th" ? "ลบสลิป" : "Delete Slip"}
                                    </button>
                                  )}

                                  {p.paymentStatus !== "PAID" ? (
                                    <form
                                      action={async () => {
                                        await markPaid(p.id);
                                      }}
                                    >
                                      <button className="rounded-xl bg-brand text-white px-3.5 py-2.5 text-xs font-bold hover:bg-brand/90 transition active:scale-[.98]">
                                        ✓ {t("bill.confirm.paid")}
                                      </button>
                                    </form>
                                  ) : (
                                    <form
                                      action={async () => {
                                        await markUnpaid(p.id);
                                      }}
                                    >
                                      <button className="rounded-xl bg-amber-600 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-amber-700 transition active:scale-[.98] inline-flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                        {t("bill.cancel.confirm")}
                                      </button>
                                    </form>
                                  )}
                                </div>
                              </div>
                            </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
                };
                const packMap = new Map<string, ParticipantData[]>();
                const singles: ParticipantData[] = [];
                for (const p of filtered) {
                  if (p.packId) {
                    const arr = packMap.get(p.packId) ?? [];
                    arr.push(p);
                    packMap.set(p.packId, arr);
                  } else singles.push(p);
                }
                return (
                  <>
                    {[...packMap.entries()].map(([packId, rows]) => {
                      const open = openPacks.has(packId);
                      const pName = rows[0].packName ?? (lang === "th" ? "แพ็ค" : "Pack");
                      const pPrice = rows.reduce((s, x) => s + x.price, 0);
                      const pDiscount = rows.reduce((s, x) => s + x.discountShare, 0);
                      const pNet = rows.reduce((s, x) => s + x.amountToPay, 0);
                      return (
                        <React.Fragment key={"pack:" + packId}>
                          <tr
                            onClick={() => togglePack(packId)}
                            className="cursor-pointer border-t border-border hover:bg-muted/5 transition-colors select-none"
                          >
                            {claimCol && <td className="p-3" />}
                            <td className="p-3 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand">
                                  {lang === "th" ? "แพ็ค" : "Pack"}
                                </span>
                                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                                  {pName}
                                </span>
                                <span className="text-[10px] text-muted shrink-0">{open ? "▲" : "▼"}</span>
                              </div>
                              <div className="text-[10px] text-muted mt-0.5">
                                {rows.length} {lang === "th" ? "รายการย่อย" : "sub-items"}
                              </div>
                            </td>
                            <td className="p-3 text-right whitespace-nowrap align-middle">
                              <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted/70">
                                {lang === "th" ? "รวม" : "Total"}
                              </span>
                              <span className={`text-sm font-medium ${pDiscount > 0 ? "text-muted/60" : "text-foreground"}`}>
                                {baht(pPrice)}
                              </span>
                              {pDiscount > 0 && (
                                <>
                                  <span className="block text-[10px] font-medium text-red-500">-{baht(pDiscount)}</span>
                                  <span className="block text-sm font-semibold text-foreground">{baht(pNet)}</span>
                                </>
                              )}
                            </td>
                          </tr>
                          {open && rows.map((r, i) => renderItemRow(r, true, i === rows.length - 1))}
                        </React.Fragment>
                      );
                    })}
                    {groupByPayer(singles).map((g, gi) => {
                      const subtotal = g.items.reduce((s, p) => s + p.price, 0);
                      return (
                        <React.Fragment key={"payer:" + gi}>
                          {g.kind !== "unassigned" && (
                            <tr className="border-t border-border bg-muted/20">
                              <td colSpan={colCount} className="px-3 py-1.5 text-[11px] font-bold text-foreground">
                                {g.name} · {g.items.length} {lang === "th" ? "รายการ" : "items"}
                              </td>
                            </tr>
                          )}
                          {g.items.map((p) => renderItemRow(p))}
                          {g.kind !== "unassigned" && (
                            <tr className="border-t border-border/60 bg-muted/5">
                              {claimCol && <td />}
                              <td className="px-3 py-1.5 text-[11px] font-semibold text-muted">
                                {lang === "th" ? "รวม" : "Subtotal"} {g.name}
                              </td>
                              <td className="px-3 py-1.5 text-right text-[11px] font-bold text-foreground">
                                {baht(subtotal)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </>
                );
              })()
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              {unassignedCount > 0 && (
                <tr className="border-t border-border bg-muted/20 text-foreground">
                  <td colSpan={colCount} className="px-3 py-1.5 text-[11px] font-bold">
                    {lang === "th"
                      ? `ยังไม่ระบุคน · ${unassignedCount} รายการ`
                      : `Unassigned · ${unassignedCount} items`}
                  </td>
                </tr>
              )}
              {(() => {
                const hasAdjust = totalDiscount > 0 || deliveryFee > 0;
                const { perHead: perHeadDelivery, remainder: deliveryRemainder, ownerShare: ownerDelivery } =
                  deliverySplit(deliveryFee, deliveryPersonCount);

                // No discount/delivery: keep the plain single total row.
                if (!hasAdjust) {
                  return (
                    <tr className="bg-muted/10 font-bold border-t-2 border-border text-foreground">
                      {claimCol && <td className="p-3" />}
                      <td className="p-3 text-xs font-bold text-foreground">{t("bill.totalAmount")}</td>
                      <td className="p-3 text-right text-xs whitespace-nowrap font-bold">{baht(totalOriginalPrice)}</td>
                    </tr>
                  );
                }

                return (
                  <>
                    <tr className="bg-muted/10 border-t-2 border-border">
                      <td colSpan={colCount} className="px-3 pt-2.5 pb-1 text-xs font-bold text-foreground">
                        {lang === "th" ? "สรุปรายการ" : "Summary"}
                      </td>
                    </tr>
                    {deliveryFee > 0 && (
                      <>
                        <tr className="bg-muted/10 text-muted">
                          {claimCol && <td className="px-3" />}
                          <td className="px-3 py-0.5 text-xs font-medium align-middle">
                            {lang === "th" ? "ค่าส่งรวม" : "Total Delivery"}
                            <span className="block text-[10px] font-normal text-muted/80">
                              {lang === "th" ? `หาร ${deliveryPersonCount} คน` : `split ${deliveryPersonCount}`}
                            </span>
                          </td>
                          <td className="px-3 py-0.5 text-right text-xs whitespace-nowrap align-middle">+{baht(deliveryFee)}</td>
                        </tr>
                        <tr className="bg-muted/10 text-muted">
                          {claimCol && <td className="px-3" />}
                          <td className="px-3 py-0.5 text-xs font-medium">{lang === "th" ? "ค่าส่งต่อคน" : "Delivery / person"}</td>
                          <td className="px-3 py-0.5 text-right text-xs whitespace-nowrap">{baht(perHeadDelivery)}</td>
                        </tr>
                        {deliveryRemainder > 0 && (
                          <tr className="bg-muted/10 text-muted">
                            {claimCol && <td className="px-3" />}
                            <td className="px-3 py-0.5 text-xs font-medium align-middle">
                              {lang === "th" ? "เศษปัดเศษ" : "Rounding remainder"}
                              <span className="block text-[10px] font-normal text-muted/80">
                                {lang === "th" ? "เจ้าของบิลจ่าย" : "paid by the bill owner"}
                              </span>
                            </td>
                            <td className="px-3 py-0.5 text-right text-xs whitespace-nowrap align-middle">
                              +{baht(deliveryRemainder)} = {baht(ownerDelivery)}
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                    <tr className="bg-muted/10 text-muted">
                      {claimCol && <td className="px-3" />}
                      <td className="px-3 py-0.5 text-xs font-medium">{t("bill.totalAmount")}</td>
                      <td className="px-3 py-0.5 text-right text-xs whitespace-nowrap">{baht(totalOriginalPrice)}</td>
                    </tr>
                    {totalDiscount > 0 && (
                      <tr className="bg-muted/10 text-red-500">
                        {claimCol && <td className="px-3" />}
                        <td className="px-3 py-0.5 text-xs font-medium">{lang === "th" ? "ส่วนลด" : "Discount"}</td>
                        <td className="px-3 py-0.5 text-right text-xs whitespace-nowrap">-{baht(totalDiscount)}</td>
                      </tr>
                    )}
                    <tr className="bg-muted/10 font-bold text-brand border-t border-border/60">
                      {claimCol && <td className="p-3" />}
                      <td className="p-3 text-xs font-bold">{lang === "th" ? "ยอดสุทธิ" : "Net Total"}</td>
                      <td className="p-3 text-right text-xs whitespace-nowrap">{baht(billNet)}</td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          )}
        </table>
      </div>

      {/* Non-owner self-claim: confirm the ticked items */}
      {claimCol && participants.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={confirmClaims}
            disabled={!claimDirty || claimPending}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("bill.claim.confirm")}
          </button>
          <p className="text-center text-[10px] text-muted">{t("bill.claim.hint")}</p>
        </div>
      )}

      {/* Share Modal Dialog */}
      <ShareBillModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        postId={postId}
        postTitle={postTitle}
        postNote={postNote}
        ownerName={ownerName}
        ownerQr={ownerQr}
        ownerPromptpay={ownerPromptpay}
        participants={participants}
        deliveryFee={deliveryFee}
        deliveryPersonCount={deliveryPersonCount}
      />

      <ConfirmModal
        isOpen={!!itemToDelete}
        title={lang === "th" ? "ยืนยันการลบรายการ" : "Confirm Delete Item"}
        message={
          lang === "th"
            ? `คุณแน่ใจหรือไม่ว่าต้องการลบรายการ "${itemToDelete?.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้.`
            : `Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone.`
        }
        confirmText={lang === "th" ? "ลบรายการ" : "Delete Item"}
        onConfirm={async () => {
          if (itemToDelete) {
            await removeParticipant(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onClose={() => setItemToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!slipToDelete}
        title={lang === "th" ? "ยืนยันการลบสลิป" : "Confirm Delete Slip"}
        message={
          lang === "th"
            ? `ลบสลิปของรายการ "${slipToDelete?.name}"? รายการนี้จะกลับไปเป็นยังไม่จ่าย และเปิดให้แนบสลิปใหม่ได้`
            : `Delete the slip for "${slipToDelete?.name}"? It will revert to unpaid and can be re-uploaded.`
        }
        confirmText={lang === "th" ? "ลบสลิป" : "Delete Slip"}
        onConfirm={async () => {
          if (slipToDelete) {
            await deleteSlip(slipToDelete.id);
            setSlipToDelete(null);
          }
        }}
        onClose={() => setSlipToDelete(null)}
      />
    </div>
  );
}
