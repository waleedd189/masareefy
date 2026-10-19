import Link from "next/link";
import { Badge, ProgressBar, SectionCard } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { toneFor, type BudgetSummary } from "@/lib/services/budgets";
import { dueLabel, type Reminder, type ReminderKind } from "@/lib/services/reminders";
import type { Signal } from "@/lib/services/signals";
import type { GoalProgress } from "@/lib/services/goals";
import type { StreakInfo } from "@/lib/services/streak";

const KIND_ICONS: Record<ReminderKind, string> = {
  CARD_STATEMENT: "🧾",
  CARD_DUE: "💳",
  RECURRING: "🔁",
  DEBT: "🤝",
  GOAL: "🎯",
};

const SIGNAL_STYLES: Record<Signal["tone"], string> = {
  good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  bad: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  info: "border-brand-500/30 bg-brand-500/10 text-brand-200",
};

/**
 * لوحات "الإشارات الذكية" في الرئيسية — مقابل 10 Home signals في Mezanetak
 * (وتيرة الصرف، مصروف غير معتاد، تكرار تاجر، فواتير، المتاح يوميًا…).
 */
export function SignalsStrip({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {signals.map((signal) => (
        <Link
          key={signal.id}
          href={signal.href ?? "#"}
          className={`min-w-[220px] max-w-[300px] shrink-0 rounded-2xl border px-3 py-2.5 transition hover:brightness-110 ${SIGNAL_STYLES[signal.tone]}`}
        >
          <p className="text-xs font-bold">
            {signal.icon} {signal.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{signal.detail}</p>
        </Link>
      ))}
    </div>
  );
}

/** مؤشر الميزانية الشهرية (burn-down) — مقابل `SmsBudgetPolicy` + ودجت الميزانية */
export function BudgetPanel({ budget }: { budget: BudgetSummary }) {
  const tone = toneFor(budget.pct);
  return (
    <SectionCard
      title="🎚️ ميزانية الشهر"
      subtitle={budget.effectiveBudget ? `محددة: ${formatMoney(budget.effectiveBudget, budget.currency)}` : "لسه محددتش ميزانية"}
      action={
        <Link href="/settings" className="text-xs font-semibold text-brand-300 hover:underline">
          ضبط ←
        </Link>
      }
    >
      {budget.effectiveBudget ? (
        <div className="space-y-3">
          <ProgressBar value={budget.pct} tone={tone === "danger" ? "danger" : tone === "warn" ? "warn" : "brand"} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-ink-400">
              صرفت <b className="text-ink-50" data-money>{formatMoney(budget.spent, budget.currency)}</b> ({budget.pct}%)
            </span>
            <span className={tone === "danger" ? "font-bold text-rose-300" : tone === "warn" ? "font-bold text-amber-300" : "font-bold text-emerald-300"}>
              {budget.remaining >= 0 ? `متبقي ${formatMoney(budget.remaining, budget.currency)}` : `تجاوزت بـ ${formatMoney(-budget.remaining, budget.currency)}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <Info label="يومك المسموح" value={budget.dailyAllowance !== null ? formatMoney(budget.dailyAllowance, budget.currency) : "—"} />
            <Info label="وتيرتك اليومية" value={budget.dailyPace !== null ? formatMoney(budget.dailyPace, budget.currency) : "—"} />
            <Info label="متوقع آخر الشهر" value={formatMoney(budget.projectedTotal, budget.currency)} />
            <Info label="باقي في الشهر" value={`${budget.daysLeft} يوم`} />
          </div>

          {budget.budgets.length ? (
            <div className="space-y-2 border-t border-ink-700/50 pt-3">
              <p className="text-[11px] font-semibold text-ink-400">ميزانيات الفئات</p>
              {budget.budgets.slice(0, 4).map((row) => (
                <div key={row.category.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-ink-200">
                      {row.category.emoji} {row.category.name}
                    </span>
                    <span className="shrink-0 text-ink-400">
                      {formatMoney(row.spent, budget.currency)} / {formatMoney(row.budget, budget.currency)} ({row.pct}%)
                    </span>
                  </div>
                  <ProgressBar value={row.pct} tone={row.tone === "danger" ? "danger" : row.tone === "warn" ? "warn" : "brand"} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-ink-400">
          حدد ميزانية شهرية (إجمالية أو لكل فئة) عشان تعرف المتبقي ووتيرتك اليومية.
        </p>
      )}
    </SectionCard>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-950/50 px-2 py-1.5">
      <p className="text-[10px] text-ink-500">{label}</p>
      <p className="text-xs font-bold text-ink-100" data-money>
        {value}
      </p>
    </div>
  );
}

/** التنبيهات القريبة (كشف/سداد/متكرر/دين/هدف) */
export function RemindersPanel({ reminders }: { reminders: Reminder[] }) {
  return (
    <SectionCard
      title="⏰ استحقاقات قريبة"
      subtitle="كشف الحساب، السداد، الاشتراكات والديون"
      action={
        <Link href="/commitments" className="text-xs font-semibold text-brand-300 hover:underline">
          الالتزامات ←
        </Link>
      }
    >
      {reminders.length ? (
        <ul className="space-y-2">
          {reminders.slice(0, 6).map((reminder) => (
            <li key={`${reminder.kind}-${reminder.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-ink-950/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink-100">
                  {KIND_ICONS[reminder.kind]} {reminder.title}
                </p>
                {reminder.subtitle ? <p className="truncate text-[10px] text-ink-500">{reminder.subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                {reminder.amount ? <span className="text-brand-300" data-money>{formatMoney(reminder.amount, reminder.currency)}</span> : null}
                <Badge
                  className={
                    reminder.tone === "danger"
                      ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
                      : reminder.tone === "warn"
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                        : "border-ink-700 text-ink-300"
                  }
                >
                  {dueLabel(reminder.daysLeft)} · {formatDate(reminder.date)}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-xs text-ink-400">
          مفيش استحقاقات قريبة — أضف يوم الكشف/السداد للحسابات أو بنود متكررة.
        </p>
      )}
    </SectionCard>
  );
}

/** الأهداف + السلسلة في لوحة واحدة */
export function GoalsPanel({ goals, streak }: { goals: GoalProgress[]; streak: StreakInfo }) {
  return (
    <SectionCard
      title="🎯 الأهداف والسلسلة"
      action={
        <Link href="/goals" className="text-xs font-semibold text-brand-300 hover:underline">
          الأهداف ←
        </Link>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-ink-700/60 bg-ink-950/50 px-3 py-2">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-sm font-black text-brand-300">{streak.current} يوم</p>
          <p className="text-[10px] text-ink-500">
            سلسلة التسجيل {streak.activeToday ? "· سجلت النهارده ✅" : "· لسه مسجلتش النهارده"} · الأطول {streak.best}
          </p>
        </div>
      </div>

      {goals.length ? (
        <ul className="space-y-3">
          {goals.slice(0, 3).map((goal) => (
            <li key={goal.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-ink-100">
                  {goal.emoji} {goal.name}
                </span>
                <span className="shrink-0 text-ink-400" data-money>
                  {formatMoney(goal.savedAmount, goal.currency)} / {formatMoney(goal.targetAmount, goal.currency)} ({goal.pct}%)
                </span>
              </div>
              <ProgressBar value={goal.pct} tone={goal.pct >= 100 ? "brand" : "warn"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-ink-400">
          <Link href="/goals" className="font-semibold text-brand-300 hover:underline">
            أضف أول هدف ادخار ←
          </Link>
        </p>
      )}
    </SectionCard>
  );
}
