import Link from "next/link";
import { Badge, EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { StatementActions } from "@/components/statements/statement-actions";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getArchiveStats, listStatements, STATEMENT_SOURCE_LABELS } from "@/lib/services/statements";
import { getReminders, REMINDER_KIND_LABELS, dueLabel } from "@/lib/services/reminders";

export const dynamic = "force-dynamic";

export const metadata = { title: "أرشيف الكشوف — مصاريفي" };

const TONE_CLASS: Record<string, string> = {
  good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  danger: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  info: "border-sky-400/40 bg-sky-500/10 text-sky-200",
};

/**
 * أرشيف كشوف الحساب والفواتير + الاستحقاقات القادمة.
 *
 * كل كشف استوردته (PDF/CSV/نص) بيتسجّل هنا بفترة وإجماليات وعدد صفوف،
 * وتقدر تفتح عملياته أو تسمّيه أو تحذفه (الحذف بيشيل عملياته ويعيد حساب الأرصدة).
 */
export default async function StatementsPage() {
  const [items, stats, reminders] = await Promise.all([
    listStatements(60),
    getArchiveStats(),
    getReminders(30),
  ]);
  const currency = items[0]?.currency ?? "EGP";

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="أرشيف الكشوف"
        subtitle="كشوف الحساب والفواتير المستوردة بعملياتها وإجمالياتها — مع الاستحقاقات القريبة"
        action={<Link href="/settings#statement-import" className="btn-primary">📄 استيراد كشف جديد</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="كشوف في الأرشيف" value={`${stats.count}`} icon="📁" tone={stats.count ? "good" : "default"} />
        <StatCard label="عمليات مستوردة" value={`${stats.rows}`} icon="🧾" />
        <StatCard label="إجمالي الوارد" value={formatMoney(stats.totalIn, currency)} icon="💰" tone="good" />
        <StatCard label="إجمالي الصادر" value={formatMoney(stats.totalOut, currency)} icon="💸" />
      </div>

      <SectionCard
        title="⏰ الاستحقاقات القادمة (30 يوم)"
        subtitle="كشوف الحساب ومواعيد السداد والاشتراكات والأقساط والديون والأهداف"
      >
        {reminders.length ? (
          <ul className="divide-y divide-ink-800/60">
            {reminders.slice(0, 8).map((reminder) => (
              <li key={`${reminder.kind}-${reminder.id}`} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="text-xl">
                  {reminder.kind === "CARD_STATEMENT"
                    ? "📑"
                    : reminder.kind === "CARD_DUE"
                      ? "💳"
                      : reminder.kind === "RECURRING"
                        ? "🔁"
                        : reminder.kind === "DEBT"
                          ? "🤝"
                          : "🎯"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={reminder.href} className="truncate text-sm font-bold text-ink-100 hover:text-brand-300">
                      {reminder.title}
                    </Link>
                    <Badge className={TONE_CLASS[reminder.tone] ?? TONE_CLASS.info}>
                      {dueLabel(reminder.daysLeft)}
                    </Badge>
                    <Badge className="border-ink-600/60 bg-ink-800/60 text-ink-300">
                      {REMINDER_KIND_LABELS[reminder.kind]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-ink-500">
                    {reminder.subtitle ?? formatDate(reminder.date)}
                    {reminder.amount ? ` · ${formatMoney(reminder.amount, reminder.currency)}` : ""}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink-400">{formatDate(reminder.date)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="🎉"
            title="مفيش استحقاقات قريبة"
            description="ضيف يوم كشف الحساب ويوم السداد لكل حساب من صفحة الحسابات عشان تظهر هنا"
          />
        )}
      </SectionCard>

      <SectionCard
        title="📁 الكشوف المستوردة"
        subtitle={
          stats.lastImport
            ? `آخر استيراد ${formatDateTime(stats.lastImport)}${stats.bySource.length ? ` · ${stats.bySource.map((s) => `${STATEMENT_SOURCE_LABELS[s.source] ?? s.source}: ${s.count}`).join(" · ")}` : ""}`
            : "لسه مفيش كشوف مستوردة"
        }
      >
        {items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="surface space-y-3 !p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-ink-100">{item.label}</h3>
                      <Badge className="border-brand-400/40 bg-brand-500/10 text-brand-200">
                        {STATEMENT_SOURCE_LABELS[item.source] ?? item.source}
                      </Badge>
                      {item.cardName ? (
                        <Badge className="border-ink-600/60 bg-ink-800/60 text-ink-300">{item.cardName}</Badge>
                      ) : (
                        <Badge className="border-ink-700/60 bg-ink-900/60 text-ink-500">بدون حساب</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-500">
                      {item.periodFrom && item.periodTo
                        ? `الفترة ${formatDate(item.periodFrom)} → ${formatDate(item.periodTo)}`
                        : "الفترة مش محدّدة في الكشف"}
                      {" · "}
                      استورد {formatDateTime(item.importedAt)}
                      {item.skippedCount ? ` · اتخطّى ${item.skippedCount} صف` : ""}
                    </p>
                    {item.notes ? <p className="text-[11px] text-amber-300/90">📝 {item.notes}</p> : null}
                  </div>
                  <div className="text-end">
                    <p className="text-[11px] text-ink-500">{item.rowsCount} عملية</p>
                    <p className="text-xs font-bold text-emerald-300" data-money>
                      +{formatMoney(item.totalIn, item.currency)}
                    </p>
                    <p className="text-xs font-bold text-rose-300" data-money>
                      −{formatMoney(item.totalOut, item.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/transactions?statementId=${item.id}`}
                    className="btn-ghost !px-3 !py-1.5 !text-xs"
                  >
                    🧾 عرض عمليات الكشف
                  </Link>
                  <StatementActions
                    id={item.id}
                    label={item.label}
                    rowsCount={item.rowsCount}
                    notes={item.notes}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📄"
            title="الأرشيف فاضي"
            description="ارفع كشف حساب PDF أو CSV من الإعدادات — كل كشف بيتسجّل هنا بعملياته وإجمالياته، وتقدر تحذفه وقت ما تحب"
            actionLabel="📄 استيراد أول كشف"
            actionHref="/settings#statement-import"
          />
        )}
      </SectionCard>
    </div>
  );
}
