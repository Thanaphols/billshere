"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "หน้าแรก", icon: "🏠" },
  { href: "/search", label: "ค้นหา", icon: "🔍" },
  { href: "/posts/new", label: "สร้าง", icon: "➕", primary: true },
  { href: "/summary", label: "สรุป", icon: "📊" },
  { href: "/profile", label: "ฉัน", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-border bg-surface">
      <ul className="mx-auto flex max-w-[480px] items-stretch justify-around">
        {ITEMS.map((it) => {
          const active =
            it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <span
                  className={`text-xl ${
                    it.primary
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"
                      : ""
                  }`}
                >
                  {it.icon}
                </span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
