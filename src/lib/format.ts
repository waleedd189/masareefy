import { currencySymbol } from "./sms/currency";

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number | null | undefined, currency = "EGP", options?: { compact?: boolean }): string {
  const amount = value ?? 0;
  const formatted = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: options?.compact ? 0 : 2,
    maximumFractionDigits: options?.compact ? 1 : 2,
    notation: options?.compact ? "compact" : "standard",
  }).format(amount);
  return `${formatted} ${currencySymbol(currency)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ar-EG").format(value);
}

const DATE_FMT = new Intl.DateTimeFormat("ar-EG", { day: "2-digit", month: "short", year: "numeric" });
const DATETIME_FMT = new Intl.DateTimeFormat("ar-EG", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date | string): string {
  return DATE_FMT.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return DATETIME_FMT.format(new Date(date));
}

export function formatRelative(date: Date | string): string {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(date);
}

export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date);
}

export function shortMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", { month: "short" }).format(date);
}

export function maskedCard(last4: string): string {
  return `•••• ${last4}`;
}
