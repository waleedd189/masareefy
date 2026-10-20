"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { mergeMerchantsAction } from "@/server/actions/merchants";
import type { MerchantGroup } from "@/lib/services/merchants";

/**
 * لوحة اقتراحات دمج التجار: كل مجموعة فيها أشكال مختلفة لنفس التاجر،
 * تختار الاسم الموحّد وتدمج — العمليات بتتحدّث والفئة بتتوحّد.
 */
export function MerchantsPanel({ groups }: { groups: MerchantGroup[] }) {
  const [picked, setPicked] = useState<Record<number, string>>({});

  if (!groups.length) {
    return (
      <p className="py-4 text-center text-xs text-ink-400">
        مفيش تجار متشابهين لسه — كل ما العمليات تزيد، الاقتراحات هتظهر هنا.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {groups.map((group, index) => {
        const canonical = picked[index] ?? group.canonical;
        const variants = group.variants.map((v) => v.merchant);
        return (
          <li key={`${index}-${group.canonical}`} className="rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink-100">
                {group.variants.length} أشكال لنفس التاجر{" "}
                <span className="font-medium text-ink-500">({group.reason})</span>
              </p>
              <div className="flex items-center gap-2 text-[11px]">
                <Badge className="border-brand-500/30 bg-brand-500/10 text-brand-300">
                  <span data-money>{formatMoney(group.total)}</span>
                </Badge>
                <span className="text-ink-500">{group.count} عملية</span>
              </div>
            </div>

            <form action={mergeMerchantsAction} className="space-y-2">
              <input type="hidden" name="variants" value={JSON.stringify(variants)} />
              <input type="hidden" name="canonical" value={canonical} />

              <ul className="flex flex-wrap gap-1.5">
                {group.variants.map((variant) => (
                  <li key={variant.merchant}>
                    <button
                      type="button"
                      onClick={() => setPicked((current) => ({ ...current, [index]: variant.merchant }))}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                        canonical === variant.merchant
                          ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
                          : "border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200"
                      }`}
                      title={canonical === variant.merchant ? "ده الاسم الموحّد المختار" : "اختار ده كاسم موحّد"}
                    >
                      {canonical === variant.merchant ? "✓ " : ""}
                      {variant.merchant}
                      <span className="ms-1 text-[10px] opacity-70">({variant.count})</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary !px-3 !py-1.5 !text-[11px]">
                  دمج في «{canonical}»
                </button>
                <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <input type="checkbox" name="unifyCategory" defaultChecked className="h-3.5 w-3.5 accent-emerald-500" />
                  توحيد الفئة كمان
                </label>
              </div>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
