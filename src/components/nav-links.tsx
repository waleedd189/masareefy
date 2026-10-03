"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "الرئيسية", icon: "📊" },
  { href: "/cards", label: "البطاقات", icon: "💳" },
  { href: "/transactions", label: "العمليات", icon: "🧾" },
  { href: "/messages", label: "رسائل البنك", icon: "📨" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export function NavLinks({ variant = "side" }: { variant?: "side" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (variant === "bottom") {
    return (
      <ul className="flex items-center justify-between gap-1">
        {LINKS.map((link) => (
          <li key={link.href} className="flex-1">
            <Link
              href={link.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${
                isActive(link.href) ? "bg-brand-500/15 text-brand-300" : "text-ink-400"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive(link.href)
                ? "bg-brand-500/15 text-brand-300 shadow-inner shadow-brand-500/10"
                : "text-ink-300 hover:bg-ink-800/60 hover:text-ink-50"
            }`}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
