# نشر «مصاريفي» على Vercel من فرع الشغل (من غير دمج ولا قفل الـPR)

> الهدف: التحديثات كلها تبقى أونلاين على رابط دائم، و**PR #2 يفضل مفتوح** زي ما هو.
>
> الحقيقة المهمة: **Vercel مش بيربط النشر بالـPR**. الإنتاج بيتبني من «Production Branch»،
> وأي فرع تقدر تخليه هو فرع الإنتاج من غير ما تدمج حاجة في `main` ولا تقفل أي PR.

---

## 0) جهّز قاعدة بيانات سحابية (Turso) — ~3 دقايق

ملف SQLite المحلي **مش بيستمر** على Vercel (نظام ملفات مؤقت بيتمسح مع كل نشر)،
والكود بيدعم libSQL من غير أي تعديل.

```bash
npm i -g @tursodatabase/cli
turso auth login                     # أو: turso auth signup
turso db create masareefy
turso db show masareefy --url        # ← DATABASE_URL  (libsql://xxxx.turso.io)
turso db tokens create masareefy     # ← DATABASE_AUTH_TOKEN
```

بديل من غير CLI: **Vercel → Marketplace → Turso → Create Database** وبيضيف المتغيرات للمشروع لوحده.

## 1) اربط المستودع بـVercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `waleedd189/masareefy`.
2. في شاشة الإعدادات قبل الـDeploy:
   | الإعداد | القيمة |
   |---|---|
   | Framework Preset | `Next.js` (بيتكشف تلقائيًا) |
   | Build Command | **فاضي** (الافتراضي `next build`) |
   | Output Directory | **فاضي** |
   | Install Command | **فاضي** (`npm install`) |
   | Root Directory | **فاضي** |

## 2) ⭐ خلّي فرع الشغل هو فرع الإنتاج

بعد ما المشروع يتعمل:

**Settings → Git → Production Branch** → غيّر القيمة من `main` إلى:

```
arena/6cef6377-masareefy
```

> الخطوة دي **مش بتدمج** و**مش بتقفل** الـPR — بس بتقول لـVercel يبني الإنتاج من الفرع ده.
> بعدها أي push على الفرع = نشر إنتاجي تلقائي.

**Settings → General → Node.js Version** → `22.x` (Next 16 محتاج Node ≥ 20).

### لو مش عايز تغيّر Production Branch
سيبها `main`، وكل push على `arena/6cef6377-masareefy` هياخد **Preview Deployment** برابط مستقل
تجرب عليه براحتك، والـPR بياخد الرابط ده في الـChecks — وده كمان من غير دمج.

## 3) متغيرات البيئة

**Settings → Environment Variables** — ضيف التلاتة لـ`Production` **و**`Preview`:

| المتغير | القيمة | ليه |
|---|---|---|
| `DATABASE_URL` | `libsql://xxxx.turso.io` | القاعدة السحابية (بدل الملف المحلي) |
| `DATABASE_AUTH_TOKEN` | توكن Turso | مصادقة على القاعدة |
| `APP_ACCESS_CODE` | كلمة سر قوية من عندك | **بوابة الدخول** — من غيرها الموقع مكشوف |

> ⚠️ التطبيق مفيهوش تسجيل دخول (مصمم للاستخدام الشخصي). `APP_ACCESS_CODE` بيخلّي كل الصفحات
> تطلب كلمة سر مرة واحدة (HTTP Basic Auth، المتصفح بيحفظها) — التنفيذ في `src/middleware.ts`.
> `/api/ingest` مستثنى من البوابة لأنه محمي بمفتاح API مجزّأ (SHA-256) من صفحة الإعدادات.

## 4) Deploy

دوس **Deploy**. أول تشغيل:

- الـmigrations بتشتغل **تلقائيًا** عند بدء السيرفر (`src/instrumentation.ts`) — 13 جدول + 4 هجرات
  (`0000_nappy_lockjaw` → `0003_statement_archive`). مفيش أمر يدوي تحتاج تشغّله.
- الموقع هيطلع **فاضي من البيانات** (القاعدة جديدة) → ضيف حساباتك من `/cards`.
- لو عايز بيانات تجريبية على القاعدة السحابية، من جهازك:

```bash
DATABASE_URL="libsql://xxxx.turso.io" DATABASE_AUTH_TOKEN="..." npm run db:seed
```

## 5) فحص بعد النشر (~دقيقة)

| اختبار | المتوقع |
|---|---|
| فتح الرابط | يطلب كلمة السر (لو `APP_ACCESS_CODE` متضبوط) ثم لوحة التحكم |
| `/cards` → إضافة حساب | بيتحفظ ويظهر في الأرصدة |
| `/settings` → إنشاء مفتاح API | يظهر **مرة واحدة** (مخزّن كبصمة SHA-256) |
| `/api/export?format=xlsx` | ينزّل Excel (7 أوراق) |
| `/settings` → استيراد كشف PDF | معاينة صفوف ← حفظ ← يظهر في `/statements` |
| `/reports` | تقرير الفترة + مقارنة + توقع الشهر الجاي + مشاركة كصورة |
| SMS Forwarder (موبايل) | `https://<your-app>.vercel.app/api/ingest` + مفتاح الـAPI |

اختياري: **Settings → Domains** لدومين باسمك، و**Deployment Protection** لحماية روابط الـPreview.

---

## طريق تاني: نشر مباشر من جهازك (من غير ربط Git خالص)

لو عايز تنشر الكود الموجود عندك دلوقتي من غير ما تربط المستودع:

```bash
git checkout arena/6cef6377-masareefy
npm i -g vercel
vercel login
vercel link                                  # اربطه بمشروع (جديد أو موجود)
vercel env add DATABASE_URL production
vercel env add DATABASE_AUTH_TOKEN production
vercel env add APP_ACCESS_CODE production
vercel --prod                                # بيرفع الكود المحلي كنسخة إنتاج
```

> الطريقة دي **مالهاش أي علاقة بالـPR** — لا دمج ولا قفل، بس ملفاتك بتترفع.

## بديل VPS (من غير Vercel)

```bash
git clone -b arena/6cef6377-masareefy https://github.com/waleedd189/masareefy.git
cd masareefy && npm ci
# قاعدة محلية عادية (بتستمر على disk السيرفر) أو Turso زي فوق
npm run build
APP_ACCESS_CODE="كلمة-سر-قوية" npm run start      # خلف nginx/Caddy مع HTTPS
```

---

## ملاحظات بأمانة

- **نقل بياناتك للتطبيق المنشور:** نزّل نسخة كاملة من البيئة القديمة (`/api/export?format=backup` — بتاخد كل التاريخ)
  ثم في التطبيق المنشور: `/settings` ← «📥 استيراد نسخة احتياطية» ← **افحص النسخة** (تشوف الأعداد قبل أي كتابة)
  ← اختار **دمج** (آمن: بيضيف الناقص بس) أو **استبدال كامل** (بيحذف الحالي، محتاج تأكيد صريح).
  المفاتيح السرية (`msr_*`) ما بتستوردش — اعمل مفتاح API جديد من الإعدادات على البيئة الجديدة.
- **الفحص على قاعدة فاضية:** كل المسارات الـ12 + التصدير + المقارنة ردّت **200** بقاعدة بيانات فاضية
  (من غير seed)، يعني أول نشر على Vercel مش هيكسر.
- **الـPR:** كل الخطوات فوق بتسيب `PR #2` مفتوح. لو قررت تدمجه بعدين في `main`،
  غيّر Production Branch لـ`main` تاني وادمج براحتك.
