import Link from "next/link";
import { Suspense } from "react";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { PageHeader, SectionCard, StatCard } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { listCards, listCategories, listTransactions } from "@/lib/services/queries";
import { isIncome, isSpend } from "@/lib/services/stats";
import { TX_TYPES, TX_TYPE_LABELS } from "@/lib/sms/types";

export const dynamic = "force-dynamic";

interface SearchParams {
  cardId?: string;
  categoryId?: string;
  type?: string;
  q?: string;
  from?: string;
  to?: string;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const [cards, categories] = await Promise.all([listCards(), listCategories()]);

  const transactions = await listTransactions({
    cardId: filters.cardId || undefined,
    categoryId: filters.categoryId || undefined,
    type: filters.type || undefined,
    search: filters.q || undefined,
    from: filters.from ? new Date(filters.from) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined,
    limit: 200,
  });

  const totalOut = transactions.filter(isSpend).reduce((sum, tx) => sum + tx.amount, 0);
  const totalIn = transactions.filter(isIncome).reduce((sum, tx) => sum + tx.amount, 0);
  const currency = transactions[0]?.currency ?? cards[0]?.currency ?? "EGP";

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="العمليات" subtitle="كل الحركات على بطاقاتك — من الرسائل أو يدوي" />

      <Suspense fallback={null}>
        <CollapsiblePanel label="عملية جديدة" openLabel="＋ تسجيل عملية يدوية" defaultOpenParam="new">
          <TransactionForm cards={cards} categories={categories} defaultCardId={filters.cardId} />
        </CollapsiblePanel>
      </Suspense>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي المصروف" value={formatMoney(totalOut, currency)} icon="💸" />
        <StatCard label="إجمالي الوارد" value={formatMoney(totalIn, currency)} icon="💰" tone="good" />
        <StatCard label="عدد العمليات" value={String(transactions.length)} icon="🧾" />
        <StatCard
          label="متوسط العملية"
          value={formatMoney(transactions.length ? totalOut / Math.max(1, transactions.filter(isSpend).length) : 0, currency)}
          icon="📏"
        />
      </div>

      <SectionCard title="فلترة">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="field-label" htmlFor="q">
              بحث
            </label>
            <input id="q" name="q" defaultValue={filters.q} placeholder="اسم تاجر أو ملاحظة" className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="cardId">
              البطاقة
            </label>
            <select id="cardId" name="cardId" defaultValue={filters.cardId ?? ""} className="field">
              <option value="">الكل</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="categoryId">
              الفئة
            </label>
            <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="field">
              <option value="">الكل</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="type">
              النوع
            </label>
            <select id="type" name="type" defaultValue={filters.type ?? ""} className="field">
              <option value="">الكل</option>
              {TX_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TX_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary flex-1">
              تطبيق
            </button>
            <Link href="/transactions" className="btn-ghost">
              مسح
            </Link>
          </div>
          <div>
            <label className="field-label" htmlFor="from">
              من تاريخ
            </label>
            <input id="from" name="from" type="date" defaultValue={filters.from} className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="to">
              إلى تاريخ
            </label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className="field" />
          </div>
        </form>
      </SectionCard>

      <SectionCard title={`النتائج (${transactions.length})`}>
        <TransactionList transactions={transactions} />
      </SectionCard>
    </div>
  );
}
