"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  applyRestoreAction,
  previewRestoreAction,
  type RestoreState,
} from "@/server/actions/restore";

/**
 * استيراد نسخة احتياطية.
 *
 * بخطوتين زي استيراد الكشوف: **افحص** (معاينة الأعداد من غير أي كتابة) ثم **استيراد**.
 * وضع «الدمج» آمن (بيضيف الناقص بس)، و«الاستبدال الكامل» مدمّر فمحتاج تأكيد صريح.
 */
export function RestorePanel() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [state, setState] = useState<RestoreState>({ ok: false });
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmed, setConfirmed] = useState(false);
  const [fileName, setFileName] = useState("");

  function collectForm(): FormData | null {
    const form = formRef.current;
    if (!form) return null;
    const formData = new FormData(form);
    formData.set("mode", mode);
    if (mode === "replace" && confirmed) formData.set("confirmReplace", "yes");
    return formData;
  }

  async function handlePreview() {
    const formData = collectForm();
    if (!formData) return;
    setBusy("preview");
    try {
      setState(await previewRestoreAction({ ok: false }, formData));
    } catch {
      setState({ ok: false, message: "حصل خطأ أثناء قراءة الملف" });
    } finally {
      setBusy(null);
    }
  }

  async function handleApply() {
    const formData = collectForm();
    if (!formData) return;
    if (mode === "replace" && !confirmed) {
      setState({ ok: false, message: "علّم على صندوق التأكيد الأول — الاستبدال هيحذف كل البيانات الحالية" });
      return;
    }
    setBusy("apply");
    try {
      const result = await applyRestoreAction({ ok: false }, formData);
      setState(result);
      if (result.ok) {
        setConfirmed(false);
        router.refresh();
      }
    } catch {
      setState({ ok: false, message: "حصل خطأ أثناء الاستيراد" });
    } finally {
      setBusy(null);
    }
  }

  const counts = state.counts?.filter((row) => row.inBackup > 0 || row.current > 0) ?? [];

  return (
    <div className="space-y-4">
      <form ref={formRef} className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="field-label">ملف النسخة الاحتياطية (JSON)</span>
            <input
              name="file"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFileName(e.target.files?.[0]?.name ?? "");
                setState({ ok: false });
              }}
              className="field !py-1.5 !text-xs file:me-2 file:rounded-lg file:border-0 file:bg-ink-800 file:px-2 file:py-1 file:text-[11px] file:text-ink-200"
            />
          </label>
          <button type="button" onClick={handlePreview} disabled={busy !== null} className="btn-ghost !px-3 !py-2 !text-xs">
            {busy === "preview" ? "بفحص…" : "🔍 افحص النسخة"}
          </button>
        </div>

        <details className="text-[11px] text-ink-500">
          <summary className="cursor-pointer">أو الصق محتوى النسخة يدويًا</summary>
          <textarea
            name="text"
            rows={4}
            dir="ltr"
            placeholder='{"app":"مصاريفي","version":3,...}'
            className="field mt-2 !font-mono !text-[10px]"
          />
        </details>

        <fieldset className="space-y-2">
          <legend className="field-label">طريقة الاستيراد</legend>
          <div className="flex flex-wrap gap-2">
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-[11px] transition ${
                mode === "merge"
                  ? "border-brand-400/60 bg-brand-500/10 text-brand-200"
                  : "border-ink-700/70 bg-ink-800/40 text-ink-400"
              }`}
            >
              <input
                type="radio"
                name="mode-radio"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
                className="mt-0.5 h-3 w-3 accent-emerald-500"
              />
              <span>
                <b>دمج</b> — بيضيف الصفوف الناقصة بس، والموجود حاليًا ما بيتغيّرش ولا بيتحذف (الآمن)
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-[11px] transition ${
                mode === "replace"
                  ? "border-rose-400/60 bg-rose-500/10 text-rose-200"
                  : "border-ink-700/70 bg-ink-800/40 text-ink-400"
              }`}
            >
              <input
                type="radio"
                name="mode-radio"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="mt-0.5 h-3 w-3 accent-rose-500"
              />
              <span>
                <b>استبدال كامل</b> — بيحذف كل البيانات الحالية ويرجّع النسخة زي ما كانت (مدمّر)
              </span>
            </label>
          </div>
        </fieldset>

        {mode === "replace" ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-rose-500"
            />
            <span>
              فاهم إن كل العمليات والحسابات والرسائل الموجودة دلوقتي هتتحذف، ونزّلت نسخة من الوضع الحالي
              (<a href="/api/export?format=backup" className="underline">تنزيل نسخة دلوقتي</a>) قبل ما أكمل.
            </span>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleApply} disabled={busy !== null} className="btn-primary !px-3 !py-2 !text-xs">
            {busy === "apply" ? "بستورد…" : mode === "replace" ? "📥 استيراد واستبدال" : "📥 استيراد (دمج)"}
          </button>
          {fileName ? <span className="text-[11px] text-ink-500">{fileName}</span> : null}
        </div>
      </form>

      {state.message ? (
        <p
          className={`text-xs ${
            !state.ok ? "text-amber-300" : state.noChanges ? "text-ink-300" : "text-emerald-300"
          }`}
        >
          {!state.ok ? "⚠️ " : state.noChanges ? "ℹ️ " : "✅ "}
          {state.message}
        </p>
      ) : null}

      {state.generatedAt ? (
        <p className="text-[11px] text-ink-500">
          النسخة اتاخدت {formatDate(new Date(state.generatedAt))}
          {state.version ? ` · إصدار ${state.version}` : ""}
        </p>
      ) : null}

      {state.warnings?.length ? (
        <ul className="space-y-1">
          {state.warnings.map((warning, index) => (
            <li key={`${index}-${warning.slice(0, 16)}`} className="text-[11px] text-amber-300/90">
              ⚠️ {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {counts.length ? (
        <div className="overflow-x-auto rounded-2xl border border-ink-700/60">
          <table className="w-full text-[11px]">
            <thead className="bg-ink-900 text-ink-400">
              <tr className="border-b border-ink-700/60">
                <th className="p-2 text-start font-semibold">الجدول</th>
                <th className="p-2 text-start font-semibold">في النسخة</th>
                <th className="p-2 text-start font-semibold">في القاعدة</th>
                {state.stage === "done" ? <th className="p-2 text-start font-semibold">دخل فعلًا</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/60">
              {counts.map((row) => (
                <tr key={row.key}>
                  <td className="p-2 text-ink-200">{row.label}</td>
                  <td className="p-2 tabular-nums text-ink-300">{row.inBackup}</td>
                  <td className="p-2 tabular-nums text-ink-400">{row.current}</td>
                  {state.stage === "done" ? (
                    <td className="p-2">
                      <Badge
                        className={
                          (row.inserted ?? 0) > 0
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : "border-ink-700/60 bg-ink-800/60 text-ink-500"
                        }
                      >
                        {row.inserted ?? 0}
                      </Badge>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
