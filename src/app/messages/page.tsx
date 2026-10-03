import { PastePanel } from "@/components/forms/paste-panel";
import { MessageItem } from "@/components/messages/message-item";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/ui";
import { countMessagesByStatus, listCards, listCategories, listMessages } from "@/lib/services/queries";
import { reprocessMessagesAction } from "@/server/actions/messages";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [messages, cards, categories, counts] = await Promise.all([
    listMessages({ status: status || undefined, limit: 80 }),
    listCards(),
    listCategories(),
    countMessagesByStatus(),
  ]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const filters = [
    { key: "", label: "الكل", count: total },
    { key: "PARSED", label: "متحللة", count: counts.PARSED ?? 0 },
    { key: "NEEDS_REVIEW", label: "تحتاج مراجعة", count: counts.NEEDS_REVIEW ?? 0 },
    { key: "UNMATCHED", label: "بطاقة غير معروفة", count: counts.UNMATCHED ?? 0 },
    { key: "IGNORED", label: "متجاهلة", count: counts.IGNORED ?? 0 },
  ];

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="رسائل البنك"
        subtitle="الصق رسالة SMS وهيتحلل المبلغ والتاجر والبطاقة تلقائياً"
        action={
          <form action={reprocessMessagesAction}>
            <button type="submit" className="btn-ghost">
              🔄 إعادة تحليل غير المربوطة
            </button>
          </form>
        }
      />

      <PastePanel cards={cards} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي الرسائل" value={String(total)} icon="📨" />
        <StatCard label="اتسجلت تلقائياً" value={String(counts.PARSED ?? 0)} icon="✅" tone="good" />
        <StatCard label="محتاجة مراجعة" value={String((counts.NEEDS_REVIEW ?? 0) + (counts.UNMATCHED ?? 0))} icon="⚠️" tone="warn" />
        <StatCard label="متجاهلة" value={String(counts.IGNORED ?? 0)} icon="🚫" />
      </div>

      <SectionCard
        title="صندوق الرسائل"
        action={
          <div className="flex flex-wrap gap-1.5">
            {filters.map((filter) => (
              <a
                key={filter.key || "all"}
                href={filter.key ? `/messages?status=${filter.key}` : "/messages"}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  (status ?? "") === filter.key
                    ? "border-brand-500/40 bg-brand-500/15 text-brand-300"
                    : "border-ink-700/70 text-ink-400 hover:text-ink-50"
                }`}
              >
                {filter.label} ({filter.count})
              </a>
            ))}
          </div>
        }
      >
        {messages.length ? (
          <ul className="space-y-3">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} cards={cards} categories={categories} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="📭"
            title="مفيش رسائل هنا"
            description="الصق أول رسالة بنك فوق، أو فعّل الإرسال التلقائي من الموبايل من صفحة الإعدادات."
            actionLabel="إعدادات الربط التلقائي"
            actionHref="/settings"
          />
        )}
      </SectionCard>
    </div>
  );
}
