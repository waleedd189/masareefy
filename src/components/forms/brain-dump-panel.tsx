"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import { previewBrainDumpAction, saveBrainDumpAction } from "@/server/actions/braindump";
import type { BrainDumpCategory } from "@/lib/services/braindump";

interface Draft {
  raw: string;
  amount: number | null;
  currency: string | null;
  merchant: string | null;
  type: TxType;
  categoryId: string | null;
  matchedWord: string | null;
  occurredAtIso: string | null;
  /** اختيار المستخدم في الواجهة (بيتشال قبل الإرسال للسيرفر) */
  keep?: boolean;
}

interface CardOption {
  id: string;
  name: string;
  last4: string;
}

/**
 * التفريغ السريع: تكتب اليوم كله بالعامية وإحنا نقسّمه لعمليات.
 * بيستقبل كمان النص المشارك من أي تطبيق (Web Share Target → `?text=`).
 */
export function BrainDumpPanel({
  categories,
  cards,
  initialText = "",
}: {
  categories: BrainDumpCategory[];
  cards: CardOption[];
  initialText?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const totals = useMemo(() => {
    const selected = drafts.filter((d) => d.keep !== false);
    const sum = selected.reduce((acc, d) => acc + (d.amount ?? 0), 0);
    return { count: selected.length, sum };
  }, [drafts]);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const result = await previewBrainDumpAction(text, categories);
      setDrafts(result.map((d) => ({ ...d, keep: true })));
      if (!result.length) {
        setNote("مقدرناش نستخرج مبالغ من النص — جرّب تكتب المبلغ بالأرقام (مثال: قهوة 45 جنيه).");
      }
    } catch {
      setNote("حصل خطأ في التحليل، جرّب تاني");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = drafts.filter((d) => d.keep !== false && d.amount && d.amount > 0).map(stripKeep);
    if (!payload.length) {
      setNote("مفيش بنود صالحة للحفظ — تأكد إن فيه مبلغ في كل بند");
      return;
    }
    setSaving(true);
    setNote(null);
    try {
      const formData = new FormData();
      formData.set("cardId", cardId);
      formData.set("drafts", JSON.stringify(payload));
      const result = await saveBrainDumpAction({ ok: false }, formData);
      setNote(result.message ?? null);
      if (result.ok) {
        setText("");
        setDrafts([]);
        router.refresh();
      }
    } catch {
      setNote("حصل خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handlePreview} className="space-y-3">
        <div>
          <label className="field-label" htmlFor="dump">
            اكتب يومك زي ما انت عايز
          </label>
          <textarea
            id="dump"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            dir="auto"
            placeholder={"قهوة 45 وبعدين تاكسي 30، وخروجة العيلة 450\nسحبت 500 من ATM\nمرتبي نزل 12000"}
            className="field resize-y font-medium leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="field !w-auto !py-1.5 !text-xs">
            <option value="">بدون ربط حساب</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name} ••{card.last4}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary !px-4 !py-1.5 !text-xs">
            {busy ? "بحلل…" : "⚡ قسّمها"}
          </button>
          {drafts.length ? (
            <button type="button" onClick={() => setDrafts([])} className="btn-ghost !px-3 !py-1.5 !text-xs">
              إلغاء
            </button>
          ) : null}
        </div>
      </form>

      {note ? <p className="text-xs text-amber-300">⚠️ {note}</p> : null}

      {drafts.length ? (
        <form onSubmit={handleSave} className="space-y-3">
          <ul className="space-y-2">
            {drafts.map((draft, index) => (
              <li key={`${index}-${draft.raw}`} className={`surface p-3 transition ${draft.keep === false ? "opacity-40" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ink-300" dir="auto">
                      {draft.raw}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Badge className="border-brand-500/30 bg-brand-500/10 text-brand-300">
                        {draft.amount ? formatMoney(draft.amount, draft.currency ?? "EGP") : "مبلغ غير واضح"}
                      </Badge>
                      <select
                        value={draft.type}
                        onChange={(e) => updateDraft(index, { type: e.target.value as TxType })}
                        className="field !w-auto !py-0.5 !text-[11px]"
                      >
                        {TX_TYPES_LOCAL.map((type) => (
                          <option key={type} value={type}>
                            {TX_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      {draft.merchant ? <Badge className="border-ink-700 text-ink-400">{draft.merchant}</Badge> : null}
                      <select
                        value={draft.categoryId ?? ""}
                        onChange={(e) => updateDraft(index, { categoryId: e.target.value || null })}
                        className="field !w-auto !py-0.5 !text-[11px]"
                      >
                        <option value="">بدون فئة</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.name}
                          </option>
                        ))}
                      </select>
                      {draft.matchedWord ? <span className="text-ink-500">كلمة: {draft.matchedWord}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={draft.amount ?? ""}
                      onChange={(e) => updateDraft(index, { amount: Number(e.target.value) || null })}
                      className="field !w-24 !py-1 !text-xs"
                      placeholder="المبلغ"
                    />
                    <button
                      type="button"
                      onClick={() => updateDraft(index, { keep: draft.keep === false })}
                      className={`rounded-xl border px-2 py-1 text-[11px] font-semibold transition ${
                        draft.keep === false ? "border-ink-700 text-ink-400" : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {draft.keep === false ? "استرجاع" : "استبعاد"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-400">
              {totals.count} بند بإجمالي <b className="text-brand-300">{formatMoney(totals.sum)}</b>
            </p>
            <button type="submit" disabled={saving || !totals.count} className="btn-primary !px-4 !py-2 !text-xs">
              {saving ? "بحفظ…" : "💾 حفظ العمليات"}
            </button>
          </div>
        </form>
      ) : (
        <EmptyState
          icon="⚡"
          title="اكتب أي حاجة"
          description="مش لازم تظبط الصيغة — اكتب اليوم بالعربي العامية وإحنا نستخرج المبالغ والفئات."
        />
      )}
    </div>
  );
}

const TX_TYPES_LOCAL: TxType[] = ["PURCHASE", "WITHDRAWAL", "PAYMENT", "DEPOSIT", "REFUND", "FEE", "TRANSFER_IN", "TRANSFER_OUT"];

/** يشيل حقل الواجهة المؤقت قبل إرسال المسودة للسيرفر */
function stripKeep(draft: Draft) {
  const { keep, ...rest } = draft;
  void keep;
  return rest;
}
