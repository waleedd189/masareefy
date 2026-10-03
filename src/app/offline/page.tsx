import { OfflineCenter } from "@/components/offline/offline-center";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="مصاريفي أوفلاين"
        subtitle="أضف بطاقات وعمليات ورسائل بنك بدون إنترنت، وهتتزامن تلقائيًا لما الاتصال يرجع"
      />
      <OfflineCenter />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-700/60 bg-ink-900/50 p-4 text-xs leading-relaxed text-ink-300">
          <p className="mb-1 font-bold text-ink-50">Android</p>
          من Chrome اضغط القائمة ⋮ ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
        </div>
        <div className="rounded-2xl border border-ink-700/60 bg-ink-900/50 p-4 text-xs leading-relaxed text-ink-300">
          <p className="mb-1 font-bold text-ink-50">iPhone</p>
          من Safari اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».
        </div>
      </div>
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-relaxed text-ink-400">
        افتح التطبيق مرة واحدة بالإنترنت بعد التثبيت. البيانات غير المتزامنة محفوظة داخل هذا الجهاز؛ لا تمسح بيانات المتصفح أو تحذف التطبيق قبل اكتمال المزامنة.
      </div>
    </div>
  );
}
