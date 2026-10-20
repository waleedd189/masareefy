import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, debts, goals, messages, parserRules, parserWords, recurringRules, senderLinks, transactions } from "@/db/schema";
import { getBudgetSummary } from "./budgets";
import { getStreak } from "./streak";

/**
 * شارات الإنجاز — البند الناقص في «سلسلة الالتزام والشارات».
 *
 * كلها **مشتقة من بياناتك الحالية** (مفيش جدول جديد ولا حالة بتتخزّن)،
 * فالشارة بتظهر أول ما تستحقها فعلًا وبتقترح عليك الخطوة الجاية.
 */

export interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** القيمة الحالية مقابل الهدف (لشريط التقدم) */
  progress: number;
  target: number;
  earned: boolean;
  /** وحدة القياس في شريط التقدم */
  unit?: string;
}

export interface BadgesSummary {
  all: BadgeDef[];
  earned: BadgeDef[];
  locked: BadgeDef[];
  earnedCount: number;
  totalCount: number;
  pct: number;
  /** أقرب شارة للفتح (أعلى نسبة تقدم من غير ما تكون مفتوحة) */
  nextUp: BadgeDef | null;
}

function badge(def: Omit<BadgeDef, "earned" | "progress"> & { progress: number }): BadgeDef {
  const progress = Math.max(0, def.progress);
  return { ...def, progress, earned: def.target > 0 && progress >= def.target };
}

export async function getBadges(now = new Date()): Promise<BadgesSummary> {
  const [counts, streak, budget] = await Promise.all([getCounts(), getStreak(now), getBudgetSummary(now)]);

  const all: BadgeDef[] = [
    badge({
      id: "first-transaction",
      emoji: "🥇",
      title: "أول خطوة",
      description: "سجّلت أول عملية في مصاريفي",
      progress: counts.transactions,
      target: 1,
      unit: "عملية",
    }),
    badge({
      id: "tx-100",
      emoji: "💯",
      title: "منتظم",
      description: "100 عملية مسجلة",
      progress: counts.transactions,
      target: 100,
      unit: "عملية",
    }),
    badge({
      id: "tx-500",
      emoji: "🏅",
      title: "محترف تسجيل",
      description: "500 عملية مسجلة",
      progress: counts.transactions,
      target: 500,
      unit: "عملية",
    }),
    badge({
      id: "first-sms",
      emoji: "📨",
      title: "قارئ الرسائل",
      description: "أول رسالة بنك اتحللت واتسجلت",
      progress: counts.parsedMessages,
      target: 1,
      unit: "رسالة",
    }),
    badge({
      id: "sms-50",
      emoji: "📬",
      title: "أوتوماتيك",
      description: "50 رسالة اتسجلت تلقائيًا من غير تدخل",
      progress: counts.parsedMessages,
      target: 50,
      unit: "رسالة",
    }),
    badge({
      id: "streak-3",
      emoji: "🔥",
      title: "بداية السلسلة",
      description: "3 أيام ورا بعض سجّلت فيهم",
      progress: streak.current,
      target: 3,
      unit: "يوم",
    }),
    badge({
      id: "streak-7",
      emoji: "⚡",
      title: "أسبوع كامل",
      description: "7 أيام متتالية تسجيل",
      progress: streak.current,
      target: 7,
      unit: "يوم",
    }),
    badge({
      id: "streak-30",
      emoji: "🌋",
      title: "عادة شهرية",
      description: "30 يوم متتالي تسجيل",
      progress: streak.current,
      target: 30,
      unit: "يوم",
    }),
    badge({
      id: "best-streak-60",
      emoji: "🏆",
      title: "أطول نفس",
      description: "أطول سلسلة وصلت لـ60 يوم",
      progress: streak.best,
      target: 60,
      unit: "يوم",
    }),
    badge({
      id: "under-budget",
      emoji: "🎚️",
      title: "داخل الميزانية",
      description: "الشهر ده صرفك أقل من الميزانية المحددة",
      progress: budget.effectiveBudget && budget.spent <= budget.effectiveBudget && budget.spent > 0 ? 1 : 0,
      target: 1,
      unit: "شهر",
    }),
    badge({
      id: "budget-set",
      emoji: "🧭",
      title: "خطة واضحة",
      description: "حددت ميزانية شهرية (إجمالية أو لفئة)",
      progress: budget.effectiveBudget ? 1 : 0,
      target: 1,
    }),
    badge({
      id: "first-goal",
      emoji: "🎯",
      title: "حلم مكتوب",
      description: "أضفت أول هدف ادخار",
      progress: counts.goals,
      target: 1,
      unit: "هدف",
    }),
    badge({
      id: "goal-achieved",
      emoji: "🥳",
      title: "هدف اتحقق",
      description: "وصلت لـ100% من هدف ادخار",
      progress: counts.goalsAchieved,
      target: 1,
      unit: "هدف",
    }),
    badge({
      id: "teach-5",
      emoji: "🧠",
      title: "معلّم المحلل",
      description: "علّمت المحلل 5 كلمات من عندك",
      progress: counts.userWords,
      target: 5,
      unit: "كلمة",
    }),
    badge({
      id: "first-link",
      emoji: "🔗",
      title: "ربط ذكي",
      description: "أول رابط مرسل اتحفظ (رسائل بتتصنف لوحدها)",
      progress: counts.senderLinks,
      target: 1,
      unit: "رابط",
    }),
    badge({
      id: "first-recurring",
      emoji: "🔁",
      title: "مش هتنسى",
      description: "أضفت أول بند متكرر (اشتراك/إيجار/قسط)",
      progress: counts.recurring,
      target: 1,
      unit: "بند",
    }),
    badge({
      id: "debt-free",
      emoji: "🕊️",
      title: "من غير ديون",
      description: "سدّدت كل الديون اللي عليك",
      progress: counts.debtsTotal > 0 && counts.debtsOwed === 0 ? 1 : 0,
      target: 1,
    }),
    badge({
      id: "first-transfer",
      emoji: "⇄",
      title: "منظّم الحسابات",
      description: "أول تحويل بين حسابين",
      progress: counts.transfers,
      target: 1,
      unit: "تحويل",
    }),
    badge({
      id: "braindump-10",
      emoji: "⚡",
      title: "سرعة البديهة",
      description: "10 عمليات من التفريغ السريع",
      progress: counts.brainDumps,
      target: 10,
      unit: "عملية",
    }),
    badge({
      id: "accounts-3",
      emoji: "🏦",
      title: "محفظة متكاملة",
      description: "3 أنواع حسابات مختلفة (بطاقة/محفظة/كاش…)",
      progress: counts.accountTypes,
      target: 3,
      unit: "نوع",
    }),
    badge({
      id: "custom-rules",
      emoji: "🛠️",
      title: "محلل على مزاجك",
      description: "أضفت قاعدة تحليل مخصّصة",
      progress: counts.customRules,
      target: 1,
      unit: "قاعدة",
    }),
    badge({
      id: "first-report",
      emoji: "📑",
      title: "قارئ تقارير",
      description: "عندك بيانات تكفي تقرير شهر كامل (30 عملية+)",
      progress: counts.transactions >= 30 ? 1 : 0,
      target: 1,
    }),
  ];

  const earned = all.filter((b) => b.earned);
  const locked = all.filter((b) => !b.earned);
  const nextUp =
    locked
      .slice()
      .sort((a, b) => b.progress / b.target - a.progress / a.target)[0] ?? null;

  return {
    all,
    earned,
    locked,
    earnedCount: earned.length,
    totalCount: all.length,
    pct: all.length ? Math.round((earned.length / all.length) * 100) : 0,
    nextUp,
  };
}

