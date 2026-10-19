import { ExportBar } from "@/components/reports/export-bar";
import { Badge, EmptyState, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { collectExportData, parseRange, summarize } from "@/lib/export/data";
import { comparePeriods, deltaLabel, previousPeriod, type Delta } from "@/lib/services/compare";
import { getBudgetSummary, toneFor } from "@/lib/services/budgets";
import { getStreak } from "@/lib/services/streak";
import { getTopGoal } from "@/lib/services/goals";
import { convert, getRates } from "@/lib/fx";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "التقارير — مصاريفي" };

/**
 * التقارير: ملخص الفترة + توزيع الفئات والأنواع + أعلى التجار + حركة الحسابات
 * + تصدير Excel/CSV/PDF. مقابل `hub/reports` في Mezanetak.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cmpFrom?: string; cmpTo?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.from, params.to);
  const autoPrev = previousPeriod(range);
  const [data, budget, streak, topGoal, rates, comparison] = await Promise.all([
    collectExportData(range),
    getBudgetSummary(range.from),
    getStreak(),
    getTopGoal(),
    getRates(),
    comparePeriods(range, params.cmpFrom, params.cmpTo),
  ]);

  const totals = summarize(data);
  const currency = budget.currency || "EGP";
  const cardById = new Map(data.cards.map((c) => [c.id, c]));

  const byCard = new Map<string, { name: string; out: number; in: number; count: number; currency: string }>();
  for (const tx of data.transactions) {
    if (!tx.cardId) continue;
    const card = cardById.get(tx.cardId);
    const row = byCard.get(tx.cardId) ?? {
      name: card?.name ?? "غير معروف",
      out: 0,
      in: 0,
      count: 0,
      currency: tx.currency ?? card?.currency ?? "EGP",
    };
    if (tx.direction === "OUT") row.out += tx.amount;
    else row.in += tx.amount;
    row.count += 1;
    byCard.set(tx.cardId, row);
  }
  const cardRows = [...byCard.values()].sort((a, b) => b.out - a.out);

  const foreign = data.transactions.filter((tx) => tx.currency && tx.currency !== "EGP");
  const from = range.from.toISOString().slice(0, 10);
  const to = range.to.toISOString().slice(0, 10);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="التقارير"
        subtitle={`${formatDate(range.from)} → ${formatDate(range.to)} · ${data.transactions.length} عملية`}
      />

      <SectionCard title="⬇️ التصدير والطباعة" subtitle="ملف Excel بأكثر من ورقة، أو CSV، أو نسخة احتياطية كاملة، أو PDF من الطباعة">
        <ExportBar
          defaultFrom={from}
          defaultTo={to}
          defaultCmpFrom={(params.cmpFrom ?? autoPrev.from.toISOString().slice(0, 10))}
          defaultCmpTo={(params.cmpTo ?? autoPrev.to.toISOString().slice(0, 10))}
        />
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
        <StatCard label="إجمالي الصرف" value={formatMoney(totals.spent, undefined, { compact: true })} icon="💸" tone="bad" />
        <StatCard label="إجمالي الدخل" value={formatMoney(totals.income, undefined, { compact: true })} icon="💰" tone="good" />
        <StatCard label="الصافي" value={formatMoney(totals.net, undefined, { compact: true })} icon="⚖️" tone={totals.net >= 0 ? "good" : "bad"} />
        <StatCard
          label="الميزانية"
          value={budget.effectiveBudget ? `${budget.pct}%` : "غير محددة"}
          hint={budget.effectiveBudget ? `متبقي ${formatMoney(budget.remaining, undefined, { compact: true })}` : undefined}
          icon="🎚️"
          tone={budget.effectiveBudget ? (toneFor(budget.pct) === "danger" ? "bad" : toneFor(budget.pct) === "warn" ? "warn" : "good") : "default"}
        />
      </div>

      <SectionCard
        title="⚖️ مقارنة الفترات"
        subtitle={`${comparison.current.label} مقابل ${comparison.previous.label}`}
        action={<span className="text-[11px] text-ink-500">غيّر فترة المقارنة من فوق</span>}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <DeltaCard label="الصرف" d={comparison.spent} goodWhenDown currency={currency} />
          <DeltaCard label="الدخل" d={comparison.income} currency={currency} />
          <DeltaCard label="الصافي" d={comparison.net} currency={currency} />
          <DeltaCard label="صرف يومي" d={comparison.dailySpent} goodWhenDown currency={currency} />
          <DeltaCard label="عدد العمليات" d={comparison.count} goodWhenDown unit="عملية" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold text-ink-400">أكبر تغيّر في الفئات</p>
            <ul className="space-y-1.5">
              {comparison.categories.slice(0, 6).map((row) => (
                <DeltaRow key={row.name} name={row.name} current={row.current} previous={row.previous} diff={row.diff} pct={row.pct} currency={currency} />
              ))}
              {!comparison.categories.length ? <li className="text-[11px] text-ink-500">مفيش بيانات فئات في الفترتين</li> : null}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold text-ink-400">أكبر تغيّر في التجار</p>
            <ul className="space-y-1.5">
              {comparison.merchants.slice(0, 6).map((row) => (
                <DeltaRow key={row.name} name={row.name} current={row.current} previous={row.previous} diff={row.diff} pct={row.pct} currency={currency} />
              ))}
              {!comparison.merchants.length ? <li className="text-[11px] text-ink-500">مفيش تجار في الفترتين</li> : null}
            </ul>
          </div>
        </div>

        {comparison.types.length ? (
          <div className="mt-4 border-t border-ink-700/50 pt-3">
            <p className="mb-2 text-[11px] font-bold text-ink-400">حسب نوع العملية</p>
            <div className="flex flex-wrap gap-2">
              {comparison.types.map((row) => (
                <span
                  key={row.name}
                  className="rounded-full border border-ink-700/70 bg-ink-950/50 px-2.5 py-1 text-[11px] text-ink-300"
                >
                  {TX_TYPE_LABELS[row.name as TxType] ?? row.name}:{" "}
                  <b className={row.diff > 0 ? "text-rose-300" : row.diff < 0 ? "text-emerald-300" : "text-ink-300"}>
                    {row.diff > 0 ? "+" : row.diff < 0 ? "−" : ""}
                    {formatMoney(Math.abs(row.diff), currency)}
                  </b>
                  {row.pct !== null ? <span className="ms-1 text-ink-500">({row.pct}%)</span> : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </SectionCard>

      {totals.byCategory.length ? (
        <SectionCard title="🏷️ الصرف حسب الفئة" subtitle="أكبر 10 فئات في الفترة">
          <ul className="space-y-3">
            {totals.byCategory.slice(0, 10).map((row) => (
              <li key={row.name} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink-100">{row.name}</span>
                  <span className="text-ink-400">
                    {formatMoney(row.total)} · {row.pct}% · {row.count} عملية
                  </span>
                </div>
                <ProgressBar value={row.pct} tone={row.pct >= 40 ? "warn" : "brand"} />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="🧾 حسب نوع العملية">
          {totals.byType.length ? (
            <ul className="space-y-2 text-xs">
              {totals.byType.map((row) => (
                <li key={row.type} className="flex items-center justify-between gap-2 rounded-xl bg-ink-950/50 px-3 py-2">
                  <span className="font-semibold text-ink-100">{TX_TYPE_LABELS[row.type as TxType] ?? row.type}</span>
                  <span className="text-ink-400">
                    {formatMoney(row.total)} · {row.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="🧾" title="مفيش عمليات في الفترة دي" description="غيّر الفترة من فوق أو أضف عمليات." />
          )}
        </SectionCard>

        <SectionCard title="🛒 أعلى التجار">
          {totals.topMerchants.length ? (
            <ul className="space-y-2 text-xs">
              {totals.topMerchants.map((row) => (
                <li key={row.merchant} className="flex items-center justify-between gap-2 rounded-xl bg-ink-950/50 px-3 py-2">
                  <span className="truncate font-semibold text-ink-100">{row.merchant}</span>
                  <span className="shrink-0 text-ink-400">
                    {formatMoney(row.total)} · {row.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="🛒" title="مفيش تجار واضحين" description="التاجر بيتقرا من رسالة البنك أو تكتبه في العملية." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="💳 حركة الحسابات">
        {cardRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-ink-500">
                <tr className="border-b border-ink-700/60">
                  <th className="py-2 text-start font-semibold">الحساب</th>
                  <th className="py-2 text-start font-semibold">خارج</th>
                  <th className="py-2 text-start font-semibold">داخل</th>
                  <th className="py-2 text-start font-semibold">عدد العمليات</th>
                  <th className="py-2 text-start font-semibold">الرصيد الحالي</th>
                </tr>
              </thead>
              <tbody>
                {cardRows.map((row) => {
                  const card = data.cards.find((c) => c.name === row.name);
                  return (
                    <tr key={row.name} className="border-b border-ink-800/60">
                      <td className="py-2 font-semibold text-ink-100">{row.name}</td>
                      <td className="py-2 text-rose-300">{formatMoney(row.out, row.currency)}</td>
                      <td className="py-2 text-emerald-300">{formatMoney(row.in, row.currency)}</td>
                      <td className="py-2 text-ink-400">{row.count}</td>
                      <td className="py-2 text-ink-300">{card ? formatMoney(card.currentBalance, card.currency) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="💳" title="مفيش حسابات مربوطة بالعمليات" description="اربط العمليات بحساب عشان التقرير يبقى دقيق." />
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="📨 الرسائل">
          <ul className="space-y-1.5 text-xs text-ink-300">
            <li>عدد الرسائل في الفترة: <b className="text-ink-50">{data.messages.length}</b></li>
            <li>اتسجلت تلقائيًا: <b className="text-emerald-300">{data.messages.filter((m) => m.decision === "AUTO_POST").length}</b></li>
            <li>محتاجة مراجعة: <b className="text-amber-300">{data.messages.filter((m) => m.decision === "REVIEW").length}</b></li>
            <li>متجاهلة: <b className="text-ink-400">{data.messages.filter((m) => m.decision === "DROP").length}</b></li>
          </ul>
        </SectionCard>

        <SectionCard title="🔥 سلسلة الالتزام">
          <p className="text-2xl font-black text-brand-300">{streak.current} يوم</p>
          <p className="mt-1 text-xs text-ink-400">أطول سلسلة: {streak.best} يوم {streak.activeToday ? "· سجلت النهارده ✅" : ""}</p>
        </SectionCard>

        <SectionCard title="🎯 هدفك الأول">
          {topGoal ? (
            <div className="space-y-2">
              <p className="text-sm font-bold text-ink-50">
                {topGoal.emoji} {topGoal.name}
              </p>
              <ProgressBar value={topGoal.pct} tone={topGoal.pct >= 100 ? "brand" : "warn"} />
              <p className="text-[11px] text-ink-400">
                {formatMoney(topGoal.savedAmount, topGoal.currency)} من {formatMoney(topGoal.targetAmount, topGoal.currency)} ({topGoal.pct}%)
              </p>
            </div>
          ) : (
            <EmptyState icon="🎯" title="مفيش أهداف" description="أضف هدف ادخار من صفحة الأهداف." actionLabel="إضافة هدف" actionHref="/goals" />
          )}
        </SectionCard>
      </div>

      {foreign.length ? (
        <SectionCard title="💱 عمليات بعملات أجنبية" subtitle="التحويل بالجنيه حسب الأسعار المحفوظة في الإعدادات">
          <ul className="space-y-2 text-xs">
            {foreign.slice(0, 20).map((tx) => {
              const inEgp = convert(tx.amount, tx.currency ?? "USD", "EGP", rates);
              return (
                <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-950/50 px-3 py-2">
                  <span className="text-ink-300">
                    {formatDate(tx.occurredAt)} · {tx.merchant ?? "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge className="border-ink-700 text-ink-300">
                      {formatMoney(tx.amount, tx.currency ?? "USD")}
                    </Badge>
                    <span className="text-brand-300">{inEgp !== null ? formatMoney(inEgp, "EGP") : "سعر غير محفوظ"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}


function DeltaCard({
  label,
  d,
  goodWhenDown,
  currency = "EGP",
  unit,
}: {
  label: string;
  d: Delta;
  goodWhenDown?: boolean;
  currency?: string;
  unit?: string;
}) {
  const good = goodWhenDown ? d.diff <= 0 : d.diff >= 0;
  const flat = d.diff === 0;
  return (
    <div className="rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums" data-money>
        {unit ? `${d.current} ${unit}` : formatMoney(d.current, currency)}
      </p>
      <p className={`mt-0.5 text-[11px] font-semibold ${flat ? "text-ink-400" : good ? "text-emerald-300" : "text-rose-300"}`}>
        {flat ? "—" : `${d.diff > 0 ? "▲" : "▼"} ${deltaLabel(d, currency)}`}
      </p>
      <p className="text-[10px] text-ink-600" data-money>
        قبلها: {unit ? `${d.previous} ${unit}` : formatMoney(d.previous, currency)}
      </p>
    </div>
  );
}

function DeltaRow({
  name,
  current,
  previous,
  diff,
  pct,
  currency,
}: {
  name: string;
  current: number;
  previous: number;
  diff: number;
  pct: number | null;
  currency: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-xl bg-ink-950/50 px-3 py-1.5 text-[11px]">
      <span className="min-w-0 truncate font-semibold text-ink-200">{name}</span>
      <span className="shrink-0 text-ink-500">
        <span className={diff > 0 ? "text-rose-300" : diff < 0 ? "text-emerald-300" : ""}>
          {diff > 0 ? "+" : diff < 0 ? "−" : ""}
          {formatMoney(Math.abs(diff), currency)}
          {pct !== null ? ` (${pct}%)` : ""}
        </span>
        <span className="ms-1.5" data-money>
          {formatMoney(previous, currency)} ← {formatMoney(current, currency)}
        </span>
      </span>
    </li>
  );
}
