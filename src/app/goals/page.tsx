import { GoalForm } from "@/components/forms/goal-form";
import { PageHeader, ProgressBar, SectionCard, StatCard, EmptyState, Badge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { getGoalsWithProgress } from "@/lib/services/goals";
import { listCards } from "@/lib/services/queries";
import {
  contributeToGoalAction,
  deleteGoalAction,
  saveGoalTransactionAction,
  toggleArchiveGoalAction,
} from "@/server/actions/goals";

export const dynamic = "force-dynamic";

export const metadata = { title: "الأهداف — مصاريفي" };

/** أهداف الادخار — مقابل `hub/goals` + ودجت الهدف في Mezanetak. */
export default async function GoalsPage() {
  const [goals, cards] = await Promise.all([getGoalsWithProgress(), listCards()]);

  const active = goals.filter((g) => !g.isArchived);
  const totalTarget = active.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = active.reduce((sum, g) => sum + g.savedAmount, 0);
  const done = active.filter((g) => g.pct >= 100).length;

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="أهداف الادخار" subtitle="حدد هدف ومبلغه وموعده، وتابع تقدمك خطوة بخطوة" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="أهداف نشطة" value={String(active.length)} icon="🎯" />
        <StatCard label="إجمالي المطلوب" value={formatMoney(totalTarget, undefined, { compact: true })} icon="🧮" />
        <StatCard label="المدخر" value={formatMoney(totalSaved, undefined, { compact: true })} icon="💰" tone="good" />
        <StatCard label="اتحققت" value={String(done)} icon="🏆" tone={done ? "good" : undefined} />
      </div>

      <SectionCard title="🎯 هدف جديد" subtitle="حدد المبلغ والتاريخ وإحنا نحسب لك المطلوب شهريًا">
        <GoalForm />
      </SectionCard>

      {goals.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <SectionCard
              key={goal.id}
              title={`${goal.emoji} ${goal.name}`}
              subtitle={goal.dueDate ? `المستهدف: ${formatDate(goal.dueDate)}` : "بدون تاريخ مستهدف"}
              action={
                goal.pct >= 100 ? <Badge className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200">اتحقق 🏆</Badge> : null
              }
            >
              <div className="space-y-3">
                <ProgressBar value={goal.pct} tone={goal.pct >= 100 ? "brand" : goal.pct >= 50 ? "warn" : "danger"} />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-ink-400">
                    مدخر <b className="text-ink-50">{formatMoney(goal.savedAmount, goal.currency)}</b> من{" "}
                    {formatMoney(goal.targetAmount, goal.currency)}
                  </span>
                  <span className="font-bold text-brand-300">{goal.pct}%</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
                  <span>المتبقي: {formatMoney(goal.remaining, goal.currency)}</span>
                  {goal.daysLeft !== null ? <span>باقي {Math.max(0, goal.daysLeft)} يوم</span> : null}
                  {goal.monthlyNeeded ? <span>مطلوب شهريًا: {formatMoney(goal.monthlyNeeded, goal.currency)}</span> : null}
                </div>

                <div className="flex gap-1">
                  {goal.milestones.map((m) => (
                    <span
                      key={m.pct}
                      className={`h-1.5 flex-1 rounded-full ${m.reached ? "bg-emerald-400" : "bg-ink-700"}`}
                      title={`${m.pct}%`}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-2 border-t border-ink-700/50 pt-3">
                  <form action={contributeToGoalAction} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={goal.id} />
                    <label className="space-y-1">
                      <span className="field-label">أضف مبلغ</span>
                      <input name="amount" type="number" min={1} step="0.01" placeholder="500" className="field !w-28 !py-1.5 !text-xs" />
                    </label>
                    <button type="submit" className="btn-primary !px-3 !py-1.5 !text-xs">
                      💰 ادخر
                    </button>
                  </form>

                  {cards.length ? (
                    <form action={saveGoalTransactionAction} className="flex items-end gap-2">
                      <input type="hidden" name="goalId" value={goal.id} />
                      <label className="space-y-1">
                        <span className="field-label">من حساب</span>
                        <select name="cardId" className="field !w-auto !py-1.5 !text-xs" defaultValue={cards[0].id}>
                          {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {card.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="field-label">المبلغ</span>
                        <input name="amount" type="number" min={1} step="0.01" placeholder="500" className="field !w-24 !py-1.5 !text-xs" />
                      </label>
                      <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                        سجّل كعملية
                      </button>
                    </form>
                  ) : null}

                  <div className="ms-auto flex items-center gap-2">
                    <form action={toggleArchiveGoalAction}>
                      <input type="hidden" name="id" value={goal.id} />
                      <button type="submit" className="text-[11px] font-semibold text-ink-400 hover:text-ink-100">
                        {goal.isArchived ? "إظهار" : "أرشفة"}
                      </button>
                    </form>
                    <form action={deleteGoalAction}>
                      <input type="hidden" name="id" value={goal.id} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-300">
                        حذف
                      </button>
                    </form>
                  </div>
                </div>

                {goal.notes ? <p className="text-[11px] text-ink-500">{goal.notes}</p> : null}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🎯"
          title="لسه مفيش أهداف"
          description="حدد هدف ادخار (شقة، عربية، سفر) وابدأ تتبع تقدمك — ممكن تربط العمليات بالهدف."
          actionLabel="ابدأ بهدف جديد"
          actionHref="#goal"
        />
      )}
    </div>
  );
}
