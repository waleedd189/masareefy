"use client";

import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/format";
import { TX_TYPE_LABELS, type TxType } from "@/lib/sms/types";
import { previewMessageAction } from "@/server/actions/messages";

type Preview = Awaited<ReturnType<typeof previewMessageAction>>;

export function ParserTester() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Preview>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <textarea
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="الصق رسالة بنك هنا لاختبار التحليل…"
        className="field min-h-[110px]"
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={pending || !text.trim()}
        onClick={() => start(async () => setResult(await previewMessageAction(text)))}
      >
        {pending ? "جارٍ التحليل…" : "جرّب التحليل"}
      </button>

      {result ? (
        <div className="rounded-2xl border border-ink-700/60 bg-ink-950/60 p-3 text-xs">
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <Line label="البنك" value={result.bankName ?? "غير معروف"} />
            <Line label="النوع" value={TX_TYPE_LABELS[result.type as TxType]} />
            <Line label="المبلغ" value={result.amount !== null ? formatMoney(result.amount, result.currency ?? "EGP") : "—"} />
            <Line label="آخر 4 أرقام" value={result.last4 ?? "—"} />
            <Line label="التاجر" value={result.merchant ?? "—"} />
            <Line
              label="الرصيد المتاح"
              value={result.availableBalance !== null ? formatMoney(result.availableBalance, result.currency ?? "EGP") : "—"}
            />
            <Line label="الثقة" value={`${Math.round(result.confidence * 100)}%`} />
            <Line label="رسالة مالية؟" value={result.isFinancial ? "نعم" : "لا"} />
          </div>
          {result.warnings.length ? <p className="mt-2 text-[11px] text-amber-300">⚠️ {result.warnings.join(" · ")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-2 border-b border-ink-700/40 pb-1">
      <span className="text-ink-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </p>
  );
}