interface Counts {
  transactions: number;
  parsedMessages: number;
  userWords: number;
  senderLinks: number;
  recurring: number;
  goals: number;
  goalsAchieved: number;
  debtsTotal: number;
  debtsOwed: number;
  transfers: number;
  brainDumps: number;
  accountTypes: number;
  customRules: number;
}

async function getCounts(): Promise<Counts> {
  const [
    [txRow],
    [msgRow],
    [wordRow],
    [linkRow],
    [recRow],
    [goalRow],
    [debtRow],
    [transferRow],
    [dumpRow],
    [typeRow],
    [ruleRow],
  ] = await Promise.all([
    db.select({ v: sql<number>`count(*)` }).from(transactions),
    db.select({ v: sql<number>`count(*)` }).from(messages).where(sql`${messages.status} = 'PARSED'`),
    db.select({ v: sql<number>`count(*)` }).from(parserWords).where(sql`${parserWords.origin} = 'USER'`),
    db.select({ v: sql<number>`count(*)` }).from(senderLinks),
    db.select({ v: sql<number>`count(*)` }).from(recurringRules),
    db.select({ v: sql<number>`count(*)` }).from(goals),
    db.select({ v: sql<number>`count(*)` }).from(debts),
    db
      .select({ v: sql<number>`count(distinct ${transactions.transferId})` })
      .from(transactions)
      .where(sql`${transactions.transferId} is not null`),
    db.select({ v: sql<number>`count(*)` }).from(transactions).where(sql`${transactions.note} = 'Brain dump'`),
    db.select({ v: sql<number>`count(distinct ${cards.accountType})` }).from(cards).where(sql`${cards.isArchived} = 0`),
    db.select({ v: sql<number>`count(*)` }).from(parserRules),
  ]);

  const debtsOwed = await db
    .select({ v: sql<number>`count(*)` })
    .from(debts)
    .where(sql`${debts.isSettled} = 0 AND ${debts.direction} = 'OWED_BY_ME'`);

  const goalsAchieved = await db
    .select({ v: sql<number>`count(*)` })
    .from(goals)
    .where(sql`${goals.savedAmount} >= ${goals.targetAmount} AND ${goals.targetAmount} > 0`);

  return {
    transactions: Number(txRow?.v ?? 0),
    parsedMessages: Number(msgRow?.v ?? 0),
    userWords: Number(wordRow?.v ?? 0),
    senderLinks: Number(linkRow?.v ?? 0),
    recurring: Number(recRow?.v ?? 0),
    goals: Number(goalRow?.v ?? 0),
    goalsAchieved: Number(goalsAchieved[0]?.v ?? 0),
    debtsTotal: Number(debtRow?.v ?? 0),
    debtsOwed: Number(debtsOwed[0]?.v ?? 0),
    transfers: Number(transferRow?.v ?? 0),
    brainDumps: Number(dumpRow?.v ?? 0),
    accountTypes: Number(typeRow?.v ?? 0),
    customRules: Number(ruleRow?.v ?? 0),
  };
}
