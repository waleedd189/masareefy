"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { TX_TYPE_LABELS } from "@/lib/sms/types";
import {
  importStatementAction,
  previewStatementAction,
  type StatementPreviewState,
  type StatementRowDto,
} from "@/server/actions/import";

interface Row extends StatementRowDto {
  keep: boolean;
}

/**
 * استيراد كشف حساب: PDF (بنستخرج النص منه) أو CSV أو نص ملصوق.
 * بخطوتين: **معاينة** الصفوف المستخرجة ثم **حفظ** المختار — من غير ما نلوّث البيانات.
 */
export function StatementImport({ cards }: { cards: { id: string; label: string }[] }) {
  const router = useRouter();
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  /** بيانات الأرشيف اللي رجعت من المعاينة (بصمة/اسم/نوع) */
  const [meta, setMeta] = useState<{ label: string; kind: string; fileHash: string }>({
    label: "",
    kind: "TEXT",
    fileHash: "",
  });

  const selected = rows.filter((r) => r.keep);
  const total = selected.reduce((sum, r) => sum + r.amount, 0);

  async function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNote(null);
    setRows([]);
    try {
      const result: StatementPreviewState = await previewStatementAction({ ok: false }, formData);
      setNote(result.message ?? null);
      setWarnings(result.warnings ?? []);
      setRows((result.rows ?? []).map((row) => ({ ...row, keep: true })));
      setMeta({
        label: result.label ?? result.source ?? "كشف مستورد",
        kind: result.kind ?? "TEXT",
        fileHash: result.fileHash ?? "",
      });
    } catch {
      setNote("حصل خطأ أثناء قراءة الملف");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!selected.length) return;
    setBusy(true);
    setNote(null);
    try {
      const payload = selected.map(({ keep, ...rest }) => {
        void keep;
        return rest;
      });
      const formData = new FormData();
      formData.set("rows", JSON.stringify(payload));
      formData.set("cardId", cardId);
      formData.set("label", meta.label || fileName || "كشف مستورد");
      formData.set("kind", meta.kind);
      formData.set("fileHash", meta.fileHash);
      const result = await importStatementAction({ ok: false }, formData);
      setNote(result.message ?? null);
      if (result.ok) {
        setRows([]);
        setWarnings([]);
        router.refresh();
      }
    } catch {
      setNote("حصل خطأ أثناء الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handlePreview} className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="field-label">ملف الكشف (PDF / CSV / TXT)</span>
            <input
              name="file"
              type="file"
              accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="field !py-1.5 !text-xs file:me-2 file:rounded-lg file:border-0 file:bg-ink-800 file:px-2 file:py-1 file:text-[11px] file:text-ink-200"
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">أو الصق نص الكشف</span>
            <input name="text" placeholder="05/10/2026  CARREFOUR MAADI  1,250.00 DR" className="field !w-72 !py-1.5 !text-xs" dir="ltr" />
          </label>
          <label className="space-y-1">
            <span className="field-label">ربط بحساب</span>
            <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="field !w-auto !py-1.5 !text-xs">
              <option value="">بدون حساب</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy} className="btn-primary !px-3 !py-2 !text-xs">
            {busy ? "بقرا الملف…" : "📄 استخراج ومعاينة"}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-500">
          بينفع مع كشوف الـPDF النصية (المصدّرة من البنك). الكشوف المصوّرة (اسكانر) محتاجة OCR وده لسه مش مدعوم،
          ولو الخط بترميز خاص هيقولك في التحذيرات — ساعتها صدّر الكشف CSV من البنك.
        </p>
      </form>

      {note ? <p className={`text-xs ${rows.length ? "text-emerald-300" : "text-amber-300"}`}>{note}</p> : null}
      {warnings.length ? (
        <ul className="space-y-1">
          {warnings.map((warning) => (
            <li key={warning} className="text-[11px] text-amber-300">
              ⚠️ {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length ? (
        <div className="space-y-3">
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-ink-700/60">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-ink-900 text-ink-400">
                <tr className="border-b border-ink-700/60">
                  <th className="p-2 text-start font-semibold">✓</th>
                  <th className="p-2 text-start font-semibold">التاريخ</th>
                  <th className="p-2 text-start font-semibold">البيان</th>
                  <th className="p-2 text-start font-semibold">النوع</th>
                  <th className="p-2 text-start font-semibold">المبلغ</th>
                  <th className="p-2 text-start font-semibold">الثقة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {rows.map((row, index) => (
                  <tr key={`${index}-${row.raw.slice(0, 20)}`} className={row.keep ? "" : "opacity-40"}>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={row.keep}
                        onChange={() =>
                          setRows((current) => current.map((r, i) => (i === index ? { ...r, keep: !r.keep } : r)))
                        }
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap text-ink-300">
                      {row.dateIso ? formatDate(new Date(row.dateIso)) : "—"}
                    </td>
                    <td className="max-w-[240px] truncate p-2 text-ink-200" title={row.raw} dir="auto">
                      {row.description || row.merchant || "—"}
                    </td>
                    <td className="p-2">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, type: e.target.value } : r)),
                          )
                        }
                        className="field !w-auto !py-0.5 !text-[10px]"
                      >
                        {Object.entries(TX_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <input
                        value={row.amount}
                        onChange={(e) =>
                          setRows((current) =>
                            current.map((r, i) => (i === index ? { ...r, amount: Number(e.target.value) || 0 } : r)),
                          )
                        }
                        className="field !w-24 !py-0.5 !text-[11px]"
                        dir="ltr"
                        inputMode="decimal"
                      />
                      <span className="ms-1 text-ink-500">{row.currency}</span>
                    </td>
                    <td className="p-2">
                      <Badge
                        className={
                          row.confidence >= 0.8
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                            : row.confidence >= 0.65
                              ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                              : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                        }
                      >
                        {Math.round(row.confidence * 100)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-400">
              {selected.length} صف مختار بإجمالي <b className="text-brand-300" data-money>{formatMoney(total)}</b>
              {fileName ? ` · ${fileName}` : ""}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setRows([])} className="btn-ghost !px-3 !py-1.5 !text-xs">
                إلغاء
              </button>
              <button type="button" onClick={handleSave} disabled={busy || !selected.length} className="btn-primary !px-3 !py-1.5 !text-xs">
                {busy ? "بحفظ…" : `💾 حفظ ${selected.length} عملية`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
