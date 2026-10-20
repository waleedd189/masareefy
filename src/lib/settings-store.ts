import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { PARSER_VERSION } from "@/lib/sms/templates";
import type { TxType } from "@/lib/sms/types";

/**
 * مخزن الإعدادات (جدول key/value) بصيغة مكتوبة — نفس فكرة `SmsServerGate`
 * و`SmsOwnerSettings` في التطبيق المرجعي: بوابة تحكّم في التسجيل الآلي يمكن
 * إيقافها أو تشديدها بدون نشر كود.
 */

export interface PolicySettings {
  /** تفعيل تتبّع الرسائل أصلًا */
  trackingEnabled: boolean;
  /** التسجيل الآلي للعمليات (AUTO_POST) */
  autoPost: boolean;
  /** إيقاف مؤقت لكل القرارات الآلية (كل حاجة تروح للمراجعة) */
  paused: boolean;
  /** أقل درجة ثقة للتسجيل الآلي */
  minConfidence: number;
  /** اشترط قالب موثّق (VERIFIED) للتسجيل الآلي */
  requireVerified: boolean;
  /** العمليات بعملة أجنبية تحتاج مراجعة */
  reviewForeignCurrency: boolean;
  /** أنواع عمليات تحتاج مراجعة دائمًا */
  reviewKinds: TxType[];
  /** أقصى مبلغ يتسجل تلقائيًا (null = بلا حد) */
  maxAutoAmount: number | null;
  /** أقل إصدار محلل مقبول (نتائج أقدم تتراجع) */
  minParserVersion: number;
  /** تعلّم رابط المرسل تلقائيًا من كل موافقة */
  learnFromApprovals: boolean;
}

export const DEFAULT_POLICY: PolicySettings = {
  trackingEnabled: true,
  autoPost: true,
  paused: false,
  minConfidence: 0.55,
  requireVerified: false,
  reviewForeignCurrency: true,
  reviewKinds: ["REFUND", "TRANSFER_IN", "FEE", "UNKNOWN"],
  maxAutoAmount: null,
  minParserVersion: PARSER_VERSION,
  learnFromApprovals: true,
};

export const SETTINGS_KEYS = {
  policy: "policy",
  monthlyBudget: "budget.monthlyTotal",
  fxRates: "fx.rates",
  lastBackupAt: "backup.lastAt",
  autoBackup: "backup.auto",
  hideBalances: "prefs.hideBalances",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (row) await db.update(settings).set({ value }).where(eq(settings.key, key));
  else await db.insert(settings).values({ key, value });
}

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSetting(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export async function getPolicy(): Promise<PolicySettings> {
  return getJson<PolicySettings>(SETTINGS_KEYS.policy, DEFAULT_POLICY);
}

export async function savePolicy(patch: Partial<PolicySettings>): Promise<PolicySettings> {
  const current = await getPolicy();
  const next: PolicySettings = {
    ...current,
    ...patch,
    minConfidence: clamp(Number(patch.minConfidence ?? current.minConfidence) || 0, 0, 1),
    maxAutoAmount:
      patch.maxAutoAmount === null || patch.maxAutoAmount === undefined
        ? current.maxAutoAmount
        : Number(patch.maxAutoAmount) > 0
          ? Number(patch.maxAutoAmount)
          : null,
    reviewKinds: Array.isArray(patch.reviewKinds) ? patch.reviewKinds : current.reviewKinds,
  };
  await setSetting(SETTINGS_KEYS.policy, JSON.stringify(next));
  return next;
}

/** الميزانية الشهرية الإجمالية (null = غير محددة) */
export async function getMonthlyBudgetTotal(): Promise<number | null> {
  const raw = await getSetting(SETTINGS_KEYS.monthlyBudget);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function setMonthlyBudgetTotal(value: number | null): Promise<void> {
  await setSetting(SETTINGS_KEYS.monthlyBudget, value && value > 0 ? String(value) : "");
}

export interface FxRates {
  /** سعر الصرف مقابل الجنيه المصري */
  [code: string]: number;
}

export async function getFxRates(): Promise<FxRates> {
  const raw = await getSetting(SETTINGS_KEYS.fxRates);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as FxRates;
  } catch {
    return {};
  }
}

export async function saveFxRates(rates: FxRates): Promise<void> {
  await setSetting(SETTINGS_KEYS.fxRates, JSON.stringify(rates));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
