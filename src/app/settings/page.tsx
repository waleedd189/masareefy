import { headers } from "next/headers";
import { CopyField } from "@/components/copy-field";
import { ParserTester } from "@/components/forms/parser-tester";
import { ApiTokens } from "@/components/settings/api-tokens";
import { LearningPanel } from "@/components/settings/learning-panel";
import { MerchantsPanel } from "@/components/settings/merchants-panel";
import { StatementImport } from "@/components/settings/statement-import";
import { ThemePanel } from "@/components/settings/theme-panel";
import { PolicyBadges, PolicyPanel } from "@/components/settings/policy-panel";
import { DataManagement } from "@/components/settings/data-management";
import { PageHeader, SectionCard } from "@/components/ui";
import { db } from "@/db/client";
import { apiTokens, parserRules } from "@/db/schema";
import { listCards, listCategories } from "@/lib/services/queries";
import { getFxRates, getMonthlyBudgetTotal, getPolicy } from "@/lib/settings-store";
import { listCategoryOptions, listWords } from "@/lib/services/words";
import { listLinks } from "@/lib/services/sender-links";
import { getMergeSuggestions } from "@/lib/services/merchants";
import { BANK_OPTIONS } from "@/lib/sms/banks";
import { TX_TYPES, TX_TYPE_LABELS } from "@/lib/sms/types";
import {
  createCategoryAction,
  createRuleAction,
  deleteCategoryAction,
  deleteRuleAction,
  restoreDefaultCategoriesAction,
  toggleRuleAction,
  updateCategoryAction,
} from "@/server/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const [categories, tokens, rules, policy, monthlyBudget, rates, words, links, categoryOptions, merchantGroups] = await Promise.all([
    listCategories(),
    db.select().from(apiTokens),
    db.select().from(parserRules),
    getPolicy(),
    getMonthlyBudgetTotal(),
    getFxRates(),
    listWords(),
    listLinks(),
    listCategoryOptions(),
    getMergeSuggestions(),
  ]);
  const cards = await listCards();

  const sampleToken = tokens[0]?.token ?? "<api-token>";

  return (
    <div className="animate-rise space-y-6">
      <PageHeader title="الإعدادات" subtitle="الربط التلقائي للرسائل، الفئات، وقواعد التحليل" />

      <SectionCard
        title="📲 الاستقبال التلقائي لرسائل البنك"
        subtitle="بدل ما تلصق الرسائل يدوياً، خلي الموبايل يبعتها للموقع أول ما توصل"
      >
        <ol className="mb-4 space-y-2 text-xs leading-relaxed text-ink-300">
          <li>
            <b className="text-ink-50">1.</b> نزّل تطبيق مجاني زي <b>SMS Forwarder</b> أو <b>MacroDroid</b> أو <b>Tasker</b> على الأندرويد.
          </li>
          <li>
            <b className="text-ink-50">2.</b> اعمل قاعدة: لما توصل رسالة من المرسل (CIB / NBE / QNB …) ابعتها POST على الرابط ده.
          </li>
          <li>
            <b className="text-ink-50">3.</b> حط الـ Header: <code className="text-brand-300">Authorization: Bearer &lt;token&gt;</code> والـ body JSON فيه نص الرسالة.
          </li>
        </ol>

        <div className="space-y-3">
          <div>
            <span className="field-label">رابط الاستقبال (Webhook)</span>
            <CopyField value={`${baseUrl}/api/ingest`} />
          </div>
          <div>
            <span className="field-label">مثال كامل (curl)</span>
            <CopyField
              value={`curl -X POST ${baseUrl}/api/ingest -H "Authorization: Bearer ${sampleToken}" -H "Content-Type: application/json" -d '{"text":"نص الرسالة","sender":"CIB"}'`}
            />
          </div>
          <div>
            <span className="field-label">صيغة الـ JSON</span>
            <pre className="overflow-x-auto rounded-xl border border-ink-700/70 bg-ink-950/70 p-3 text-left font-mono text-[11px] text-ink-300" dir="ltr">
{`{
  "text": "%message%",     // نص الرسالة
  "sender": "%from%",      // اسم المرسل (اختياري)
  "receivedAt": "%time%"   // وقت الاستلام (اختياري)
}`}
            </pre>
          </div>
        </div>

        <div className="mt-5 border-t border-ink-700/50 pt-4">
          <ApiTokens tokens={tokens.map((t) => ({ id: t.id, name: t.name, token: t.token, lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null }))} />
        </div>
      </SectionCard>

      <SectionCard title="🧪 اختبار محلل الرسائل" subtitle="جرّب أي رسالة وشوف البيانات اللي هتتقرا منها">
        <ParserTester />
      </SectionCard>

      <SectionCard
        title="🏷️ الفئات والكلمات المفتاحية"
        subtitle="التصنيف التلقائي بيشتغل بمطابقة اسم التاجر بالكلمات دي"
        action={
          <form action={restoreDefaultCategoriesAction}>
            <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
              استرجاع الفئات الافتراضية
            </button>
          </form>
        }
      >
        <form action={createCategoryAction} className="mb-4 grid gap-2 sm:grid-cols-6">
          <input name="emoji" placeholder="🍔" className="field text-center sm:col-span-1" maxLength={4} />
          <input name="name" placeholder="اسم الفئة" className="field sm:col-span-1" required />
          <input name="keywords" placeholder="كلمات مفتاحية مفصولة بفاصلة" className="field sm:col-span-2" />
          <select name="parentId" defaultValue="" className="field sm:col-span-1">
            <option value="">فئة رئيسية</option>
            {categories
              .filter((c) => !c.parentId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  ↳ تحت {c.name}
                </option>
              ))}
          </select>
          <button type="submit" className="btn-primary sm:col-span-1">
            إضافة فئة
          </button>
        </form>

        <ul className="space-y-2">
          {categories.map((category) => (
            <li key={category.id} className="rounded-2xl border border-ink-700/50 bg-ink-950/40 p-3">
              <form action={updateCategoryAction} className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto_auto] sm:items-center">
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="name" value={category.name} />
                <input type="hidden" name="emoji" value={category.emoji} />
                <span className="text-sm font-bold">
                  {category.emoji} {category.name}
                  {category.parentId ? (
                    <span className="ms-1 text-[10px] font-medium text-ink-500">
                      ↳ {categories.find((c) => c.id === category.parentId)?.name ?? ""}
                    </span>
                  ) : null}
                </span>
                <select name="parentId" defaultValue={category.parentId ?? ""} className="field !w-36 !py-1.5 !text-xs">
                  <option value="">فئة رئيسية</option>
                  {categories
                    .filter((c) => !c.parentId && c.id !== category.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        ↳ تحت {c.name}
                      </option>
                    ))}
                </select>
                <input name="keywords" defaultValue={category.keywords} placeholder="كلمات مفتاحية" className="field !py-1.5 !text-xs" />
                <input
                  name="monthlyBudget"
                  defaultValue={category.monthlyBudget ?? ""}
                  placeholder="ميزانية شهرية"
                  className="field !w-32 !py-1.5 !text-xs"
                  inputMode="decimal"
                />
                <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                  حفظ
                </button>
              </form>
              <form action={deleteCategoryAction} className="mt-1">
                <input type="hidden" name="id" value={category.id} />
                <button type="submit" className="text-[11px] text-rose-300/80 hover:text-rose-300">
                  حذف الفئة
                </button>
              </form>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="🛡️ سياسة الرسائل والميزانية"
        subtitle="التسجيل الآلي ولا المراجعة؟ إيه اللي يحتاج موافقتك؟ وميزانيتك الشهرية وأسعار الصرف"
        action={<PolicyBadges policy={policy} />}
      >
        <PolicyPanel policy={policy} monthlyBudget={monthlyBudget} rates={rates} />
      </SectionCard>

      <SectionCard
        title="🧠 التعلّم والروابط والاستيراد"
        subtitle="علّم المحلل كلماتك، اربط المرسلين بالحسابات، واستورد عمليات من CSV"
      >
        <LearningPanel
          words={words.map((w) => ({
            id: w.id,
            display: w.display,
            kind: w.kind,
            origin: w.origin,
            hidden: w.hidden,
            isProtected: w.isProtected,
            hits: w.hits,
            categoryId: w.categoryId,
          }))}
          links={links.map((l) => ({
            id: l.id,
            senderKey: l.senderKey,
            last4: l.last4,
            cardId: l.cardId,
            cardName: l.cardName,
            cardLast4: l.cardLast4,
            categoryId: l.categoryId,
            label: l.label,
            autoFile: l.autoFile,
            approvedCount: l.approvedCount,
          }))}
          categories={categoryOptions}
          cards={cards.map((c) => ({ id: c.id, label: `${c.name} ••${c.last4}` }))}
        />
      </SectionCard>

      <SectionCard
        title="🛒 دمج التجار المتشابهين"
        subtitle="نفس التاجر بييجي بأشكال مختلفة من البنك — اختار الاسم الموحّد وادمج العمليات"
        action={<span className="text-[11px] text-ink-500">{merchantGroups.length} اقتراح</span>}
      >
        <MerchantsPanel groups={merchantGroups} />
      </SectionCard>

      <SectionCard
        title="⚙️ قواعد تحليل مخصّصة"
        subtitle="لو بنكك بيكتب الرسالة بصيغة غريبة، ضيف Regex بمجموعات مسماة: amount, last4, merchant, balance, date"
      >
        <form action={createRuleAction} className="mb-4 grid gap-2 sm:grid-cols-6">
          <input name="name" placeholder="اسم القاعدة" className="field sm:col-span-1" required />
          <select name="bankKey" defaultValue="custom" className="field sm:col-span-1">
            <option value="custom">أي بنك</option>
            {BANK_OPTIONS.map((bank) => (
              <option key={bank.value} value={bank.value}>
                {bank.label}
              </option>
            ))}
          </select>
          <input
            name="pattern"
            placeholder="(?<amount>[\\d,.]+)\\s*(?:ج\\.م).*?(?<last4>\\d{4})"
            className="field font-mono sm:col-span-2"
            dir="ltr"
            required
          />
          <select name="typeHint" defaultValue="" className="field sm:col-span-1">
            <option value="">نوع تلقائي</option>
            {TX_TYPES.map((type) => (
              <option key={type} value={type}>
                {TX_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary sm:col-span-1">
            إضافة قاعدة
          </button>
        </form>

        {rules.length ? (
          <ul className="space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink-700/50 bg-ink-950/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {rule.name} {rule.enabled ? "" : <span className="text-[11px] text-ink-500">(متوقفة)</span>}
                  </p>
                  <code className="block truncate font-mono text-[11px] text-ink-400" dir="ltr">
                    {rule.pattern}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleRuleAction}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                      {rule.enabled ? "إيقاف" : "تفعيل"}
                    </button>
                  </form>
                  <form action={deleteRuleAction}>
                    <input type="hidden" name="id" value={rule.id} />
                    <button type="submit" className="text-[11px] font-semibold text-rose-300">
                      حذف
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-400">مفيش قواعد مخصّصة — المحلل الافتراضي بيغطي أغلب البنوك المصرية.</p>
        )}
      </SectionCard>

      <SectionCard
        title="📄 استيراد كشف حساب (PDF / CSV)"
        subtitle="ارفع كشف البنك واستخرج العمليات — معاينة الأول ثم حفظ المختار"
      >
        <StatementImport cards={cards.map((c) => ({ id: c.id, label: `${c.name} ••${c.last4}` }))} />
      </SectionCard>

      <SectionCard
        title="🎨 السمة والمظهر"
        subtitle="لون التمييز، الوضع الداكن/الفاتح، حجم الخط، حوافّ الكروت، وترتيب اسم الحساب — بيتحفظ على جهازك"
      >
        <ThemePanel />
      </SectionCard>

      <SectionCard title="💾 إدارة البيانات" subtitle="احتفظ بنسخة من بياناتك أو امسح بيانات التجربة قبل ما تبدأ">
        <DataManagement />
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700/50 pt-4">
          <span className="text-xs text-ink-400">تصدير العمليات فقط:</span>
          <a href="/api/export?format=csv" className="btn-ghost !px-3 !py-1.5 !text-xs">
            CSV
          </a>
          <a href="/api/export?format=json" className="btn-ghost !px-3 !py-1.5 !text-xs">
            JSON
          </a>
        </div>
      </SectionCard>
    </div>
  );
}
