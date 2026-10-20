import { Badge, PageHeader, ProgressBar, SectionCard, StatCard } from "@/components/ui";
import { getBadges } from "@/lib/services/badges";
import { getStreak } from "@/lib/services/streak";

export const dynamic = "force-dynamic";

export const metadata = { title: "الشارات — مصاريفي" };

/** شارات الإنجاز — تحفيز خفيف من غير ألعاب تقيلة (مقابل streak/badges في Mezanetak). */
export default async function BadgesPage() {
  const [badges, streak] = await Promise.all([getBadges(), getStreak()]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="الشارات" subtitle="إنجازاتك بتتحسب من بياناتك الفعلية — مفيش نقط وهمية" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="شارات مفتوحة" value={`${badges.earnedCount} / ${badges.totalCount}`} icon="🏅" tone="good" />
        <StatCard label="نسبة الإنجاز" value={`${badges.pct}%`} icon="📈" />
        <StatCard label="السلسلة الحالية" value={`${streak.current} يوم`} icon="🔥" tone={streak.current >= 3 ? "good" : "default"} />
        <StatCard label="أطول سلسلة" value={`${streak.best} يوم`} icon="🌋" />
      </div>

      {badges.nextUp ? (
        <SectionCard title="🎯 أقرب شارة" subtitle={badges.nextUp.description}>
          <div className="flex items-center gap-4">
            <span className="text-3xl">{badges.nextUp.emoji}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-ink-100">{badges.nextUp.title}</span>
                <span className="text-ink-400">
                  {badges.nextUp.progress} / {badges.nextUp.target} {badges.nextUp.unit ?? ""}
                </span>
              </div>
              <ProgressBar
                value={(badges.nextUp.progress / badges.nextUp.target) * 100}
                tone={badges.nextUp.progress / badges.nextUp.target >= 0.6 ? "brand" : "warn"}
              />
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="🏅 مفتوحة" subtitle={`${badges.earned.length} شارة`}>
        {badges.earned.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.earned.map((b) => (
              <li
                key={b.id}
                className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-ink-900/50 p-3"
              >
                <span className="text-2xl">{b.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-100">{b.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-300">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-xs text-ink-400">
            لسه مفيش شارات — سجّل أول عملية وهتفتح أول شارة على طول.
          </p>
        )}
      </SectionCard>

      <SectionCard title="🔒 لسه مقفولة" subtitle="كل واحدة معاها شريط تقدم عشان تعرف فاضل لك قد إيه">
        {badges.locked.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {badges.locked.map((b) => (
              <li key={b.id} className="rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3 opacity-90">
                <div className="flex items-start gap-3">
                  <span className="text-2xl grayscale">{b.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink-100">{b.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{b.description}</p>
                  </div>
                  <Badge className="border-ink-700 text-ink-400">
                    {Math.min(b.progress, b.target)}/{b.target}
                  </Badge>
                </div>
                <div className="mt-2">
                  <ProgressBar value={(b.progress / b.target) * 100} tone="warn" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-xs text-emerald-300">كل الشارات مفتوحة — برافو 👏</p>
        )}
      </SectionCard>
    </div>
  );
}
