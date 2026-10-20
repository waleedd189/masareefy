import { round2 } from "@/lib/format";
import { getFxRates, saveFxRates as persistRates, type FxRates } from "@/lib/settings-store";

export type { FxRates };

/**
 * أسعار الصرف — مقابل شاشة `exchange-rates` في Mezanetak.
 *
 * الأسعار بتتحفظ في الإعدادات (مصدر يدوي أو تحديث من API) وبتُستخدم لعرض
 * العمليات الأجنبية بالجنيه المصري في التقارير والتحليلات.
 */

export const FX_BASE = "EGP";

export const KNOWN_CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "KWD", "QAR", "TRY"] as const;

export async function getRates(): Promise<FxRates> {
  return getFxRates();
}

export function convert(amount: number, from: string, to: string, rates: FxRates): number | null {
  if (!amount || from === to) return round2(amount);
  if (to === FX_BASE) {
    const rate = rates[from];
    return rate ? round2(amount * rate) : null;
  }
  if (from === FX_BASE) {
    const rate = rates[to];
    return rate ? round2(amount / rate) : null;
  }
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return null;
  return round2((amount * fromRate) / toRate);
}

/** تحديث الأسعار من مصدر عام (مع تجاوز آمن لو المصدر مش متاح) */
export async function refreshRatesFromApi(endpoint = "https://open.er-api.com/v6/latest/EGP"): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, updated: 0, error: `HTTP ${response.status}` };
    const json = (await response.json()) as { rates?: Record<string, number> };
    const rates = json.rates ?? {};
    const next: FxRates = {};
    for (const code of KNOWN_CURRENCIES) {
      const perEgp = rates[code];
      if (perEgp && perEgp > 0) next[code] = round2(1 / perEgp); // السعر: كم جنيه لكل وحدة
    }
    if (!Object.keys(next).length) return { ok: false, updated: 0, error: "مفيش أسعار في الرد" };
    await persistRates(next);
    return { ok: true, updated: Object.keys(next).length };
  } catch (error) {
    return { ok: false, updated: 0, error: error instanceof Error ? error.message : "فشل الاتصال" };
  }
}

export async function saveFxRates(rates: FxRates): Promise<void> {
  await persistRates(rates);
}
