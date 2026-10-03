"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BANK_OPTIONS } from "@/lib/sms/banks";
import { parseSms } from "@/lib/sms/parse";
import { TX_TYPES, TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import {
  getSnapshot,
  listOperations,
  queueOperation,
  removeOperations,
  saveSnapshot,
  type OfflineOperation,
} from "@/lib/offline-store";

type OfflineCard = {
  id: string;
  name: string;
  last4: string;
  bankKey: string;
  type: "CREDIT" | "DEBIT" | "PREPAID";
  currency: string;
};

type SyncResponse = { results: { id: string; ok: boolean; error?: string }[] };

const kindLabel = { card: "بطاقة", transaction: "عملية", message: "رسالة بنك" } as const;

function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function askForBackgroundSync() {
  const registration = await navigator.serviceWorker?.ready;
  const sync = (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync;
  await sync?.register("masareefy-outbox").catch(() => undefined);
}

export function OfflineCenter() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<OfflineOperation[]>([]);
  const [cards, setCards] = useState<OfflineCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [messagePreview, setMessagePreview] = useState<ReturnType<typeof parseSms> | null>(null);

  const refreshLocal = useCallback(async () => {
    const [operations, cachedCards] = await Promise.all([
      listOperations(),
      getSnapshot<OfflineCard[]>("cards"),
    ]);
    setPending(operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    if (cachedCards) setCards(cachedCards);
  }, []);

  const refreshServerData = useCallback(async () => {
    const response = await fetch("/api/offline", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تنزيل البيانات");
    const data = (await response.json()) as { cards: OfflineCard[] };
    const queuedCards = (await listOperations())
      .filter((item) => item.kind === "card")
      .map((item) => item.payload as unknown as OfflineCard);
    const merged = [...data.cards];
    for (const card of queuedCards) if (!merged.some((item) => item.id === card.id)) merged.push(card);
    setCards(merged);
    await saveSnapshot("cards", merged);
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const operations = await listOperations();
    if (!operations.length) {
      await refreshServerData().catch(() => undefined);
      return;
    }

    setBusy(true);
    setNotice("جاري مزامنة البيانات…");
    try {
      const response = await fetch("/api/offline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operations }),
      });
      if (!response.ok) throw new Error("فشلت المزامنة");
      const data = (await response.json()) as SyncResponse;
      const completed = data.results.filter((item) => item.ok).map((item) => item.id);
      await removeOperations(completed);
      await refreshLocal();
      await refreshServerData();
      const failed = data.results.length - completed.length;
      setNotice(failed ? `تمت مزامنة ${completed.length}، وتعذر رفع ${failed}.` : "تمت مزامنة كل البيانات ✅");
    } catch {
      setNotice("البيانات محفوظة على الجهاز وهتتزامن تلقائيًا عند رجوع الاتصال.");
      await askForBackgroundSync();
    } finally {
      setBusy(false);
    }
  }, [refreshLocal, refreshServerData]);

  useEffect(() => {
    queueMicrotask(() => {
      setOnline(navigator.onLine);
      void refreshLocal();
      if (navigator.onLine) void sync();
    });

    const wentOnline = () => {
      setOnline(true);
      void sync();
    };
    const wentOffline = () => setOnline(false);
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "OUTBOX_SYNCED") void refreshLocal();
    };
    window.addEventListener("online", wentOnline);
    window.addEventListener("offline", wentOffline);
    navigator.serviceWorker?.addEventListener("message", workerMessage);
    return () => {
      window.removeEventListener("online", wentOnline);
      window.removeEventListener("offline", wentOffline);
      navigator.serviceWorker?.removeEventListener("message", workerMessage);
    };
  }, [refreshLocal, sync]);

  const enqueue = async (operation: OfflineOperation) => {
    await queueOperation(operation);
    await refreshLocal();
    setNotice(online ? "اتحفظت على الجهاز وجاري المزامنة…" : "اتحفظت على الجهاز وهتترفع لما الإنترنت يرجع ✅");
    await askForBackgroundSync();
    if (online) await sync();
  };

  const pendingCounts = useMemo(
    () => ({
      card: pending.filter((item) => item.kind === "card").length,
      transaction: pending.filter((item) => item.kind === "transaction").length,
      message: pending.filter((item) => item.kind === "message").length,
    }),
    [pending],
  );

  const addCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const card: OfflineCard & { openingBalance: number } = {
      id: crypto.randomUUID(),
      name: String(data.get("name") ?? "").trim(),
      last4: String(data.get("last4") ?? "").trim(),
      bankKey: String(data.get("bankKey") ?? "generic"),
      type: String(data.get("type") ?? "CREDIT") as OfflineCard["type"],
      currency: "EGP",
      openingBalance: Number(data.get("openingBalance")) || 0,
    };
    if (card.name.length < 2 || !/^\d{4}$/.test(card.last4)) {
      setNotice("اكتب اسم البطاقة وآخر 4 أرقام بشكل صحيح.");
      return;
    }
    const updated = [...cards, card];
    setCards(updated);
    await saveSnapshot("cards", updated);
    form.reset();
    await enqueue({ id: crypto.randomUUID(), kind: "card", createdAt: new Date().toISOString(), payload: card });
  };

  const addTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(String(data.get("amount") ?? "").replace(/,/g, ""));
    const cardId = String(data.get("cardId") ?? "");
    if (!cardId || !Number.isFinite(amount) || amount <= 0) {
      setNotice("اختر البطاقة واكتب مبلغًا صحيحًا.");
      return;
    }
    const payload = {
      id: crypto.randomUUID(),
      cardId,
      amount,
      type: String(data.get("type") ?? "PURCHASE"),
      merchant: String(data.get("merchant") ?? "").trim() || null,
      note: String(data.get("note") ?? "").trim() || null,
      occurredAt: new Date(String(data.get("occurredAt") ?? new Date().toISOString())).toISOString(),
    };
    form.reset();
    await enqueue({ id: crypto.randomUUID(), kind: "transaction", createdAt: new Date().toISOString(), payload });
  };

  const addMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get("text") ?? "").trim();
    const sender = String(data.get("sender") ?? "").trim() || null;
    if (text.length < 5) {
      setNotice("الصق نص رسالة البنك الأول.");
      return;
    }
    const preview = parseSms(text, { sender, receivedAt: new Date() });
    setMessagePreview(preview);
    const payload = {
      text,
      sender,
      cardId: String(data.get("cardId") ?? "") || null,
      receivedAt: new Date().toISOString(),
    };
    form.reset();
    await enqueue({ id: crypto.randomUUID(), kind: "message", createdAt: new Date().toISOString(), payload });
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border p-4 ${online ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold">{online ? "● متصل بالإنترنت" : "● وضع أوفلاين"}</p>
            <p className="mt-1 text-xs text-ink-300">
              {pending.length ? `${pending.length} عنصر محفوظ على الجهاز في انتظار المزامنة.` : "كل البيانات متزامنة."}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => void sync()} disabled={!online || busy}>
            {busy ? "جاري المزامنة…" : "↻ مزامنة الآن"}
          </button>
        </div>
        {notice ? <p className="mt-3 text-xs font-semibold text-ink-50" role="status">{notice}</p> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <form onSubmit={addMessage} className="surface space-y-3 p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">📨 رسالة بنك</h2><Badge count={pendingCounts.message} /></div>
          <textarea name="text" rows={6} className="field" placeholder="الصق رسالة البنك هنا…" required />
          <div className="grid grid-cols-2 gap-2">
            <input name="sender" className="field" placeholder="المرسل (اختياري)" />
            <select name="cardId" className="field" defaultValue="">
              <option value="">البطاقة تلقائيًا</option>
              {cards.map((card) => <option key={card.id} value={card.id}>{card.name} •••• {card.last4}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" type="submit">تحليل وحفظ محلي</button>
          {messagePreview ? (
            <p className="rounded-xl bg-ink-950/60 p-3 text-xs text-ink-300">
              آخر تحليل: {messagePreview.amount ?? "مبلغ غير معروف"} {messagePreview.currency ?? ""} · {TX_TYPE_LABELS[messagePreview.type]}
            </p>
          ) : null}
        </form>

        <form onSubmit={addTransaction} className="surface space-y-3 p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">🧾 عملية يدوية</h2><Badge count={pendingCounts.transaction} /></div>
          <select name="cardId" className="field" defaultValue="" required>
            <option value="" disabled>اختر البطاقة</option>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.name} •••• {card.last4}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="amount" inputMode="decimal" className="field" placeholder="المبلغ" required />
            <select name="type" className="field" defaultValue="PURCHASE">
              {TX_TYPES.filter((type) => type !== "UNKNOWN").map((type) => <option key={type} value={type}>{TX_TYPE_LABELS[type as TxType]}</option>)}
            </select>
          </div>
          <input name="merchant" className="field" placeholder="التاجر / البيان" />
          <input name="occurredAt" type="datetime-local" className="field" defaultValue={localDateTimeValue()} />
          <input name="note" className="field" placeholder="ملاحظة اختيارية" />
          <button className="btn-primary w-full" type="submit" disabled={!cards.length}>حفظ العملية محليًا</button>
          {!cards.length ? <p className="text-xs text-amber-300">أضف بطاقة أولًا من النموذج التالي.</p> : null}
        </form>

        <form onSubmit={addCard} className="surface space-y-3 p-4">
          <div className="flex items-center justify-between"><h2 className="font-bold">💳 بطاقة جديدة</h2><Badge count={pendingCounts.card} /></div>
          <input name="name" className="field" placeholder="اسم البطاقة" required />
          <input name="last4" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" className="field" placeholder="آخر 4 أرقام" required />
          <select name="bankKey" className="field" defaultValue="cib">
            {BANK_OPTIONS.map((bank) => <option key={bank.value} value={bank.value}>{bank.label}</option>)}
          </select>
          <select name="type" className="field" defaultValue="CREDIT">
            <option value="CREDIT">ائتمانية</option><option value="DEBIT">خصم مباشر</option><option value="PREPAID">مسبقة الدفع</option>
          </select>
          <input name="openingBalance" inputMode="decimal" className="field" placeholder="الرصيد الافتتاحي (اختياري)" />
          <button className="btn-primary w-full" type="submit">حفظ البطاقة محليًا</button>
        </form>
      </div>

      {pending.length ? (
        <div className="surface p-4">
          <h2 className="text-sm font-bold">المحفوظ على الجهاز</h2>
          <ul className="mt-3 divide-y divide-ink-700/50 text-xs">
            {pending.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span>{kindLabel[item.kind]}</span>
                <time className="text-ink-400">{new Date(item.createdAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}</time>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ count }: { count: number }) {
  return count ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">{count} معلّق</span> : null;
}
