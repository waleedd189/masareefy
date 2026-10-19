import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = () => new Date();
const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

/** بطاقة (فيزا / ماستر / ميزة) أو حساب بنكي */
export const cards = sqliteTable(
  "cards",
  {
    id: id(),
    name: text("name").notNull(),
    bankKey: text("bank_key").notNull().default("generic"),
    bankName: text("bank_name").notNull().default(""),
    brand: text("brand").notNull().default("VISA"),
    last4: text("last4").notNull(),
    type: text("type").notNull().default("CREDIT"), // CREDIT | DEBIT | PREPAID
    currency: text("currency").notNull().default("EGP"),
    creditLimit: real("credit_limit"),
    openingBalance: real("opening_balance").notNull().default(0),
    /** للبطاقات الائتمانية = المستحق، لغيرها = الرصيد */
    currentBalance: real("current_balance").notNull().default(0),
    availableAmount: real("available_amount"),
    balanceSyncedAt: integer("balance_synced_at", { mode: "timestamp_ms" }),
    statementDay: integer("statement_day"),
    dueDay: integer("due_day"),
    color: text("color").notNull().default("emerald"),
    /** نوع الحساب: بطاقة، نقد، محفظة، حساب بنكي، استثمار… */
    accountType: text("account_type").notNull().default("CARD"),
    /** تصميم/خلفية البطاقة */
    design: text("design").notNull().default(""),
    notes: text("notes"),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [index("cards_last4_idx").on(table.last4), index("cards_archived_idx").on(table.isArchived)],
);

/** فئات المصروفات */
export const categories = sqliteTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull().default("🏷️"),
    color: text("color").notNull().default("slate"),
    /** كلمات مفتاحية مفصولة بفاصلة للتصنيف التلقائي */
    keywords: text("keywords").notNull().default(""),
    /** فئة أب (للفئات الفرعية) */
    parentId: text("parent_id"),
    monthlyBudget: real("monthly_budget"),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("categories_name_idx").on(table.name)],
);

/** رسائل البنك الخام + نتيجة تحليلها */
export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    rawText: text("raw_text").notNull(),
    sender: text("sender"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    hash: text("hash").notNull(),
    status: text("status").notNull().default("NEEDS_REVIEW"),
    bankKey: text("bank_key"),
    confidence: real("confidence").notNull().default(0),
    parsed: text("parsed"),
    cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
    error: text("error"),
    /** قرار محرّك السياسة: AUTO_POST | REVIEW | DROP */
    decision: text("decision").notNull().default("REVIEW"),
    /** أسباب القرار (JSON array) */
    reasons: text("reasons").notNull().default("[]"),
    /** معرّف القالب الموثّق اللي طابق الرسالة */
    templateId: text("template_id"),
    source: text("source").notNull().default("PASTE"), // PASTE | WEBHOOK | IMPORT
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex("messages_hash_idx").on(table.hash),
    index("messages_status_idx").on(table.status),
    index("messages_received_idx").on(table.receivedAt),
  ],
);

/** العمليات المالية */
export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("PURCHASE"),
    direction: text("direction").notNull().default("OUT"), // OUT | IN
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("EGP"),
    fxAmount: real("fx_amount"),
    fxCurrency: text("fx_currency"),
    merchant: text("merchant"),
    description: text("description"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    balanceAfter: real("balance_after"),
    availableAfter: real("available_after"),
    source: text("source").notNull().default("MANUAL"), // MANUAL | SMS | IMPORT
    isPending: integer("is_pending", { mode: "boolean" }).notNull().default(false),
    goalId: text("goal_id"),
    recurringId: text("recurring_id"),
    /**
     * معرّف التحويل بين الحسابات: الرجلين (خارج من حساب / داخل لحساب)
     * بيتشاركوا نفس القيمة عشان يتحسبوا كتحويل واحد ويتحذفوا مع بعض.
     */
    transferId: text("transfer_id"),
    note: text("note"),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("tx_card_date_idx").on(table.cardId, table.occurredAt),
    index("tx_date_idx").on(table.occurredAt),
    index("tx_category_idx").on(table.categoryId),
    index("tx_transfer_idx").on(table.transferId),
    uniqueIndex("tx_message_idx").on(table.messageId),
  ],
);

