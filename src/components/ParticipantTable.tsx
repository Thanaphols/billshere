"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { baht } from "@/lib/format";
import { perHeadDeliveryFee } from "@/lib/discount";
import type { DiscountType } from "@prisma/client";
import AddMenuItemForm from "@/components/AddMenuItemForm";
import ShareBillModal from "@/components/ShareBillModal";
import ConfirmModal from "@/components/ConfirmModal";
import Dropdown from "@/components/Dropdown";
import { useI18n } from "@/lib/i18n";
import {
  addMenuItem,
  assignParticipantUser,
  removeParticipant,
  markPaid,
  markUnpaid,
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
  discountShare: number;
  amountToPay: number;
  paymentStatus: string;
  slipImagePath: string | null;
  paidAt: Date | null;
  userId: string | null;
  guestName: string | null;
  user?: UserOption | null;
};

export default function ParticipantTable({
  participants,
  allUsers,
  isOwner,
  postId,
  postStatus,
  existingPrices,
  discountType,
  discountValue,
  deliveryFee,
  deliveryPersonCount,
  ownerQr,
  ownerName,
  postTitle,
  postNote,
}: {
  participants: ParticipantData[];
  allUsers: UserOption[];
  isOwner: boolean;
  postId: string;
  postStatus: "OPEN" | "CLOSED";
  existingPrices: number[];
  discountType: DiscountType;
  discountValue: number;
  deliveryFee: number;
  deliveryPersonCount: number;
  ownerQr: string | null;
  ownerName: string;
  postTitle: string;
  postNote: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignModes, setAssignModes] = useState<Record<string, "user" | "guest">>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [slipToDelete, setSlipToDelete] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "UNPAID" | "SLIP_UPLOADED" | "PAID">("all");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { t, lang } = useI18n();

  useEffect(() => {
    const eventSource = new EventSource(`/api/posts/${postId}/stream`);

    eventSource.onmessage = (event) => {
      if (event.data === "update") {
        startTransition(() => {
          router.refresh();
        });
      }
    };

    return () => {
      eventSource.close();
    };
  }, [postId, router]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
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
  const totalAmountToPay = participants.reduce((s, p) => s + p.amountToPay, 0);
  const perHeadDelivery = perHeadDeliveryFee(deliveryFee, deliveryPersonCount);

  // Client-side view filter — data is already loaded, no server round-trip.
  const q = search.trim().toLowerCase();
  const filtered = participants.filter((p) => {
    const name = (p.user?.name ?? p.guestName ?? "").toLowerCase();
    const matchText = !q || p.itemName.toLowerCase().includes(q) || name.includes(q);
    const matchStatus = statusFilter === "all" || p.paymentStatus === statusFilter;
    return matchText && matchStatus;
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

          {isOwner && (
            <button
              onClick={() => setShowAddForm((prev) => !prev)}
              className={`rounded-full w-7 h-7 flex items-center justify-center font-bold transition-all border text-sm shadow-xs ${
                showAddForm
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
            action={async (fd) => {
              await addMenuItem(postId, fd);
              setShowAddForm(false);
            }}
            existingPrices={existingPrices}
            discountType={discountType}
            discountValue={discountValue}
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
          <div className="w-32 shrink-0">
            <Dropdown
              name="statusFilter"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              placeholder={lang === "th" ? "ทุกสถานะ" : "All status"}
              options={[
                { value: "all", label: lang === "th" ? "ทุกสถานะ" : "All status" },
                { value: "UNPAID", label: t("bill.status.unpaid") },
                { value: "SLIP_UPLOADED", label: t("bill.status.uploaded") },
                { value: "PAID", label: t("bill.status.paid") },
              ]}
            />
          </div>
        </div>
      )}

      {/* Main table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full text-xs text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-background text-muted uppercase tracking-wider border-b border-border">
              <th className="p-3 font-semibold w-[46%]">{lang === "th" ? "รายการ (ผู้จ่าย)" : "Item (Payer)"}</th>
              <th className="p-3 text-right font-semibold w-[27%]">{t("bill.amount")}</th>
              <th className="p-3 text-right font-semibold w-[27%]">{t("bill.total")}</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-sm text-muted">
                  {t("bill.empty")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-sm text-muted">
                  {lang === "th" ? "ไม่พบรายการที่ค้นหา" : "No matching items"}
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isExpanded = expandedId === p.id;
                const displayName = p.user?.name ?? p.guestName ?? (lang === "th" ? "ยังไม่ระบุคน" : "Unassigned");
                const isGuest = !p.userId && p.guestName;
                const isUnassigned = !p.userId && !p.guestName;
                const mode = getAssignMode(p.id, !!p.guestName, !!p.userId);

                return (
                  <React.Fragment key={p.id}>
                    {/* Main row, clicking anywhere on it toggles expanded view for owner */}
                    <tr
                      onClick={() => isOwner && toggleExpand(p.id)}
                      className={`hover:bg-muted/5 border-t border-border transition-colors select-none ${
                        isOwner ? "cursor-pointer" : ""
                      } ${isExpanded ? "bg-muted/5" : ""}`}
                    >
                      <td className="p-3 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
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
                            className={`truncate max-w-[100px] ${
                              isUnassigned
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
                        <p className="font-medium text-foreground">{baht(p.price)}</p>
                        {p.discountShare > 0 && (
                          <p className="text-[10px] text-red-500 font-medium">
                            -{baht(p.discountShare)}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-brand whitespace-nowrap">
                        {baht(p.amountToPay)}
                      </td>
                    </tr>

                    {/* Single-column, stacked actions panel for mobile view */}
                    {isOwner && isExpanded && (
                      <tr className="bg-muted/10">
                        <td colSpan={3} className="p-3 bg-muted/20 border-t border-border">
                          <div className="space-y-3.5">
                            {/* Assignment form */}
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0 1 10.089 21c-2.9 0-5.54-1.09-7.533-2.892a4.125 4.125 0 0 1 7.533-2.493M18.908 18v.008h-.008V18h.008Zm-8.82 0v.008h-.008V18h.008ZM12 7.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm7.35 1.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                </svg>
                                {t("bill.owner")}
                              </p>

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
                                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                                        mode === "user" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
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
                                      className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
                                        mode === "guest" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
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
                                      className="w-full rounded-xl bg-brand text-white py-2 px-4 text-xs font-bold hover:bg-brand/90 transition active:scale-[.98]"
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

                            {/* Payment actions & delete */}
                            <div className="space-y-1.5 pt-3 border-t border-border/40">
                              <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5m-18 3h18M3.75 10.5h16.5m-18 3h16.5M4 19.5a2 2 0 0 0 2-2v-3.75a2 2 0 0 0-2-2H3v7.75c0 .552.448 1 1 1Zm11.75-2v-3.75a2 2 0 0 0-2-2H13v7.75c0 .552.448 1 1 1h.75a2 2 0 0 0 2-2Z" />
                                </svg>
                                {t("bill.payment")}
                              </p>
                              <div
                                className="flex flex-wrap items-center justify-between gap-3"
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

                                <button
                                  type="button"
                                  onClick={() => setItemToDelete({ id: p.id, name: p.itemName })}
                                  className="text-xs font-bold text-red-500 hover:text-red-700 transition px-2 py-1 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                  {t("bill.delete")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          {participants.length > 0 && (
            <tfoot>
              <tr className="bg-muted/10 font-bold border-t-2 border-border text-foreground">
                <td className="p-3 text-xs font-bold text-foreground">{t("bill.totalAmount")}</td>
                <td className="p-3 text-right text-xs whitespace-nowrap">{baht(totalOriginalPrice)}</td>
                <td className="p-3 text-right text-xs text-brand whitespace-nowrap">
                  {baht(totalAmountToPay)}
                </td>
              </tr>
              {deliveryFee > 0 && (
                <tr className="border-t border-border/60 text-muted">
                  <td colSpan={2} className="p-3 text-xs font-semibold">
                    {lang === "th"
                      ? `ค่าส่ง (หาร ${deliveryPersonCount} คน)`
                      : `Delivery (split ${deliveryPersonCount} ways)`}
                    <span className="ml-1 font-normal text-[10px]">
                      {lang === "th" ? `รวม ${baht(deliveryFee)}` : `total ${baht(deliveryFee)}`}
                    </span>
                  </td>
                  <td className="p-3 text-right text-xs font-bold text-foreground whitespace-nowrap">
                    {lang === "th" ? `คนละ ${baht(perHeadDelivery)}` : `${baht(perHeadDelivery)}/person`}
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* Share Modal Dialog */}
      <ShareBillModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        postId={postId}
        isOwner={isOwner}
        postTitle={postTitle}
        postNote={postNote}
        ownerName={ownerName}
        ownerQr={ownerQr}
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
