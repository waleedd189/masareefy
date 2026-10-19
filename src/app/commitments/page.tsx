import { asc } from "drizzle-orm";
import { DebtForm, RecurringForm } from "@/components/forms/commitment-form";
import { Badge, EmptyState, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";
import { db } from "@/db/client";
import { debts, recurringRules } from "@/db/schema";
import { formatDate, formatMoney, round2 } from "@/lib/format";
import { dueLabel, getReminders, intervalLabel, REMINDER_KIND_LABELS, type ReminderKind } from "@/lib/services/reminders";

/** عدد الأيام المتبقية لاستحقاق الدين (محسوبة خارج العرض) */
function debtDueLabel(dueDate: Date): string {
  return dueLabel(Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000));
}

const KIND_ICONS: Record<ReminderKind, string> = {
  CARD_STATEMENT: "🧾",
  CARD_DUE: "💳",
  RECURRING: "🔁",
  DEBT: "🤝",
  GOAL: "🎯",
};
import { listCards, listCategories } from "@/lib/services/queries";
import {
  deleteDebtAction,
  deleteRecurringAction,
  payDebtAction,
  recordRecurringAction,
  toggleRecurringAction,
  toggleSettleDebtAction,
} from "@/server/actions/commitments";

export const dynamic = "force-dynamic";

export const metadata = { title: "الالتزامات — مصاريفي" };

/**
 * الالتزامات: مصروفات متكررة + اشتراكات + ديون.
 * مقابل `hub/{recurring-expenses, subscriptions, debts, installments}` في Mezanetak.
 */
