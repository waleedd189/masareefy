"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-xl border border-ink-700/70 bg-ink-950/70 px-3 py-2 font-mono text-[11px] text-ink-300">
        {value}
      </code>
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 !text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "تم النسخ ✅" : (label ?? "نسخ")}
      </button>
    </div>
  );
}
