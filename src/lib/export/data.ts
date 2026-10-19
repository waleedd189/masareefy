import { and, asc, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, categories, debts, goals, messages, recurringRules, settings, transactions } from "@/db/schema";
import { formatDate, formatMoney, round2 } from "@/lib/format";
import { buildXlsx, type SheetData } from "@/lib/export/xlsx";
import { getBudgetSummary } from "@/lib/services/budgets";
import { isIncome, isSpend } from "@/lib/services/stats";
import { DECISION_LABELS, REASON_LABELS, type Decision, type DecisionReason } from "@/lib/services/policy";
import { intervalLabel } from "@/lib/services/reminders";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";

/**
 * مجمّع بيانات التصدير — بيغذي CSV وJSON وExcel و"نسخة احتياطية كاملة"
 * (مقابل `hub/reports` + `export_screen/excel-color.svg` + `backup` في Mezanetak).
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export function parseRange(from?: string | null, to?: string | null): DateRange {
  const now = new Date();
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = to ? new Date(to) : now;
  return {
    from: Number.isNaN(fromDate.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : fromDate,
    to: Number.isNaN(toDate.getTime()) ? now : toDate,
  };
}

export interface ExportData {
  range: DateRange;
  transactions: typeof transactions.$inferSelect[];
  messages: typeof messages.$inferSelect[];
  cards: typeof cards.$inferSelect[];
  categories: typeof categories.$inferSelect[];
  goals: typeof goals.$inferSelect[];
  debts: typeof debts.$inferSelect[];
  recurring: typeof recurringRules.$inferSelect[];
  settings: { key: string; value: string }[];
}

export async function collectExportData(range: DateRange): Promise<ExportData> {
  const between = and(gte(transactions.occurredAt, range.from), lte(transactions.occurredAt, range.to));
  const [txs, msgs, cds, cats, gls, dbs, rec, cfg] = await Promise.all([
    db.select().from(transactions).where(between).orderBy(asc(transactions.occurredAt)),
    db
      .select()
      .from(messages)
      .where(and(gte(messages.receivedAt, range.from), lte(messages.receivedAt, range.to)))
      .orderBy(asc(messages.receivedAt)),
    db.select().from(cards).orderBy(asc(cards.name)),
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(goals).where(gte(goals.isArchived, false)).orderBy(asc(goals.createdAt)),
    db.select().from(debts).orderBy(asc(debts.createdAt)),
    db.select().from(recurringRules).orderBy(asc(recurringRules.createdAt)),
    db.select().from(settings),
  ]);

  return {
    range,
    transactions: txs,
    messages: msgs,
    cards: cds,
    categories: cats,
    goals: gls,
    debts: dbs,
    recurring: rec,
    settings: cfg.map((row) => ({ key: row.key, value: row.value })),
  };
}


/** مجاميع النطاق (صرف/دخل/فئات/أنواع/تجار) من العمليات المجموعة */
export function summarize(data: ExportData) {
  const spendRows = data.transactions.filter(isSpend);
  const incomeRows = data.transactions.filter(isIncome);
  const spent = round2(spendRows.reduce((sum, t) => sum + t.amount, 0));
  const income = round2(incomeRows.reduce((sum, t) => sum + t.amount, 0));

  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const byCategory = new Map<string, { name: string; total: number; count: number }>();
  for (const tx of spendRows) {
    const name = tx.categoryId ? catById.get(tx.categoryId)?.name ?? "بدون فئة" : "بدون فئة";
    const row = byCategory.get(name) ?? { name, total: 0, count: 0 };
    row.total = round2(row.total + tx.amount);
    row.count += 1;
    byCategory.set(name, row);
  }

  const byType = new Map<string, { type: TxType; total: number; count: number }>();
  for (const tx of data.transactions) {
    const row = byType.get(tx.type) ?? { type: tx.type as TxType, total: 0, count: 0 };
    row.total = round2(row.total + tx.amount);
    row.count += 1;
    byType.set(tx.type, row);
  }

  const merchants = new Map<string, { merchant: string; total: number; count: number }>();
  for (const tx of spendRows) {
    const name = (tx.merchant ?? "").trim();
    if (!name) continue;
    const row = merchants.get(name) ?? { merchant: name, total: 0, count: 0 };
    row.total = round2(row.total + tx.amount);
    row.count += 1;
    merchants.set(name, row);
  }

  return {
    spent,
    income,
    net: round2(income - spent),
    byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total).map((r) => ({
      name: r.name,
      total: r.total,
      count: r.count,
      pct: spent ? Math.round((r.total / spent) * 100) : 0,
    })),
    byType: [...byType.values()].sort((a, b) => b.total - a.total),
    topMerchants: [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 10),
  };
}

