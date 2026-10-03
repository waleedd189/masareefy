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
    note: text("note"),
    messageId: text("message_id").references(() => messages.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (table) => [
    index("tx_card_date_idx").on(table.cardId, table.occurredAt),
    index("tx_date_idx").on(table.occurredAt),
    index("tx_category_idx").on(table.categoryId),
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
