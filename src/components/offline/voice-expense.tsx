"use client";

import { useRef, useState } from "react";
import { TX_TYPES, TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import { parseVoiceExpense, type VoiceCard, type VoiceExpenseDraft } from "@/lib/voice-expense";

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechErrorEvent = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceTransaction = {
  id: string;
  cardId: string;
  amount: number;
  type: string;
  merchant: string | null;
  note: string;
  occurredAt: string;
};

const emptyDraft: VoiceExpenseDraft = {
  transcript: "",
  amount: null,
  cardId: "",
  type: "PURCHASE",
  merchant: "",
};

export function VoiceExpense({
  cards,
  onSave,
}: {
  cards: VoiceCard[];
  onSave: (transaction: VoiceTransaction) => Promise<void>;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [draft, setDraft] = useState<VoiceExpenseDraft>(emptyDraft);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const analyze = (transcript: string) => {
    setDraft(parseVoiceExpense(transcript, cards));
    setMessage("");
  };

  const startListening = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setMessage("المتصفح ده مش بيدعم التعرف على الصوت. جرّب Chrome على Android أو اكتب الجملة يدويًا.");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new Constructor();
    recognition.lang = "ar-EG";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += `${event.results[index][0]?.transcript ?? ""} `;
      }
      analyze(transcript.trim());
    };
    recognition.onerror = (event) => {
      const errors: Record<string, string> = {
        "not-allowed": "اسمح للتطبيق باستخدام الميكروفون من إعدادات المتصفح.",
        "audio-capture": "مش قادر أوصل للميكروفون.",
        "no-speech": "مسمعتش كلام واضح. جرّب مرة تانية.",
        network: "خدمة التعرف على الصوت محتاجة إنترنت على الجهاز ده.",
      };
      setMessage(errors[event.error] ?? "تعذر التعرف على الصوت. جرّب مرة تانية.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
      setMessage("اتكلم دلوقتي… مثال: دفعت ٢٥٠ جنيه في كارفور على فيزا CIB");
    } catch {
      setMessage("الميكروفون مشغول. استنى لحظة وجرّب تاني.");
      setListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const save = async () => {
    if (!draft.cardId) {
      setMessage("حدد البطاقة قبل الحفظ.");
      return;
    }
    if (draft.amount === null || !Number.isFinite(draft.amount) || draft.amount <= 0) {
      setMessage("راجع المبلغ قبل الحفظ.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: crypto.randomUUID(),
        cardId: draft.cardId,
        amount: draft.amount,
        type: draft.type,
        merchant: draft.merchant || null,
        note: `إدخال صوتي: ${draft.transcript}`,
        occurredAt: new Date().toISOString(),
      });
      setDraft(emptyDraft);
      setMessage("تم حفظ المصروف الصوتي ✅");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="voice-expense" className="surface scroll-mt-4 overflow-hidden border-brand-500/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">🎙️ إضافة مصروف بالصوت</h2>
          <p className="mt-1 text-xs text-ink-400">قول المبلغ والتاجر والبطاقة، وراجع النتيجة قبل الحفظ.</p>
        </div>
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          className={`grid h-14 w-14 place-items-center rounded-full text-2xl shadow-lg transition ${
            listening
              ? "animate-pulse bg-rose-500 text-white shadow-rose-500/30"
              : "bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950 shadow-brand-500/30"
          }`}
          aria-label={listening ? "إيقاف الاستماع" : "بدء التسجيل الصوتي"}
        >
          {listening ? "■" : "🎙️"}
        </button>
      </div>

      <div className="mt-4">
        <label className="field-label" htmlFor="voice-transcript">الكلام اللي اتسمع</label>
        <textarea
          id="voice-transcript"
          rows={2}
          className="field"
          value={draft.transcript}
          onChange={(event) => analyze(event.target.value)}
          placeholder="مثال: دفعت ٢٥٠ جنيه في كارفور على فيزا CIB"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="field-label" htmlFor="voice-amount">المبلغ</label>
          <input
            id="voice-amount"
            inputMode="decimal"
            className="field"
            value={draft.amount ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) || null }))}
            placeholder="250"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="voice-card">البطاقة</label>
          <select
            id="voice-card"
            className="field"
            value={draft.cardId}
            onChange={(event) => setDraft((current) => ({ ...current, cardId: event.target.value }))}
          >
            <option value="">اختر البطاقة</option>
            {cards.map((card) => <option key={card.id} value={card.id}>{card.name} •••• {card.last4}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="voice-type">النوع</label>
          <select
            id="voice-type"
            className="field"
            value={draft.type}
            onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value as TxType }))}
          >
            {TX_TYPES.filter((type) => type !== "UNKNOWN").map((type) => <option key={type} value={type}>{TX_TYPE_LABELS[type]}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="voice-merchant">التاجر</label>
          <input
            id="voice-merchant"
            className="field"
            value={draft.merchant}
            onChange={(event) => setDraft((current) => ({ ...current, merchant: event.target.value }))}
            placeholder="كارفور"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving || !cards.length}>
          {saving ? "جاري الحفظ…" : "حفظ المصروف"}
        </button>
        {message ? <p className="text-xs font-semibold text-ink-300" role="status">{message}</p> : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">
        حسب نوع الهاتف، المتصفح قد يستخدم خدمة صوت خارجية ويحتاج إنترنت. النص الناتج فقط هو اللي بيتحفظ في مصاريفي.
      </p>
    </section>
  );
}