// ── CSV ──────────────────────────────────────────────────────────────────────

function escapeCsv(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export async function transactionsCsv(range: DateRange): Promise<string> {
  const data = await collectExportData(range);
  const cardById = new Map(data.cards.map((card) => [card.id, card]));
  const catById = new Map(data.categories.map((cat) => [cat.id, cat]));
  const header = ["date", "type", "direction", "amount", "currency", "merchant", "category", "card", "note"];
  const rows = data.transactions.map((tx) => [
    tx.occurredAt.toISOString().slice(0, 10),
    tx.type,
    tx.direction,
    tx.amount,
    tx.currency,
    tx.merchant ?? "",
    tx.categoryId ? catById.get(tx.categoryId)?.name ?? "" : "",
    tx.cardId ? cardById.get(tx.cardId)?.name ?? "" : "",
    tx.note ?? "",
  ]);
  return buildCsv([header, ...rows]);
}

export async function messagesCsv(range: DateRange): Promise<string> {
  const data = await collectExportData(range);
  const header = ["received_at", "sender", "status", "decision", "reasons", "template", "confidence", "raw_text"];
  const rows = data.messages.map((m) => [
    m.receivedAt.toISOString(),
    m.sender ?? "",
    m.status,
    m.decision ?? "",
    reasonLabels(m.reasons),
    m.templateId ?? "",
    String(m.confidence),
    m.rawText,
  ]);
  return buildCsv([header, ...rows]);
}

function reasonLabels(raw: string | null): string {
  if (!raw) return "";
  try {
    const list = JSON.parse(raw) as DecisionReason[];
    return list.map((r) => REASON_LABELS[r] ?? r).join(" | ");
  } catch {
    return "";
  }
}

// ── JSON / Backup ────────────────────────────────────────────────────────────

export async function backupJson(range: DateRange) {
  const data = await collectExportData(range);
  const totals = summarize(data);
  return {
    app: "مصاريفي",
    version: 2,
    generatedAt: new Date().toISOString(),
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      spent: totals.spent,
      income: totals.income,
      net: totals.net,
      transactions: data.transactions.length,
      messages: data.messages.length,
      byType: totals.byType,
      byCategory: totals.byCategory,
      topMerchants: totals.topMerchants,
    },
    cards: data.cards,
    categories: data.categories,
    goals: data.goals,
    debts: data.debts,
    recurringRules: data.recurring,
    transactions: data.transactions,
    messages: data.messages,
    settings: data.settings.filter((s) => !s.value.startsWith("msr_")),
  };
}

export async function transactionsJson(range: DateRange) {
  const data = await collectExportData(range);
  return { generatedAt: new Date().toISOString(), count: data.transactions.length, transactions: data.transactions };
}

// ── XLSX (ملف Excel بأكثر من ورقة) ───────────────────────────────────────────

