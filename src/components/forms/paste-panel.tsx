"use client";

import { useActionState, useState, useTransition } from "react";
import type { Card } from "@/db/schema";
import { formatMoney, maskedCard } from "@/lib/format";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import { pasteMessagesAction, previewMessageAction, type PasteState } from "@/server/actions/messages";

const initial: PasteState = { ok: false };

type Preview = Awaited<ReturnType<typeof previewMessageAction>>;

export function PastePanel({ cards }: { cards: Card[] }) {
  const [state, formAction, pending] = useActionState(pasteMessagesAction, initial);
  const [text, setText] = useState("");
  const [sender, setSender] = useState("");
  const [preview, setPreview] = useState<Preview>(null);
  const [previewing, startPreview] = useTransition();

  const runPreview = () => {
    startPreview(async () => {
      const result = await previewMessageAction(text, sender);
      setPreview(result);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <form action={formAction} className="surface space-y-3 p-4 sm:p-5 lg:col-span-3">
        <div>
          <label className="field-label" htmlFor="text">
            نص رسالة البنك (تقدر تلصق أكتر من رسالة، سيب سطر فاضي بينهم)
          </label>
          <textarea
            id="text"
            name="text"
            rows={7}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"مثال:\nتم خصم مبلغ 320.75 ج.م من بطاقتك المنتهية بـ 4321 لدى طلبات مصر بتاريخ 03/10/2026. الرصيد المتاح 18,079.75 ج.م"}
            className="field min-h-[160px] leading-relaxed"
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="sender">
              المرسل (اختياري)
            </label>
            <input
              id="sender"
              name="sender"
              value={sender}
              onChange={(event) => setSender(event.target.value)}
              placeholder="CIB"
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="cardId">
              اربطها ببطاقة معينة (اختياري)
            </label>
            <select id="cardId" name="cardId" defaultValue="" className="field">
              <option value="">تلقائي من آخر 4 أرقام</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} — {maskedCard(card.last4)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "جارٍ التحليل…" : "حلّل واحفظ"}
          </button>
          <button type="button" onClick={runPreview} className="btn-ghost" disabled={previewing || !text.trim()}>
            {previewing ? "…" : "معاينة بدون حفظ"}
          </button>
          {state.message ? (
            <span className={`text-xs font-semibold ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</span>
          ) : null}
        </div>
      </form>

      <div className="surface p-4 sm:p-5 lg:col-span-2">
        <h3 className="text-sm font-bold">نتيجة التحليل</h3>
        <p className="mt-0.5 text-[11px] text-ink-400">شوف هيتقرا إيه قبل ما تحفظ</p>

        {!preview ? (
          <p className="py-10 text-center text-xs text-ink-400">اضغط «معاينة بدون حفظ» بعد لصق الرسالة</p>
        ) : (
          <dl className="mt-4 space-y-2 text-xs">
            <Row label="البنك" value={preview.bankName ?? "غير معروف"} />
            <Row label="نوع العملية" value={TX_TYPE_LABELS[preview.type as TxType]} />
            <Row
              label="المبلغ"
              value={preview.amount !== null ? formatMoney(preview.amount, preview.currency ?? "EGP") : "—"}
              strong
            />
            <Row label="البطاقة" value={preview.last4 ? maskedCard(preview.last4) : "غير محدد"} />
            <Row label="التاجر" value={preview.merchant ?? "—"} />
            <Row
              label="الرصيد المتاح"
              value={preview.availableBalance !== null ? formatMoney(preview.availableBalance, preview.currency ?? "EGP") : "—"}
            />
            <Row
              label="التاريخ"
              value={preview.occurredAt ? new Date(preview.occurredAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            />
            <Row label="درجة الثقة" value={`${Math.round(preview.confidence * 100)}%`} />
            {preview.warnings.length ? (
              <li className="list-none rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                {preview.warnings.join(" · ")}
              </li>
            ) : null}
          </dl>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ink-700/40 pb-1.5">
      <dt className="text-ink-400">{label}</dt>
      <dd className={strong ? "font-extrabold text-brand-300" : "font-semibold"}>{value}</dd>
    </div>
  );
}
