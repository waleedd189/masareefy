"use client";

import { useState } from "react";
import type { Card, Category } from "@/db/schema";
import { Badge } from "@/components/ui";
import { MESSAGE_STATUS_LABELS, MESSAGE_STATUS_STYLES } from "@/lib/constants";
import { formatDateTime, formatMoney, maskedCard } from "@/lib/format";
import type { MessageWithRelations } from "@/lib/services/queries";
import { TX_TYPES, TX_TYPE_LABELS, type ParsedSms, type TxType } from "@/lib/sms/types";
import { confirmMessageAction, deleteMessageAction, ignoreMessageAction } from "@/server/actions/messages";

function toLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MessageItem({
  message,
  cards,
  categories,
}: {
  message: MessageWithRelations;
  cards: Card[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const parsed: ParsedSms | null = message.parsed ? (JSON.parse(message.parsed) as ParsedSms) : null;
  const needsAction = ["NEEDS_REVIEW", "UNMATCHED", "FAILED"].includes(message.status);

  return (
    <li className="surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={MESSAGE_STATUS_STYLES[message.status] ?? "border-ink-700 text-ink-300"}>
            {MESSAGE_STATUS_LABELS[message.status] ?? message.status}
          </Badge>
          {message.sender ? <Badge className="border-ink-700 text-ink-300">{message.sender}</Badge> : null}
          {message.card ? (
            <Badge className="border-brand-500/30 bg-brand-500/10 text-brand-300">
              {message.card.name} {maskedCard(message.card.last4)}
            </Badge>
          ) : null}
          <span className="text-[11px] text-ink-500">{formatDateTime(message.receivedAt)}</span>
        </div>
        <span className="text-[11px] text-ink-500">ثقة {Math.round(message.confidence * 100)}%</span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-300">{message.rawText}</p>

      {parsed && parsed.amount !== null ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-ink-950/60 px-3 py-2 text-[11px]">
          <span>
            المبلغ: <b className="text-brand-300">{formatMoney(parsed.amount, parsed.currency ?? "EGP")}</b>
          </span>
          <span>النوع: {TX_TYPE_LABELS[parsed.type as TxType]}</span>
          {parsed.merchant ? <span>التاجر: {parsed.merchant}</span> : null}
          {parsed.last4 ? <span>بطاقة: ••{parsed.last4}</span> : null}
          {parsed.availableBalance !== null ? (
            <span>المتاح: {formatMoney(parsed.availableBalance, parsed.currency ?? "EGP")}</span>
          ) : null}
        </div>
      ) : null}

      {message.error ? <p className="mt-2 text-[11px] text-amber-300">⚠️ {message.error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {needsAction ? (
          <button type="button" className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? "إلغاء" : "راجع وسجّل العملية"}
          </button>
        ) : null}
        {message.status !== "IGNORED" ? (
          <form action={ignoreMessageAction}>
            <input type="hidden" name="id" value={message.id} />
            <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
              تجاهل
            </button>
          </form>
        ) : null}
        <form action={deleteMessageAction}>
          <input type="hidden" name="id" value={message.id} />
          <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs !text-rose-300">
            حذف
          </button>
        </form>
      </div>

      {open ? (
        <form action={confirmMessageAction} className="mt-4 grid gap-3 rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={message.id} />
          <div>
            <label className="field-label">البطاقة</label>
            <select name="cardId" defaultValue={message.cardId ?? cards[0]?.id} className="field" required>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} — {maskedCard(card.last4)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">المبلغ</label>
            <input name="amount" defaultValue={parsed?.amount ?? ""} inputMode="decimal" className="field" required />
          </div>
          <div>
            <label className="field-label">النوع</label>
            <select name="type" defaultValue={parsed?.type === "UNKNOWN" ? "PURCHASE" : (parsed?.type ?? "PURCHASE")} className="field">
              {TX_TYPES.filter((t) => t !== "UNKNOWN").map((type) => (
                <option key={type} value={type}>
                  {TX_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">الاتجاه</label>
            <select name="direction" defaultValue={parsed?.direction ?? "OUT"} className="field">
              <option value="OUT">خصم (فلوس خرجت)</option>
              <option value="IN">إضافة (فلوس دخلت)</option>
            </select>
          </div>
          <div>
            <label className="field-label">التاجر</label>
            <input name="merchant" defaultValue={parsed?.merchant ?? ""} className="field" />
          </div>
          <div>
            <label className="field-label">التاريخ</label>
            <input
              name="occurredAt"
              type="datetime-local"
              defaultValue={toLocalInput(parsed?.occurredAt ?? message.receivedAt)}
              className="field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">الفئة</label>
            <select name="categoryId" defaultValue="" className="field">
              <option value="">تلقائي</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              تأكيد وتسجيل
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
