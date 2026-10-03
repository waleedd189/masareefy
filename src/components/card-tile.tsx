import Link from "next/link";
import type { Card } from "@/db/schema";
import { CARD_TYPE_LABELS, cardGradient } from "@/lib/constants";
import { formatMoney, maskedCard } from "@/lib/format";
import { utilization } from "@/lib/services/balances";

export function CardTile({ card, spentThisMonth }: { card: Card; spentThisMonth?: number }) {
  const used = utilization(card);
  const isCredit = card.type === "CREDIT";

  return (
    <Link
      href={`/cards/${card.id}`}
      className="group relative block overflow-hidden rounded-3xl p-5 text-white shadow-xl shadow-black/40 transition hover:-translate-y-1"
      style={{ background: cardGradient(card.color) }}
    >
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -bottom-12 -right-6 h-36 w-36 rounded-full bg-black/20 blur-xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold leading-tight">{card.name}</p>
          <p className="mt-0.5 text-[11px] text-white/70">{card.bankName || "بنك"}</p>
        </div>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold tracking-wide">
          {card.brand}
        </span>
      </div>

      <p className="relative mt-5 font-mono text-lg tracking-[0.25em] text-white/90">{maskedCard(card.last4)}</p>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/60">
            {isCredit ? "المستحق عليك" : "الرصيد الحالي"}
          </p>
          <p className="text-xl font-extrabold tabular-nums">{formatMoney(card.currentBalance, card.currency)}</p>
        </div>
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wide text-white/60">
            {isCredit ? "المتاح" : "مصروف الشهر"}
          </p>
          <p className="text-sm font-bold tabular-nums">
            {isCredit
              ? card.availableAmount !== null
                ? formatMoney(card.availableAmount, card.currency)
                : "—"
              : formatMoney(spentThisMonth ?? 0, card.currency)}
          </p>
        </div>
      </div>

      {used !== null ? (
        <div className="relative mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div
              className={`h-full rounded-full ${used > 80 ? "bg-rose-300" : used > 50 ? "bg-amber-300" : "bg-white/90"}`}
              style={{ width: `${used}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-white/70">
            استُخدم {used}% من حد {formatMoney(card.creditLimit ?? 0, card.currency, { compact: true })}
          </p>
        </div>
      ) : (
        <p className="relative mt-4 text-[10px] text-white/70">{CARD_TYPE_LABELS[card.type] ?? card.type}</p>
      )}
    </Link>
  );
}
