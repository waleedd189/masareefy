"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export function CollapsiblePanel({
  label,
  openLabel,
  children,
  defaultOpenParam,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode;
  /** يفتح تلقائياً لو الـ query param ده موجود */
  defaultOpenParam?: string;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(() => Boolean(defaultOpenParam && params.get(defaultOpenParam)));

  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className={open ? "btn-ghost" : "btn-primary"}>
        {open ? "إغلاق" : (openLabel ?? label)}
      </button>
      {open ? <div className="mt-4 animate-rise">{children}</div> : null}
    </div>
  );
}
