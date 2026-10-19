import { BrainDumpPanel } from "@/components/forms/brain-dump-panel";
import { PageHeader, SectionCard } from "@/components/ui";
import { listCards, listCategories } from "@/lib/services/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "التفريغ السريع — مصاريفي",
  description: "اكتب يومك كله بالعربي وإحنا نقسّمه لعمليات وفئات.",
};

/**
 * التفريغ السريع (Brain dump) — مقابل `hub/brain-dump` في Mezanetak.
 * بيستقبل `?text=` من Web Share Target (مشاركة نص من أي تطبيق).
 */
export default async function BrainDumpPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; title?: string }>;
}) {
  const params = await searchParams;
  const [categories, cards] = await Promise.all([listCategories(), listCards()]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="التفريغ السريع"
        subtitle="اكتب اليوم كله بالعربي العامية — نحوله لعمليات مصنّفة في ثواني"
      />

      <SectionCard title="⚡ اكتب وادخل" subtitle="كل مبلغ في النص بيتحول لبند مستقل، وتقدر تعدّله أو تستبعده قبل الحفظ">
        <BrainDumpPanel
          categories={categories.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, keywords: c.keywords }))}
          cards={cards.map((c) => ({ id: c.id, name: c.name, last4: c.last4 }))}
          initialText={params.text ? params.text.trim() : params.title ? params.title.trim() : undefined}
        />
      </SectionCard>

      <SectionCard title="💡 إزاي تكتب" subtitle="أمثلة بتشتغل فعلاً">
        <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
          <li>
            <b className="text-ink-50">سرد يومي:</b> «قهوة 45 وبعدين تاكسي 30 وخروجة العيلة 450»
          </li>
          <li>
            <b className="text-ink-50">رسالة بنك:</b> الصق نص الرسالة وهيتفهم المبلغ والتاجر والبطاقة
          </li>
          <li>
            <b className="text-ink-50">دخل:</b> «مرتبي نزل 12000» أو «استرداد من أمازون 350»
          </li>
          <li>
            <b className="text-ink-50">مشاركة من تطبيق تاني:</b> اختار «مصاريفي» من قائمة المشاركة والنص هيوصل هنا
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
