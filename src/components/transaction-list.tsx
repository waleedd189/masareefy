import Link from "next/link";
import { formatDateTime, formatMoney, maskedCard } from "@/lib/format";
import type { TransactionWithRelations } from "@/lib/services/queries";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import { EmptyState } from "./ui";

const TYPE_ICONS: Record<string, string> = {
  PURCHASE: "🛍️",
  REFUND: "↩️",
  PAYMENT: "💳",
  WITHDRAWAL: "🏧",
  DEPOSIT: "💰",
  FEE: "🏦",
  TRANSFER_IN: "⬇️",
  TRANSFER_OUT: "⬆️",
  UNKNOWN: "❔",
};

export function TransactionList({
  transactions,
  showCard = true,
  emptyHint,
}: {
  transactions: TransactionWithRelations[];
  showCard?: boolean;
  emptyHint?: string;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon="🧾"
        title="مفيش عمليات هنا"
        description={emptyHint ?? "الصق رسالة من البنك أو ضيف عملية يدوياً وهتظهر هنا."}
        actionLabel="الصق رسالة بنك"
        actionHref="/messages"
      />
    );
  }

  return (
    <ul className="divide-y divide-ink-700/50">
      {transactions.map((tx) => {
        const isIn = tx.direction === "IN";
        return (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink-800/80 text-base">
              {tx.category?.emoji ?? TYPE_ICONS[tx.type] ?? "❔"}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {tx.merchant || tx.description || TX_TYPE_LABELS[tx.type as TxType] || "عملية"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-400">
                <span>{formatDateTime(tx.occurredAt)}</span>
                {tx.category ? <span>· {tx.category.name}</span> : null}
                {showCard && tx.card ? (
                  <Link href={`/cards/${tx.card.id}`} className="hover:text-brand-300">
                    · {tx.card.name} {maskedCard(tx.card.last4)}
                  </Link>
                ) : null}
                {tx.source === "SMS" ? <span className="text-brand-400">· من رسالة بنك</span> : null}
              </p>
            </div>

            <div className="text-left">
              <p className={`text-sm font-extrabold tabular-nums ${isIn ? "text-emerald-300" : "text-ink-50"}`}>
                {isIn ? "+" : "−"} {formatMoney(tx.amount, tx.currency)}
              </p>
              {tx.fxAmount && tx.fxCurrency ? (
                <p className="text-[10px] text-ink-400">{formatMoney(tx.fxAmount, tx.fxCurrency)}</p>
              ) : null}
              {tx.availableAfter !== null && tx.availableAfter !== undefined ? (
                <p className="text-[10px] text-ink-500">متاح: {formatMoney(tx.availableAfter, tx.currency)}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
