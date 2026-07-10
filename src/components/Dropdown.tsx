"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { value: string; label: string };

export default function Dropdown({
  name,
  value,
  defaultValue,
  onChange,
  options,
  placeholder,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: Option[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const current = value !== undefined ? value : internalValue;

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    updateRect();
    const onOutsideClick = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [open]);

  const select = (v: string) => {
    if (onChange) onChange(v);
    else setInternalValue(v);
    setOpen(false);
  };

  const selected = options.find((o) => o.value === current);

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-brand cursor-pointer"
      >
        <span className={`truncate text-left ${selected ? "text-foreground" : "text-muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`w-3.5 h-3.5 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 max-h-56 overflow-auto rounded-xl border border-border bg-white shadow-lg py-1"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  select(o.value);
                }}
                className={`w-full text-left px-3 py-2 text-xs truncate transition hover:bg-muted/10 ${
                  current === o.value ? "text-brand font-semibold bg-brand/5" : "text-foreground"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
