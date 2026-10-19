import { asc, desc, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { round2 } from "@/lib/format";
import { foldArabic } from "@/lib/sms/normalize";

/**
 * تجميع التجار المتشابهين — البند الناقص في «التصنيف الذكي».
 *
 * نفس التاجر بييجي بأشكال مختلفة من رسائل البنك
 * (CARREFOUR / CARREFOUR MAADI / كارفور مصر / CARREFOUR MARKET EGP)،
 * فبنطبع الاسم وبنجمّع المتشابهين وبنقترح اسم موحّد للدمج.
 */

export interface MerchantStat {
  merchant: string;
  total: number;
  count: number;
  lastSeen: Date | null;
  categoryId: string | null;
}

export interface MerchantGroup {
  /** الاسم المقترح كموحّد (الأكثر تكرارًا، ثم الأطول) */
  canonical: string;
  variants: MerchantStat[];
  total: number;
  count: number;
  /** سبب التجميع (للعرض) */
  reason: string;
}

/** أسماء شركات وكيانات قانونية مالهاش لازمة في المطابقة */
const LEGAL_NOISE = [
  "ش\\.م\\.م",
  "ذ\\.م\\.م",
  "م\\.م",
  "شركة",
  "الشركة",
  "مؤسسة",
  "مصر",
  "مصريه",
  "مصرية",
  "llc",
  "ltd",
  "limited",
  "inc",
  "co",
  "corp",
  "company",
  "group",
  "holding",
  "egypt",
  "eg",
  "el",
  "al",
];

/** كلمات وصفية بتتكرر في أسماء التجار */
const GENERIC_WORDS = [
  "سوبر",
  "ماركت",
  "market",
  "super",
  "store",
  "ستور",
  "فرع",
  "branch",
  "mol",
  "مول",
  "online",
  "اونلاين",
  "دوت",
  "com",
  "www",
  "http",
  "https",
];

/** تطبيع اسم التاجر للمقارنة */
export function merchantKey(name: string): string {
  let key = foldArabic(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const noise of LEGAL_NOISE) key = key.replace(new RegExp(`\\b${noise}\\b`, "g"), " ");
  for (const word of GENERIC_WORDS) key = key.replace(new RegExp(`\\b${word}\\b`, "g"), " ");

  return key.replace(/\s+/g, " ").trim();
}

/** أول كلمة/كلمتين كمفتاح تقريبي (للتجميع السريع) */
function headToken(key: string): string {
  const parts = key.split(" ").filter(Boolean);
  return parts[0] ?? "";
}

/** تشابه جاكارد على الحروف الثلاثية — بيتحمّل فرق بسيط في الترتيب/التهجّي */
function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

const SIMILARITY_THRESHOLD = 0.62;

/** كل التجار بإجمالياتهم (من العمليات اللي فيها اسم تاجر) */
export async function listMerchants(limit = 400): Promise<MerchantStat[]> {
  const rows = await db
    .select({
      merchant: transactions.merchant,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
      lastSeen: sql<Date | null>`max(${transactions.occurredAt})`,
      categoryId: sql<string | null>`max(${transactions.categoryId})`,
    })
    .from(transactions)
    .where(isNotNull(transactions.merchant))
    .groupBy(transactions.merchant)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows
    .filter((row) => (row.merchant ?? "").trim().length > 0)
    .map((row) => ({
      merchant: (row.merchant ?? "").trim(),
      total: round2(Number(row.total ?? 0)),
      count: Number(row.count ?? 0),
      lastSeen: (row.lastSeen as unknown as Date | number | null)
        ? new Date(row.lastSeen as unknown as number)
        : null,
      categoryId: row.categoryId ?? null,
    }));
}

/**
 * تجميع التجار المتشابهين:
 * 1) نفس المفتاح بعد التطبيع ⇒ مجموعة واحدة
 * 2) تشابه ≥ 0.62 على الحروف الثلاثية ⇒ نفس المجموعة
 */
export function groupMerchants(merchants: MerchantStat[]): MerchantGroup[] {
  const groups: { key: string; members: MerchantStat[]; reason: string }[] = [];

  for (const stat of merchants) {
    const key = merchantKey(stat.merchant);
    if (!key) continue;

    // 1) تطابق المفتاح المطبّع
    let target = groups.find((g) => g.key === key);
    let reason = "نفس الاسم بعد التطبيع";

    // 2) تشابه عالي مع مجموعة موجودة
    if (!target) {
      let bestScore = 0;
      for (const group of groups) {
        const score = Math.max(similarity(key, group.key), similarity(headToken(key), headToken(group.key)) * 0.9);
        if (score > bestScore) {
          bestScore = score;
          target = group;
        }
      }
      if (target && bestScore >= SIMILARITY_THRESHOLD) reason = `تشابه ${Math.round(bestScore * 100)}%`;
      else target = undefined;
    }

    if (target) {
      if (!target.members.some((m) => m.merchant === stat.merchant)) target.members.push(stat);
    } else {
      groups.push({ key, members: [stat], reason });
    }
  }

  return groups
    .filter((group) => group.members.length > 1)
    .map((group) => {
      const sorted = group.members.slice().sort((a, b) => b.count - a.count || b.merchant.length - a.merchant.length);
      const canonical = sorted[0].merchant;
      return {
        canonical,
        variants: sorted,
        total: round2(sorted.reduce((sum, m) => sum + m.total, 0)),
        count: sorted.reduce((sum, m) => sum + m.count, 0),
        reason: group.reason,
      } as MerchantGroup;
    })
    .sort((a, b) => b.count - a.count);
}

/** اقتراحات الدمج الجاهزة (مجموعات فيها أكتر من شكل) */
export async function getMergeSuggestions(): Promise<MerchantGroup[]> {
  const merchants = await listMerchants();
  return groupMerchants(merchants);
}

/** عدد الأشكال المختلفة لتاجر واحد (للتقارير) */
export async function getMerchantDiversity(): Promise<{ distinct: number; groups: number }> {
  const merchants = await listMerchants();
  const groups = groupMerchants(merchants);
  return { distinct: merchants.length, groups: groups.length };
}

export const MERCHANT_SORT = { asc, desc };