export default async function CommitmentsPage() {
  const [rules, debtRows, cards, categories, reminders] = await Promise.all([
    db.select().from(recurringRules).orderBy(asc(recurringRules.nextRunAt)),
    db.select().from(debts).orderBy(asc(debts.dueDate)),
    listCards(),
    listCategories(),
    getReminders(30),
  ]);

  const activeRules = rules.filter((r) => r.isActive);
  const monthlyOut = round2(
    activeRules
      .filter((r) => r.direction === "OUT" && (r.interval === "MONTHLY" || !r.interval))
      .reduce((sum, r) => sum + r.amount, 0),
  );
  const yearlyOut = round2(
    activeRules
      .filter((r) => r.direction === "OUT")
      .reduce((sum, r) => {
        const factor = r.interval === "DAILY" ? 365 : r.interval === "WEEKLY" ? 52 : r.interval === "YEARLY" ? 1 : 12;
        return sum + r.amount * factor;
      }, 0),
  );
  const owedByMe = round2(debtRows.filter((d) => d.direction === "OWED_BY_ME" && !d.isSettled).reduce((s, d) => s + (d.amount - d.paidAmount), 0));
  const owedToMe = round2(debtRows.filter((d) => d.direction === "OWED_TO_ME" && !d.isSettled).reduce((s, d) => s + (d.amount - d.paidAmount), 0));
  const cardOptions = cards.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="الالتزامات" subtitle="كل اللي بيتكرر كل شهر + الديون اللي عليك أو ليك" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="بنود نشطة" value={String(activeRules.length)} icon="🔁" />
        <StatCard label="مصروف شهري ثابت" value={formatMoney(monthlyOut, undefined, { compact: true })} icon="📅" tone="warn" />
        <StatCard label="إجمالي سنوي" value={formatMoney(yearlyOut, undefined, { compact: true })} icon="🗓️" />
        <StatCard label="ديون عليّ / ليا" value={`${formatMoney(owedByMe, undefined, { compact: true })} / ${formatMoney(owedToMe, undefined, { compact: true })}`} icon="🤝" tone={owedByMe > 0 ? "bad" : "good"} />
      </div>

      {reminders.length ? (
        <SectionCard title="⏰ استحقاقات قريبة" subtitle="أول 6 مواعيد في الـ30 يوم الجاية">
          <ul className="space-y-2">
            {reminders.slice(0, 6).map((reminder) => (
              <li key={`${reminder.kind}-${reminder.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-700/60 bg-ink-950/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink-100">
                    {KIND_ICONS[reminder.kind]} {reminder.title}{" "}
                    <span className="ms-1 text-[10px] text-ink-500">{REMINDER_KIND_LABELS[reminder.kind]}</span>
                  </p>
                  {reminder.subtitle ? <p className="truncate text-[11px] text-ink-500">{reminder.subtitle}</p> : null}
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {reminder.amount ? <span className="text-brand-300">{formatMoney(reminder.amount, reminder.currency)}</span> : null}
                  <Badge
                    className={
                      reminder.tone === "danger"
                        ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                        : reminder.tone === "warn"
                          ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                          : "border-ink-700 text-ink-300"
                    }
                  >
                    {formatDate(reminder.date)} · {dueLabel(reminder.daysLeft)}
                  </Badge>
                  <a href={reminder.href} className="text-[11px] font-semibold text-brand-300">
                    فتح
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="🔁 بند متكرر جديد" subtitle="اشتراك، إيجار، قسط، فاتورة أو راتب — هيفكّرك قبل ميعاده">
        <RecurringForm cards={cardOptions} categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))} />
      </SectionCard>

      <SectionCard title="📋 البنود المتكررة">
        {rules.length ? (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className={`rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3 ${rule.isActive ? "" : "opacity-55"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-50">
                      {rule.title}{" "}
                      <span className="text-xs font-medium text-ink-400">
                        {formatMoney(rule.amount)} · {intervalLabel(rule.interval)}
                        {rule.dayOfMonth ? ` (يوم ${rule.dayOfMonth})` : ""}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {rule.nextRunAt ? `الجاي: ${formatDate(rule.nextRunAt)}` : "بدون موعد"}
                      {rule.kind ? ` · ${rule.kind}` : ""}
                      {rule.notes ? ` · ${rule.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={recordRecurringAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="btn-primary !px-3 !py-1 !text-[11px]" disabled={!rule.isActive}>
                        سجّل دفعة
                      </button>
                    </form>
                    <form action={toggleRecurringAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="btn-ghost !px-3 !py-1 !text-[11px]">
                        {rule.isActive ? "إيقاف" : "تنشيط"}
                      </button>
                    </form>
                    <form action={deleteRecurringAction}>
                      <input type="hidden" name="id" value={rule.id} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-300">
                        حذف
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="🔁" title="مفيش بنود متكررة" description="أضف الاشتراكات والإيجار والأقساط عشان نذكّرك بيها ونحسبها في الميزانية." />
        )}
      </SectionCard>

      <SectionCard title="🤝 دين جديد" subtitle="سجّل اللي عليك أو اللي ليك ومتابع السداد">
        <DebtForm cards={cardOptions} />
      </SectionCard>

      <SectionCard title="🧮 الديون">
        {debtRows.length ? (
          <ul className="space-y-3">
            {debtRows.map((debt) => {
              const remaining = round2(Math.max(0, debt.amount - debt.paidAmount));
              const pct = debt.amount > 0 ? Math.min(100, Math.round((debt.paidAmount / debt.amount) * 100)) : 0;
              const mine = debt.direction === "OWED_BY_ME";
              return (
                <li key={debt.id} className={`rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3 ${debt.isSettled ? "opacity-60" : ""}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-ink-50">
                      {mine ? "⬅️" : "➡️"} {debt.person}{" "}
                      <span className="text-xs font-medium text-ink-400">
                        {formatMoney(debt.amount, debt.currency)} · {mine ? "عليّ" : "ليا"}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      {debt.dueDate ? (
                        <Badge className="border-ink-700 text-ink-300">
                          {formatDate(debt.dueDate)} · {debtDueLabel(debt.dueDate)}
                        </Badge>
                      ) : null}
                      {debt.isSettled ? (
                        <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200">مسدد ✅</Badge>
                      ) : null}
                    </div>
                  </div>

                  <ProgressBar value={pct} tone={pct >= 100 ? "brand" : "warn"} />
                  <p className="mt-1 text-[11px] text-ink-400">
                    مسدد {formatMoney(debt.paidAmount, debt.currency)} ({pct}%) · المتبقي {formatMoney(remaining, debt.currency)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    {!debt.isSettled ? (
                      <form action={payDebtAction} className="flex items-end gap-2">
                        <input type="hidden" name="id" value={debt.id} />
                        <label className="space-y-1">
                          <span className="field-label">{mine ? "سداد" : "استلام"}</span>
                          <input name="amount" type="number" min={1} step="0.01" placeholder="500" className="field !w-28 !py-1.5 !text-xs" />
                        </label>
                        <button type="submit" className="btn-primary !px-3 !py-1.5 !text-xs">
                          سجّل
                        </button>
                      </form>
                    ) : null}
                    <form action={toggleSettleDebtAction}>
                      <input type="hidden" name="id" value={debt.id} />
                      <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                        {debt.isSettled ? "رجّع كقائم" : "علّم كمسدد"}
                      </button>
                    </form>
                    <form action={deleteDebtAction} className="ms-auto">
                      <input type="hidden" name="id" value={debt.id} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-300">
                        حذف
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="🤝" title="مفيش ديون مسجلة" description="سجّل أي مبلغ عليك أو ليك وهنحسب المتبقي ونفكّرك بميعاد السداد." />
        )}
      </SectionCard>

      {rules.length === 0 && debtRows.length === 0 ? (
        <p className="text-center text-xs text-ink-500">ابدأ بإضافة بند متكرر أو دين من النماذج فوق.</p>
      ) : null}
    </div>
  );
}
