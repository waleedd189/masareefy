"use client";

import { useMemo, useState } from "react";

/**
 * شريط التصدير: اختار الفترة ونزّل Excel/CSV/نسخة احتياطية أو اطبع PDF.
 * مقابل `export_screen/{excel,pdf,backup}-color.svg` في Mezanetak.
 */
export function ExportBar({
  defaultFrom,
  defaultTo,
  defaultCmpFrom,
  defaultCmpTo,
}: {
  defaultFrom: string;
  defaultTo: string;
  defaultCmpFrom: string;
  defaultCmpTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [cmpFrom, setCmpFrom] = useState(defaultCmpFrom);
  const [cmpTo, setCmpTo] = useState(defaultCmpTo);

  const query = useMemo(() => new URLSearchParams({ from, to }).toString(), [from, to]);
  const compareQuery = useMemo(
    () => new URLSearchParams({ from, to, cmpFrom, cmpTo }).toString(),
    [from, to, cmpFrom, cmpTo],
  );

  const links = [
    { href: `/api/export?format=xlsx&${query}`, label: "📊 Excel (تقرير كامل)", primary: true },
    { href: `/api/export?format=csv&${query}`, label: "📄 CSV" },
    { href: `/api/export?format=transactions-csv&${query}`, label: "🧾 العمليات CSV" },
    { href: `/api/export?format=messages-csv&${query}`, label: "📨 الرسائل CSV" },
    { href: `/api/export?format=backup&${query}`, label: "🧰 نسخة احتياطية JSON" },
  ];

  function quickRange(monthsBack: number) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    setFrom(startDate.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="field-label">من</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field !w-auto !py-1.5 !text-xs" />
        </label>
        <label className="space-y-1">
          <span className="field-label">إلى</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field !w-auto !py-1.5 !text-xs" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => quickRange(0)} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
            الشهر ده
          </button>
          <button type="button" onClick={() => quickRange(2)} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
            آخر 3 شهور
          </button>
          <button type="button" onClick={() => quickRange(11)} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
            السنة دي
          </button>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-ghost !px-3 !py-1.5 !text-[11px] print:hidden">
          🖨️ طباعة / PDF
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-ink-700/50 bg-ink-950/40 p-2.5 print:hidden">
        <span className="text-[11px] font-bold text-ink-300">⚖️ قارن بفترة:</span>
        <label className="space-y-1">
          <span className="field-label">من</span>
          <input type="date" value={cmpFrom} onChange={(e) => setCmpFrom(e.target.value)} className="field !w-auto !py-1.5 !text-xs" />
        </label>
        <label className="space-y-1">
          <span className="field-label">إلى</span>
          <input type="date" value={cmpTo} onChange={(e) => setCmpTo(e.target.value)} className="field !w-auto !py-1.5 !text-xs" />
        </label>
        <a href={`/reports?${compareQuery}`} className="btn-primary !px-3 !py-1.5 !text-[11px]">
          طبّق المقارنة
        </a>
        <a href={`/reports?${query}`} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
          الفترة السابقة تلقائيًا
        </a>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={
              link.primary
                ? "btn-primary !px-3 !py-1.5 !text-[11px]"
                : "btn-ghost !px-3 !py-1.5 !text-[11px]"
            }
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
