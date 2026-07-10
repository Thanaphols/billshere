"use client";

import { useState, useRef } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useI18n } from "@/lib/i18n";

export default function AddMenuItemForm({
  action,
  allUsers = [],
}: {
  action: (formData: FormData) => void;
  allUsers?: { id: string; name: string; email: string }[];
}) {
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [userId, setUserId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [assignMode, setAssignMode] = useState<"user" | "guest">("user");
  const formRef = useRef<HTMLFormElement>(null);
  const { t, lang } = useI18n();

  const handleFormAction = async (formData: FormData) => {
    await action(formData);
    setPrice("");
    setQuantity("1");
    setUserId("");
    setGuestName("");
    setAssignMode("user");
    formRef.current?.reset();
  };

  return (
    <form ref={formRef} action={handleFormAction} className="mt-3 space-y-3">
      <input
        name="itemName"
        placeholder={lang === "th" ? "รายการ เช่น โกโก้เข้มข้น (กลาง)" : "Item, e.g. Cocoa (Large)"}
        required
        className="w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm"
      />
      <div className="flex gap-2">
        <div className="flex-[2]">
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder={lang === "th" ? "ราคา (บาท)" : "Price (Baht)"}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm"
          />
        </div>
        <div className="flex-1">
          <input
            name="quantity"
            type="number"
            min="1"
            required
            placeholder={lang === "th" ? "จำนวน" : "Qty"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="no-spinner w-full rounded-xl border border-border bg-white px-3 py-3 outline-none focus:border-brand text-sm text-center"
          />
        </div>
      </div>

      <div className="border-t border-dashed border-border pt-3 space-y-2.5">
        <span className="block text-xs font-semibold text-muted">
          {lang === "th" ? "กำหนดเจ้าของเมนู (เพิ่มทีหลังได้)" : "Assign menu owner (optional)"}
        </span>

        {/* Segment selector toggle */}
        <div className="flex rounded-xl border border-border p-0.5 bg-background text-[10px] w-full font-bold">
          <button
            type="button"
            onClick={() => setAssignMode("user")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              assignMode === "user" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
            }`}
          >
            {lang === "th" ? "เลือกจากสมาชิก" : "Choose Member"}
          </button>
          <button
            type="button"
            onClick={() => setAssignMode("guest")}
            className={`flex-1 py-1.5 text-center rounded-lg transition-all ${
              assignMode === "guest" ? "bg-white shadow-xs text-brand" : "text-muted font-medium"
            }`}
          >
            {lang === "th" ? "กำหนดเอง (พิมพ์ชื่อ)" : "Custom Name"}
          </button>
        </div>

        <div>
          {assignMode === "user" ? (
            <div className="relative">
              <select
                name="userId"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setGuestName("");
                }}
                className="w-full rounded-xl border border-border bg-white px-3 pr-10 py-3 text-sm outline-none focus:border-brand appearance-none cursor-pointer"
              >
                <option value="">{lang === "th" ? "— เลือกสมาชิกในระบบ —" : "— Choose Member —"}</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          ) : (
            <input
              name="guestName"
              placeholder={lang === "th" ? "พิมพ์ชื่อคนจ่ายเอง (ไม่มีบัญชี)" : "Type guest name"}
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setUserId("");
              }}
              className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-none focus:border-brand"
            />
          )}
        </div>
      </div>

      <SubmitButton>{t("bill.addMenu")}</SubmitButton>
    </form>
  );
}
