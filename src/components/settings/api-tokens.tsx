"use client";

import { useActionState } from "react";
import { useState } from "react";
import { CopyField } from "@/components/copy-field";
import { formatDate } from "@/lib/format";
import { createTokenAction, deleteTokenAction } from "@/server/actions/settings";

interface TokenRow {
  id: string;
  name: string;
  token: string;
  lastUsedAt: string | null;
}

/**
 * مفاتيح الـAPI: بنخزّن البصمة بس، وبنعرض المفتاح **مرة واحدة** عند الإنشاء
 * (مقابل `KeystoreFieldCipher` في Mezanetak — الحقول الحساسة مش بتتخزن صريحة).
 */
export function ApiTokens({ tokens }: { tokens: TokenRow[] }) {
  const [state, formAction, pending] = useActionState(createTokenAction, { ok: false });
  const [revealed, setRevealed] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">مفاتيح الـ API</h3>
        <form action={formAction} className="flex items-center gap-2">
          <input name="name" placeholder="اسم الجهاز" className="field !w-40 !py-1.5 !text-xs" />
          <button type="submit" disabled={pending} className="btn-primary !px-3 !py-1.5 !text-xs">
            {pending ? "…" : "＋ مفتاح جديد"}
          </button>
        </form>
      </div>

      {state.token && revealed !== state.token ? (
        <div className="mb-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3">
          <p className="mb-2 text-[11px] font-semibold text-emerald-200">{state.message}</p>
          <div dir="ltr">
            <CopyField value={state.token} />
          </div>
          <button type="button" onClick={() => setRevealed(state.token!)} className="mt-2 text-[11px] font-semibold text-ink-300">
            نسخته — إخفاء
          </button>
        </div>
      ) : null}

      {tokens.length ? (
        <ul className="space-y-2">
          {tokens.map((token) => (
            <li key={token.id} className="rounded-2xl border border-ink-700/60 bg-ink-950/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold">{token.name}</span>
                <span className="text-ink-500">
                  {token.lastUsedAt ? `آخر استخدام: ${formatDate(new Date(token.lastUsedAt))}` : "لسه مستخدمش"}
                </span>
              </div>
              <div dir="ltr" className="font-mono text-[11px] text-ink-300">
                {token.token}
                <span className="ms-2 rounded-full bg-ink-800 px-2 py-0.5 text-[10px] text-ink-400">مخزّن كبصمة</span>
              </div>
              <form action={deleteTokenAction} className="mt-2">
                <input type="hidden" name="id" value={token.id} />
                <button type="submit" className="text-[11px] font-semibold text-rose-300">
                  حذف المفتاح
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-400">مفيش مفاتيح لسه — اعمل مفتاح عشان تربط تطبيق الموبايل.</p>
      )}
    </div>
  );
}
