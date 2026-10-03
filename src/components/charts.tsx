import { formatMoney } from "@/lib/format";
import type { CategorySlice, MonthPoint } from "@/lib/services/stats";

const PALETTE = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#0ea5e9", "#a855f7", "#14b8a6", "#eab308"];

export function MonthlyBars({ months, currency }: { months: MonthPoint[]; currency: string }) {
  const max = Math.max(...months.map((m) => Math.max(m.spent, m.received)), 1);
  return (
    <div className="flex h-56 items-end justify-between gap-2 sm:gap-4">
      {months.map((month) => {
        const spentHeight = Math.round((month.spent / max) * 100);
        const receivedHeight = Math.round((month.received / max) * 100);
        return (
          <div key={month.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-[22px] rounded-t-lg bg-gradient-to-t from-brand-600/50 to-brand-400 transition group-hover:brightness-125"
                style={{ height: `${Math.max(spentHeight, 2)}%` }}
                title={`مصروف: ${formatMoney(month.spent, currency)}`}
              />
              <div
                className="w-1/3 max-w-[16px] rounded-t-lg bg-gradient-to-t from-indigo-700/40 to-indigo-400/80 transition group-hover:brightness-125"
                style={{ height: `${Math.max(receivedHeight, 2)}%` }}
                title={`وارد: ${formatMoney(month.received, currency)}`}
              />
            </div>
            <span className="text-[11px] font-semibold text-ink-400">{month.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CategoryDonut({ slices, currency }: { slices: CategorySlice[]; currency: string }) {
  const top = slices.slice(0, 6);
  const total = top.reduce((sum, slice) => sum + slice.total, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  if (!total) {
    return <p className="py-10 text-center text-xs text-ink-400">مفيش مصروفات الشهر ده لسه</p>;
  }

  const arcs = top.reduce<{ slice: CategorySlice; dash: number; offset: number }[]>((acc, slice) => {
    const previous = acc.at(-1);
    const offset = previous ? previous.offset + previous.dash : 0;
    acc.push({ slice, dash: (slice.total / total) * circumference, offset });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-40 w-40 -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#131c29" strokeWidth="18" />
        {arcs.map(({ slice, dash, offset }, index) => (
          <circle
            key={slice.id ?? `none-${index}`}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={PALETTE[index % PALETTE.length]}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <ul className="w-full flex-1 space-y-2">
        {top.map((slice, index) => (
          <li key={slice.id ?? `none-${index}`} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />
              <span className="font-semibold">
                {slice.emoji} {slice.name}
              </span>
            </span>
            <span className="tabular-nums text-ink-300">
              {formatMoney(slice.total, currency)} · {slice.share}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
