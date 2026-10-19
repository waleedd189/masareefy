"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteStatementAction, renameStatementAction } from "@/server/actions/statements";

/**
 * إجراءات كشف واحد في الأرشيف: إعادة تسمية/ملاحظة + حذف.
 *
 * الحذف بيحذف العمليات المستوردة المرتبطة بالكشف، فبنعمل تأكيد صريح
 * بيوضّح العدد بالظبط قبل التنفيذ.
 */
export function StatementActions({
  id,
  label,
  rowsCount,
  notes,
}: {
  id: string;
  label: string;
  rowsCount: number;
  notes: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("label", draftLabel);
      formData.set("notes", draftNotes);
      const result = await renameStatementAction({ ok: false }, formData);
      setMessage(result.message ?? null);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setMessage("حصل خطأ أثناء التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      `حذف الكشف «${label}» هيحذف كمان ${rowsCount} عملية مستوردة منه والأرصدة هتتحسب من جديد.\n\nمتأكد؟`,
    );
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("id", id);
      const result = await deleteStatementAction({ ok: false }, formData);
      setMessage(result.message ?? null);
      router.refresh();
    } catch {
      setMessage("حصل خطأ أثناء الحذف");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {editing ? (
        <form onSubmit={handleRename} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="field-label">اسم الكشف</span>
            <input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              className="field !w-56 !py-1 !text-xs"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="field-label">ملاحظة</span>
            <input
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="مثال: كشف فيزا CIB أكتوبر"
              className="field !w-56 !py-1 !text-xs"
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary !px-3 !py-1.5 !text-xs">
            حفظ
          </button>
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost !px-3 !py-1.5 !text-xs">
            إلغاء
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className="btn-ghost !px-3 !py-1.5 !text-xs">
            ✏️ تسمية/ملاحظة
          </button>
          <button type="button" onClick={handleDelete} disabled={busy} className="btn-ghost !px-3 !py-1.5 !text-xs text-rose-300">
            {busy ? "…" : "🗑️ حذف"}
          </button>
        </div>
      )}
      {message ? <p className="text-[11px] text-amber-300">{message}</p> : null}
    </div>
  );
}
