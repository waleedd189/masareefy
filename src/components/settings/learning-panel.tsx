"use client";

import { useEffect, useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { TX_TYPES, TX_TYPE_LABELS } from "@/lib/sms/types";
import { saveWordAction, hideWordAction, deleteWordAction, restoreWordsAction, type WordFormState } from "@/server/actions/words";
import { saveLinkAction, removeLinkAction, type LinkFormState } from "@/server/actions/links";
import { importCsvAction, type ImportState } from "@/server/actions/import";

interface WordRow {
  id: string;
  display: string;
  kind: string;
  origin: string;
  hidden: boolean;
  isProtected: boolean;
  hits: number;
  categoryId: string | null;
}

interface LinkRow {
  id: string;
  senderKey: string;
  last4: string;
  cardId: string;
  cardName: string;
  cardLast4: string;
  categoryId: string | null;
  label: string | null;
  autoFile: boolean;
  approvedCount: number;
}

interface Option {
  id: string;
  label: string;
}

/**
 * التعلّم: كلمات المحلل + روابط المرسلين + استيراد CSV.
 * مقابل `words` / `source_links` / `import-expenses` في Mezanetak.
 */
export function LearningPanel({
  words,
  links,
  categories,
  cards,
}: {
  words: WordRow[];
  links: LinkRow[];
  categories: Option[];
  cards: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [wordState, wordAction, wordPending] = useActionState<WordFormState, FormData>(saveWordAction, { ok: false });
  const [restoreState, restoreAction, restorePending] = useActionState<WordFormState, FormData>(restoreWordsAction, { ok: false });
  const [linkState, linkAction, linkPending] = useActionState<LinkFormState, FormData>(saveLinkAction, { ok: false });
  const [importState, importAction, importPending] = useActionState<ImportState, FormData>(importCsvAction, { ok: false });
  const [fileName, setFileName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wordState.ok || restoreState.ok || linkState.ok || importState.ok) router.refresh();
  }, [wordState.ok, restoreState.ok, linkState.ok, importState.ok, router]);

  const categoryOf = (id: string | null) => categories.find((c) => c.id === id)?.label ?? null;

  return (
    <div className="space-y-8">
      {/* ── كلمات المحلل ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">🧠 كلمات المحلل</h3>
            <p className="text-[11px] text-ink-500">
              كل كلمة بتساعد المحلل يحدد نوع العملية وفئتها. الكلمات المبنية جوه المحلل + اللي انت بتعلّمها.
            </p>
          </div>
          <form action={restoreAction}>
            <button type="submit" disabled={restorePending} className="btn-ghost !px-3 !py-1.5 !text-xs">
              {restorePending ? "…" : "↩️ رجّع المخفي"}
            </button>
          </form>
        </div>

        <form action={wordAction} className="grid gap-2 sm:grid-cols-4">
          <input name="word" required minLength={2} placeholder="كلمة (مثال: بنزين / نتفلكس / سحبت)" className="field sm:col-span-2" />
          <select name="kind" className="field" defaultValue="PURCHASE">
            {TX_TYPES.map((type) => (
              <option key={type} value={type}>
                {TX_TYPE_LABELS[type]}
              </option>
            ))}
            <option value="IGNORE">تجاهل (إعلانية/كود)</option>
          </select>
          <select name="categoryId" className="field" defaultValue="">
            <option value="">بدون فئة</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 sm:col-span-4">
            <button type="submit" disabled={wordPending} className="btn-primary !px-3 !py-1.5 !text-xs">
              {wordPending ? "بحفظ…" : "علّم المحلل الكلمة"}
            </button>
            {wordState.message ? (
              <span className={`text-xs ${wordState.ok ? "text-emerald-300" : "text-rose-300"}`}>{wordState.message}</span>
            ) : null}
            {restoreState.message ? <span className="text-xs text-ink-400">{restoreState.message}</span> : null}
          </div>
        </form>

        {words.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {words.map((word) => (
              <li
                key={word.id}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                  word.hidden ? "border-ink-800 bg-ink-900/40 text-ink-600 line-through" : "border-ink-700 bg-ink-950/50 text-ink-200"
                }`}
              >
                <span className="font-semibold">{word.display}</span>
                <span className="text-[10px] text-ink-500">
                  {TX_TYPE_LABELS[word.kind as keyof typeof TX_TYPE_LABELS] ?? word.kind}
                  {categoryOf(word.categoryId) ? ` · ${categoryOf(word.categoryId)}` : ""}
                </span>
                {word.origin === "USER" ? <Badge className="border-brand-500/30 bg-brand-500/10 text-brand-200">متعلَّمة</Badge> : null}
                {word.hits > 0 ? <span className="text-[10px] text-emerald-300/80">{word.hits}×</span> : null}
                <form action={hideWordAction}>
                  <input type="hidden" name="id" value={word.id} />
                  <button type="submit" className="text-[10px] font-semibold text-ink-500 hover:text-ink-200" title={word.hidden ? "مخفية" : "إخفاء"}>
                    {word.hidden ? "…" : "إخفاء"}
                  </button>
                </form>
                {word.origin === "USER" ? (
                  <form action={deleteWordAction}>
                    <input type="hidden" name="id" value={word.id} />
                    <button type="submit" className="text-[10px] font-semibold text-rose-300/80 hover:text-rose-300">
                      حذف
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-400">لسه مفيش كلمات متعلَّمة — علّم المحلل من صفحة الرسائل أو من هنا.</p>
        )}
      </section>

      {/* ── روابط المرسلين ── */}
      <section className="space-y-3 border-t border-ink-700/50 pt-5">
        <div>
          <h3 className="text-sm font-bold">🔗 روابط المرسلين</h3>
          <p className="text-[11px] text-ink-500">
            اربط اسم المرسل (وآخر 4 أرقام اختياريًا) بحساب وفئة ثابتة — كل موافقة بتزوّد قوة الربط.
          </p>
        </div>

        <form action={linkAction} className="grid gap-2 sm:grid-cols-6">
          <input name="sender" placeholder="اسم المرسل (مثال: VodafoneCash)" className="field sm:col-span-2" />
          <input name="last4" placeholder="آخر 4 أرقام" maxLength={4} className="field sm:col-span-1" dir="ltr" />
          <select name="cardId" className="field sm:col-span-2" defaultValue="">
            <option value="">اختر الحساب…</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.label}
              </option>
            ))}
          </select>
          <select name="categoryId" className="field sm:col-span-1" defaultValue="">
            <option value="">بدون فئة</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 sm:col-span-6">
            <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <input type="checkbox" name="autoFile" defaultChecked className="h-3.5 w-3.5 accent-emerald-500" />
              تصنيف آلي
            </label>
            <button type="submit" disabled={linkPending} className="btn-primary !px-3 !py-1.5 !text-xs">
              {linkPending ? "بحفظ…" : "حفظ الربط"}
            </button>
            {linkState.message ? (
              <span className={`text-xs ${linkState.ok ? "text-emerald-300" : "text-rose-300"}`}>{linkState.message}</span>
            ) : null}
          </div>
        </form>

        {links.length ? (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-700/60 bg-ink-950/50 px-3 py-2">
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-ink-100">
                    {link.label ?? link.senderKey} {link.last4 ? <span className="text-ink-500">••{link.last4}</span> : null}
                  </p>
                  <p className="text-[11px] text-ink-500">
                    → {link.cardName} ••{link.cardLast4}
                    {categoryOf(link.categoryId) ? ` · ${categoryOf(link.categoryId)}` : ""}
                    {link.autoFile ? " · تصنيف آلي" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">{link.approvedCount} موافقة</Badge>
                  <form action={removeLinkAction}>
                    <input type="hidden" name="id" value={link.id} />
                    <button type="submit" className="text-[11px] font-semibold text-rose-300">
                      إلغاء الربط
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-400">مفيش روابط لسه — كل ما تؤكد رسالة هيتعمل رابط تلقائيًا (لو التعلّم مفعّل).</p>
        )}
      </section>

      {/* ── استيراد CSV ── */}
      <section className="space-y-3 border-t border-ink-700/50 pt-5">
        <div>
          <h3 className="text-sm font-bold">📥 استيراد عمليات من CSV</h3>
          <p className="text-[11px] leading-relaxed text-ink-500">
            العناوين المدعومة (عربي أو إنجليزي): <code dir="ltr">date, amount, merchant, type, card, category, currency, note</code> —
            الصفوف المكررة (نفس التاريخ+المبلغ+التاجر+الحساب) بتتخطّى.
          </p>
        </div>
        <form action={importAction} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="field-label">ملف CSV</span>
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="field !py-1.5 !text-xs file:me-2 file:rounded-lg file:border-0 file:bg-ink-800 file:px-2 file:py-1 file:text-[11px] file:text-ink-200"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">أو الصق النص</span>
            <input name="text" placeholder="date,amount,merchant" className="field !w-64 !py-1.5 !text-xs" dir="ltr" />
          </label>
          <button type="submit" disabled={importPending} className="btn-primary !px-3 !py-2 !text-xs">
            {importPending ? "باستورد…" : "استيراد"}
          </button>
          {importState.message ? (
            <span className={`text-xs ${importState.ok ? "text-emerald-300" : "text-rose-300"}`}>
              {importState.message}
              {fileName ? ` (${fileName})` : ""}
            </span>
          ) : null}
        </form>
      </section>
    </div>
  );
}
