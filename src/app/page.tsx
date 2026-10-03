import Link from "next/link";
import { CardTile } from "@/components/card-tile";
import { CategoryDonut, MonthlyBars } from "@/components/charts";
import { TransactionList } from "@/components/transaction-list";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { formatMoney, monthLabel } from "@/lib/format";
import { listCards, listTransactions } from "@/lib/services/queries";
import { getDashboardData, isSpend, monthRange } from "@/lib/services/stats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { start } = monthRange();
  const [data, cards, recent, monthTx] = await Promise.all([
    getDashboardData(),
    listCards(),
    listTransactions({ limit: 8 }),
    listTransactions({ from: start, limit: 500 }),
  ]);

  const spentByCard = new Map<string, number>();
  for (const tx of monthTx) {
    if (!tx.cardId || !isSpend(tx)) continue;
    spentByCard.set(tx.cardId, (spentByCard.get(tx.cardId) ?? 0) + tx.amount);
  }

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="نظرة عامة"
        subtitle={`ملخص ${monthLabel(new Date())}`}
        action={
          <div className="flex gap-2">
            <Link href="/messages" className="btn-primary">
              📨 الصق رسالة بنك
            </Link>
            <Link href="/transactions?new=1" className="btn-ghost">
              ＋ عملية
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="مصروفات الشهر"
          value={formatMoney(data.spentThisMonth, data.currency)}
          trend={data.changePct}
          hint={`${data.txCountThisMonth} عملية`}
          icon="💸"
        />
        <StatCard
          label="المستحق على الفيز"
          value={formatMoney(data.totalOutstanding, data.currency)}
          hint="إجمالي بطاقات الائتمان"
          icon="💳"
          tone={data.totalOutstanding > 0 ? "warn" : "good"}
        />
        <StatCard
          label="الرصيد المتاح"
          value={formatMoney(data.totalAvailable, data.currency)}
          hint="حسب آخر رسالة بنك"
          icon="🏦"
          tone="good"
        />
        <StatCard
          label="رسائل محتاجة مراجعة"
          value={String(data.needsReview)}
          hint={data.needsReview ? "افتح صفحة الرسائل" : "كل حاجة متحللة"}
          icon="📨"
          tone={data.needsReview ? "bad" : "default"}
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">بطاقاتي</h2>
          <Link href="/cards" className="text-xs font-semibold text-brand-300 hover:underline">
            إدارة البطاقات ←
          </Link>
        </div>
        {cards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <CardTile key={card.id} card={card} spentThisMonth={spentByCard.get(card.id) ?? 0} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="💳"
            title="لسه مضفتش أي بطاقة"
            description="ضيف بطاقاتك بآخر 4 أرقام عشان الموقع يعرف يربط كل رسالة بنك بالبطاقة الصح."
            actionLabel="إضافة بطاقة"
            actionHref="/cards?new=1"
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard title="المصروفات آخر 6 شهور" subtitle="الأخضر = مصروف · البنفسجي = وارد" className="lg:col-span-3">
          <MonthlyBars months={data.months} currency={data.currency} />
        </SectionCard>
        <SectionCard title="التوزيع حسب الفئة" subtitle="الشهر الحالي" className="lg:col-span-2">
          <CategoryDonut slices={data.categories} currency={data.currency} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard
          title="آخر العمليات"
          className="lg:col-span-3"
          action={
            <Link href="/transactions" className="text-xs font-semibold text-brand-300 hover:underline">
              الكل ←
            </Link>
          }
        >
          <TransactionList transactions={recent} />
        </SectionCard>

        <SectionCard title="أكتر أماكن صرفت فيها" subtitle="الشهر الحالي" className="lg:col-span-2">
          {data.topMerchants.length ? (
            <ul className="space-y-3">
              {data.topMerchants.map((merchant, index) => (
                <li key={merchant.name} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-ink-800 text-[11px] font-bold text-ink-300">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{merchant.name}</span>
                  <span className="text-xs tabular-nums text-ink-300">
                    {formatMoney(merchant.total, data.currency)}
                    <span className="mr-1 text-ink-500">({merchant.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-xs text-ink-400">مفيش بيانات كفاية لسه</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