/** مفاتيح API لاستقبال الرسائل تلقائياً */
export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: id(),
    name: text("name").notNull(),
    token: text("token").notNull(),
    /** بصمة SHA-256 للمفتاح — التحقق بيتم عليها بدل النص الصريح */
    tokenHash: text("token_hash"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("api_tokens_token_idx").on(table.token)],
);

/** قواعد تحليل مخصّصة (Regex) يضيفها المستخدم */
export const parserRules = sqliteTable("parser_rules", {
  id: id(),
  name: text("name").notNull(),
  bankKey: text("bank_key").notNull().default("custom"),
  pattern: text("pattern").notNull(),
  typeHint: text("type_hint"),
  priority: integer("priority").notNull().default(100),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/** كلمات يتعلّمها المحلل من المستخدم (تاجر/نوع/تجاهل) */
export const parserWords = sqliteTable(
  "parser_words",
  {
    id: id(),
    /** الكلمة بعد التطبيع (foldArabic) */
    wordKey: text("word_key").notNull(),
    /** الكلمة كما كتبها المستخدم */
    display: text("display").notNull(),
    /** نوع العملية أو IGNORE */
    kind: text("kind").notNull().default("PURCHASE"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    origin: text("origin").notNull().default("USER"), // BUILTIN | USER
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    isProtected: integer("is_protected", { mode: "boolean" }).notNull().default(false),
    hits: integer("hits").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("parser_words_key_idx").on(table.wordKey, table.kind)],
);

/** ربط مرسل + آخر 4 أرقام بحساب/فئة (يتعلّم مع كل موافقة) */
export const senderLinks = sqliteTable(
  "sender_links",
  {
    id: id(),
    senderKey: text("sender_key").notNull(),
    last4: text("last4").notNull().default(""),
    cardId: text("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    label: text("label"),
    autoFile: integer("auto_file", { mode: "boolean" }).notNull().default(true),
    approvedCount: integer("approved_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex("sender_links_key_idx").on(table.senderKey, table.last4)],
);

/** أهداف الادخار */
export const goals = sqliteTable("goals", {
  id: id(),
  name: text("name").notNull(),
  targetAmount: real("target_amount").notNull(),
  savedAmount: real("saved_amount").notNull().default(0),
  currency: text("currency").notNull().default("EGP"),
  dueDate: integer("due_date", { mode: "timestamp_ms" }),
  emoji: text("emoji").notNull().default("🎯"),
  color: text("color").notNull().default("brand"),
  notes: text("notes"),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/** مصروفات/دخول متكررة واشتراكات */
export const recurringRules = sqliteTable("recurring_rules", {
  id: id(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  direction: text("direction").notNull().default("OUT"),
  kind: text("kind").notNull().default("SUBSCRIPTION"), // SUBSCRIPTION | RENT | SALARY | BILL | DEBT_PAYMENT | OTHER
  interval: text("interval").notNull().default("MONTHLY"), // DAILY | WEEKLY | MONTHLY | YEARLY
  dayOfMonth: integer("day_of_month"),
  cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/** الديون (لك أو عليك) */
export const debts = sqliteTable("debts", {
  id: id(),
  person: text("person").notNull(),
  direction: text("direction").notNull().default("OWED_BY_ME"), // OWED_BY_ME | OWED_TO_ME
  amount: real("amount").notNull(),
  paidAmount: real("paid_amount").notNull().default(0),
  currency: text("currency").notNull().default("EGP"),
  dueDate: integer("due_date", { mode: "timestamp_ms" }),
  cardId: text("card_id").references(() => cards.id, { onDelete: "set null" }),
  notes: text("notes"),
  isSettled: integer("is_settled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

/** إعدادات عامة key/value */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type ParserRule = typeof parserRules.$inferSelect;
export type ParserWord = typeof parserWords.$inferSelect;
export type NewParserWord = typeof parserWords.$inferInsert;
export type SenderLink = typeof senderLinks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type NewRecurringRule = typeof recurringRules.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