export async function buildReportWorkbook(range: DateRange): Promise<Buffer> {
  const data = await collectExportData(range);
  const totals = summarize(data);
  const budget = await getBudgetSummary(range.from);
  const cardById = new Map(data.cards.map((card) => [card.id, card]));
  const catById = new Map(data.categories.map((cat) => [cat.id, cat]));

  const summary: SheetData = {
    name: "الملخص",
    widths: [26, 18, 18],
    rows: [
      ["تقرير مصاريفي", `${formatDate(range.from)} → ${formatDate(range.to)}`, ""],
      [],
      ["البيان", "المبلغ", "ملاحظة"],
      ["إجمالي الصرف", totals.spent, formatMoney(totals.spent)],
      ["إجمالي الدخل", totals.income, formatMoney(totals.income)],
      ["الصافي", totals.net, formatMoney(totals.net)],
      ["عدد العمليات", data.transactions.length, ""],
      ["عدد الرسائل", data.messages.length, ""],
      ["الميزانية الشهرية", budget.effectiveBudget ?? "غير محددة", ""],
      ["المتبقي من الميزانية", budget.remaining, budget.pct ? `${budget.pct}% مستهلك` : ""],
      ["متوسط اليوم المسموح", budget.dailyAllowance ?? "", `صرفك اليومي: ${budget.dailyPace ?? "-"}`],
      [],
      ["حسب الفئة", "المبلغ", "النسبة"],
      ...totals.byCategory.map((row) => [row.name, row.total, `${row.pct}%`]),
      [],
      ["حسب نوع العملية", "المبلغ", "عدد العمليات"],
      ...totals.byType.map((row) => [TX_TYPE_LABELS[row.type as TxType] ?? row.type, row.total, row.count]),
      [],
      ["أعلى تاجر", "المبلغ", "عدد العمليات"],
      ...totals.topMerchants.map((row) => [row.merchant, row.total, row.count]),
    ],
  };

  const txSheet: SheetData = {
    name: "العمليات",
    widths: [12, 14, 12, 14, 10, 28, 18, 20, 24],
    rows: [
      ["التاريخ", "النوع", "الاتجاه", "المبلغ", "العملة", "التاجر", "الفئة", "الحساب", "ملاحظة"],
      ...data.transactions.map((tx) => [
        formatDate(tx.occurredAt),
        TX_TYPE_LABELS[tx.type as TxType] ?? tx.type,
        tx.direction === "OUT" ? "خارج" : "داخل",
        tx.amount,
        tx.currency,
        tx.merchant ?? "",
        tx.categoryId ? catById.get(tx.categoryId)?.name ?? "" : "",
        tx.cardId ? cardById.get(tx.cardId)?.name ?? "" : "",
        tx.note ?? "",
      ]),
    ],
  };

  const cardsSheet: SheetData = {
    name: "الحسابات",
    widths: [22, 16, 10, 12, 14, 16, 14, 14],
    rows: [
      ["الاسم", "البنك", "آخر 4", "النوع", "العملة", "الرصيد الحالي", "يوم الكشف", "يوم السداد"],
      ...data.cards.map((card) => [
        card.name,
        card.bankKey,
        card.last4,
        card.accountType ?? card.type ?? "",
        card.currency,
        card.currentBalance,
        card.statementDay ?? "",
        card.dueDay ?? "",
      ]),
    ],
  };

  const goalsSheet: SheetData = {
    name: "الأهداف",
    widths: [22, 14, 14, 10, 12],
    rows: [
      ["الهدف", "الهدف (مبلغ)", "المدخر", "النسبة", "تاريخ الاستحقاق"],
      ...data.goals.map((goal) => [
        goal.name,
        goal.targetAmount,
        goal.savedAmount,
        `${goal.targetAmount ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0}%`,
        goal.dueDate ? formatDate(goal.dueDate) : "",
      ]),
    ],
  };

  const commitmentsSheet: SheetData = {
    name: "الالتزامات",
    widths: [24, 12, 12, 14, 14, 12],
    rows: [
      ["البند", "المبلغ", "التكرار", "الاستحقاق الجاي", "النوع", "الحالة"],
      ...data.recurring.map((rule) => [
        rule.title,
        rule.amount,
        intervalLabel(rule.interval),
        rule.nextRunAt ? formatDate(rule.nextRunAt) : "",
        rule.kind ?? "اشتراك",
        rule.isActive ? "نشط" : "موقوف",
      ]),
      [],
      ["الدين", "المبلغ", "المسدد", "المتبقي", "الاستحقاق", "الحالة"],
      ...data.debts.map((debt) => [
        debt.person,
        debt.amount,
        debt.paidAmount,
        debt.amount - debt.paidAmount,
        debt.dueDate ? formatDate(debt.dueDate) : "",
        debt.isSettled ? "مسدد" : "قائم",
      ]),
    ],
  };

  const messagesSheet: SheetData = {
    name: "الرسائل",
    widths: [18, 16, 14, 14, 30, 18, 60],
    rows: [
      ["الوقت", "المرسل", "الحالة", "القرار", "الأسباب", "القالب", "النص"],
      ...data.messages.map((m) => [
        formatDate(m.receivedAt),
        m.sender ?? "",
        m.status,
        m.decision ? DECISION_LABELS[m.decision as Decision] ?? m.decision : "",
        reasonLabels(m.reasons),
        m.templateId ?? "",
        m.rawText.slice(0, 200),
      ]),
    ],
  };

  return buildXlsx([summary, txSheet, cardsSheet, goalsSheet, commitmentsSheet, messagesSheet]);
}

/** نسخة CSV مجمّعة لكل الجداول (للاستيراد في أداة تانية) */
export async function fullCsv(range: DateRange): Promise<string> {
  const data = await collectExportData(range);
  const sections: string[] = [];
  sections.push("# الحسابات");
  sections.push(
    buildCsv([
      ["name", "bank", "last4", "type", "currency", "balance", "statementDay", "dueDay"],
      ...data.cards.map((c) => [c.name, c.bankKey, c.last4, c.accountType ?? c.type ?? "", c.currency, c.currentBalance, c.statementDay ?? "", c.dueDay ?? ""]),
    ]),
  );
  sections.push("\n# العمليات");
  sections.push(await transactionsCsv(range));
  sections.push("\n# الرسائل");
  sections.push(await messagesCsv(range));
  return sections.join("\n");
}
