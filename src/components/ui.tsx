import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface p-4 sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: number | null;
  icon?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "from-ink-800/80 to-ink-900/60 text-ink-50",
    good: "from-emerald-500/15 to-ink-900/60 text-emerald-200",
    bad: "from-rose-500/15 to-ink-900/60 text-rose-200",
    warn: "from-amber-500/15 to-ink-900/60 text-amber-200",
  };
  return (
    <div className={`surface relative overflow-hidden bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-400">{label}</span>
        {icon ? <span className="text-lg opacity-80">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {typeof trend === "number" ? (
          <span
            className={`rounded-full px-1.5 py-0.5 font-bold ${
              trend > 0 ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%
          </span>
        ) : null}
        {hint ? <span className="text-ink-400">{hint}</span> : null}
      </div>
    </div>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon = "🗂️",
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-700/80 bg-ink-950/40 px-4 py-10 text-center">
      <span className="text-3xl">{icon}</span>
      <h3 className="text-sm font-bold">{title}</h3>
      {description ? <p className="max-w-sm text-xs leading-relaxed text-ink-400">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-2">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "warn" | "danger" }) {
  const colors: Record<string, string> = {
    brand: "bg-gradient-to-r from-brand-400 to-brand-600",
    warn: "bg-gradient-to-r from-amber-400 to-amber-600",
    danger: "bg-gradient-to-r from-rose-400 to-rose-600",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
