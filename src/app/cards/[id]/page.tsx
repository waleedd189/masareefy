import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CardTile } from "@/components/card-tile";
import { MonthlyBars } from "@/components/charts";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { CardForm } from "@/components/forms/card-form";
import { TransactionList } from "@/components/transaction-list";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";
import { CARD_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { getCard, listTransactions } from "@/lib/services/queries";
import { getCardStats } from "@/lib/services/stats";
import { utilization } from "@/lib/services/balances";
import { deleteCardAction } from "@/server/actions/cards";

export const dynamic = "force-dynamic";

export default async function CardDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();

  const [stats, transactions] = await Promise.all([getCardStats(card.id), listTransactions({ cardId: card.id, limit: 60 })]);
  const used = utilization(card);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title={card.name}
        subtitle={`${card.bankName || "بنك"} · ${CARD_TYPE_LABELS[card.type]}`}
        action={
          <Link href="/cards" className="btn-ghost">
            ← كل البطاقات
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <CardTile card={card} spentThisMonth={stats.spentThisMonth} />

        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <StatCard label="مصروف الشهر" value={formatMoney(stats.spentThisMonth, card.currency)} icon="💸" />
          <StatCard label="عدد العمليات" value={String(stats.txCount)} hint="الشهر الحالي" icon="🧾" />
          <StatCard
            label={card.type === "CREDIT" ? "المستحق" : "الرصيد"}
            value={formatMoney(card.currentBalance, card.currency)}
            icon="💳"
            tone={card.type === "CREDIT" && used && used > 70 ? "bad" : "default"}
          />
          <StatCard
            label="آخر عملية"
            value={stats.lastTransactionAt ? formatDate(stats.lastTransactionAt) : "—"}
            hint={card.balanceSyncedAt ? `آخر رصيد من البنك: ${formatDate(card.balanceSyncedAt)}` : undefined}
            icon="🕒"
          />
        </div>
      </div>

      <SectionCard title="المصروفات آخر 6 شهور">
        <MonthlyBars months={stats.months} currency={card.currency} />
      </SectionCard>

      <SectionCard title="عمليات البطاقة" subtitle={`${transactions.length} عملية`}>
        <TransactionList transactions={transactions} showCard={false} />
      </SectionCard>

      <Suspense fallback={null}>
        <CollapsiblePanel label="تعديل البطاقة" openLabel="✏️ تعديل بيانات البطاقة">
          <div className="space-y-4">
            <CardForm card={card} />
            <form action={deleteCardAction} className="surface flex items-center justify-between gap-3 p-4">
              <p className="text-xs text-ink-400">حذف البطاقة هيحذف كل عملياتها نهائياً.</p>
              <input type="hidden" name="id" value={card.id} />
              <button type="submit" className="btn-ghost !text-rose-300">
                حذف البطاقة
              </button>
            </form>
          </div>
        </CollapsiblePanel>
      </Suspense>
    </div>
  );
}
