"use client";

import React, { createContext, useContext, useCallback, useState } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(
  () => {}
);

/** Fire a toast from anywhere under <ToastProvider>: `const toast = useToast(); toast("บันทึกแล้ว")`. */
export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: (
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  ),
  error: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  ),
  info: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
  ),
};

const STYLES: Record<ToastKind, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-gray-900 text-white",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    // Small delay so the toast doesn't flash up the instant the button is pressed.
    setTimeout(() => {
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    }, 350);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed inset-x-0 bottom-24 z-[100] flex flex-col-reverse items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 rounded-xl px-5 py-3.5 shadow-2xl animate-fade-in max-w-sm w-full sm:w-auto ${STYLES[t.kind]}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 shrink-0"
            >
              {ICONS[t.kind]}
            </svg>
            <span className="text-sm font-bold">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
