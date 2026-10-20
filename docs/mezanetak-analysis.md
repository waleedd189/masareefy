# تحليل ثابت لـ `reference-apks/Mezanetak.apk` ومقارنته بمصاريفي

> **حالة الوثيقة:** تحليل فقط — لم يُنفَّذ أي تغيير على كود التطبيق.
> **تاريخ التحليل:** 2026-10-19 · **الأداة:** Androguard 4.1.4 (تفكيك AXML + resources.arsc + DEX) على Python 3.11 بدون تشغيل التطبيق (Static only).
> **الملحق الخام:** [`mezanetak-evidence.md`](./mezanetak-evidence.md) · **قائمة المهام بصيغة قابلة للفرز:** [`mezanetak-backlog.csv`](./mezanetak-backlog.csv)

---

## 1) ملخص تنفيذي

`Mezanetak` (ميزانيتك) تطبيق **Flutter** أصلي لإدارة المصروفات الشخصية، أشمل من مصاريفي بمراحل: هو **تطبيق مالي اجتماعي + مساعد صوتي + نظام تتبّع SMS كامل على الجهاز**، بينما مصاريفي حاليًا **تطبيق ويب/PWA مركّز على بطاقات الفيزا ورسائل البنك**.

أهم 6 نتائج من التحليل:

1. **خط معالجة SMS كامل داخل التطبيق** (`RECEIVE_SMS` + `SmsReceiver` + WorkManager + Room + تشفير Android Keystore + محرّك Flutter headless) — نفس الفكرة اللي مصاريفي بيحققها بـ webhook من تطبيق خارجي (SMS Forwarder). ده أكبر فرق معماري.
2. **محرّك تحليل عربي/إنجليزي مطابق تقريبًا لمعمارية مصاريفي** (بنوك + مفردات + قوالب موثّقة + درجة ثقة + استبعادات) — وفيه **~26 كيانًا ماليًا مصريًا** مقابل **14** في مصاريفي.
3. **محرك سياسة قرارات (Policy Engine)** بيقرر `AUTO_POST / REVIEW / DROP` بأسباب صريحة (`FOREIGN_CURRENCY`, `UNLINKED_SOURCE`, `PARSER_OUTDATED`, ...) + **بوابة تحكّم من السيرفر** (kill-switch + `minParserVersion`) — مصاريفي فيه حالات رسالة (`PARSED/NEEDS_REVIEW/...`) لكن بدون سياسة قابلة للضبط ولا أسباب مفصّلة.
4. **إشعارات بأزرار إجراء** ("سجّل" / "تجاهل") من الإشعار نفسه + نصوص إشعارات قابلة للتعديل من السيرفر حسب اللغة.
5. **7 ودجت للشاشة الرئيسية** (الرصيد، الميزانية، الهدف، آخر العمليات، Brain dump، تصدير، إجراءات سريعة) + **مساعد صوتي مسجَّل كمساعد أندرويد** (`VoiceInteractionService` باسم "Flow Live").
6. **طبقة تحفيز ومجتمع** (حيوانات أليفة sprites، سلسلة streak، معسكر Campfire، ثيمات و26 خلفية بطاقة، جمعية/دائرة ادخار، غرف مشتركة، إشراف، مجتمع بتوصيات جغرافية، إحالات، اشتراك Pro) — معظمها خارج نطاق مصاريفي الحالي.

**الخلاصة العملية:** أكتر حاجة تستحق النقل لمصاريفي **مش** الواجهات، بل ثلاث حزم: (أ) **عمق محرّك الـSMS** (قوالب موثّقة، مفردات متعلَّمة، سياسة قرارات بأسباب)، (ب) **الطبقة المالية الناقصة** (ميزانيات فعّالة، تذكيرات السداد، أهداف، حسابات متعددة الأنواع، تقارير PDF/Excel)، (ج) **مهارات PWA رخيصة** (Share Target، Shortcuts، إخفاء الأرصدة، Web Push).

---

## 2) البطاقة التقنية للـAPK

| البند | القيمة |
|---|---|
| اسم الملف / الحجم | `Mezanetak.apk` — 22,193,211 بايت (~21.2 MiB)، 1,125 مدخل |
| اسم الحزمة | `com.cashflow.expense_tracker` |
| اسم التطبيق | `Mezanetak` (`@string/app_name`) |
| الإصدار | `versionName 1.1.4` · `versionCode 100226` |
| SDK | `minSdk 29` (Android 10) · `targetSdk 36` (Android 16) |
| الإطار | **Flutter** (embedding v2) + طبقة Kotlin أصلية |
| أدوات البناء | Gradle 9.1.0 · Kotlin 2.3.20 · Java 17 (`kotlin-tooling-metadata.json`) |
| DEX | 3 ملفات (9.0 MB + 4.4 MB + 0.2 MB) — **16,593 كلاس**، منها **103 كلاس** تخص التطبيق (`com.cashflow.*`) |
| التوزيع | APK قادم من **Play Store** (`com.android.stamp.source=https://play.google.com/store`)، نوع `STAMP_TYPE_DISTRIBUTION_APK`، **AAB splits مطلوبة** (`com.android.vending.splits.required=true`، `derived.apk.id=3`) |
| الحماية | **Play license check عبر `com.pairip`** (`LicenseActivity` + صلاحية `com.android.vending.CHECK_LICENSE`) + `safe_device` (كشف root/mocks/mock-location) + بصمة التوقيع (`getSigningFingerprint` على قناة `com.cashflow/security`) |
| الخلفية (Backend) | **Firebase**: مشروع `mezanetak`، تخزين `mezanetak.firebasestorage.app`، مواقع `mezanetak.web.app` و`mezanetak.com`، FCM بقناة افتراضية `high_importance_channel_v2`، Analytics + In-App Messaging، تسجيل دخول Google (+ بريد/كلمة مرور بحسب أصول `auth/` و`reset-password.svg`) |
| التخزين المحلي | Hive (بيانات Dart) + `sqflite` + `flutter_secure_storage` + **Room** + SQLite أصلي `mezanetak_sms_candidates.db` + DataStore/SharedPreferences |
| المراقبة | **Sentry** (`sentry_flutter` + `io.sentry.android` + `SentryNdkPreloadProvider`) |
| اللغات | **74 split لغة** (`config.ar`, `config.en`, ...) — النصوص المترجمة في splits مش موجودة في الـbase APK |

> ⚠️ **حدود التحليل:** الـAPK ده base split من App Bundle، ولذلك **مفيش `lib/` ولا `libapp.so` ولا `kernel_blob.bin`** — أي أن **كود Dart (واجهة المستخدم ومنطقها) غير متاح statically**، وكذلك نصوص الواجهة المترجمة (في `config.*` splits). كل ما ورد عن الشاشات والمميزات مستنتج من: أسماء مجلدات/ملفات `assets/flutter_assets` (462 SVG منظّمة بأسماء شاشات)، أسماء الـplugins، طبقة Kotlin في DEX، الـManifest، و`resources.arsc`.

---

## 3) الصلاحيات (23)

### 3.1 صلاحيات يطلبها التطبيق

| # | الصلاحية | الاستخدام المستنتج (من المكونات/الأصول) | خطورة | هل مصاريفي يحتاجها؟ |
|---|---|---|---|---|
| 1 | `RECEIVE_SMS` | `SmsReceiver` + `SmsHeadlessEngine` — قراءة رسائل البنك وتحويلها لعمليات | 🔴 عالية (بيانات مالية) | **أيوة** — لو عملنا تطبيق أندرويد مرافق |
| 2 | `INTERNET` | Firebase/مزامنة/أسعار صرف | 🟢 عادية | n/a (ويب) |
| 3 | `ACCESS_NETWORK_STATE` | `connectivity_plus` — وضع أوفلاين | 🟢 | n/a |
| 4 | `CAMERA` + `uses-feature camera (required=false)` | مسح إيصال/باركود (ML Kit document scanner + `mobile_scanner`) | 🟡 متوسطة | لاحقًا (OCR إيصال) |
| 5 | `RECORD_AUDIO` | الإدخال الصوتي + مساعد "Flow Live" | 🟡 | partially — الويب بيستخدم Web Speech API |
| 6 | `MODIFY_AUDIO_SETTINGS` | `FlowLiveAudioRoute.routeToSpeaker` — توجيه الصوت للسبيكر | 🟢 | لا |
| 7 | `READ_MEDIA_AUDIO` | `audioplayers` (أصوات نجاح العملية/الإشعار/المعسكر) | 🟢 | لا |
| 8 | `POST_NOTIFICATIONS` | إشعارات SMS + تذكيرات (`flutter_local_notifications` + FCM) | 🟡 | Web Push بدلها |
| 9 | `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SHORT_SERVICE` | `FlowAssistantService`/`SessionService` — خدمة المساعدة الصوتية | 🟡 | لا |
| 10 | `RECEIVE_BOOT_COMPLETED` | `CashflowWidgetBootReceiver` + `ScheduledNotificationBootReceiver` — إعادة جدولة الودجت والتنبيهات بعد إعادة التشغيل | 🟢 | لا |
| 11 | `WAKE_LOCK` | FCM + WorkManager | 🟢 | لا |
| 12 | `VIBRATE` | تنبيه الإشعارات | 🟢 | لا |
| 13 | `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` | أصول `community/` (`area.svg`, `pin.svg`, `everywhere.svg`) — توصيات مجتمعية حسب المكان (استنتاج) | 🔴 غير ضرورية لمصاريفي | **لا** |
| 14 | `com.android.vending.BILLING` | اشتراك Pro (`in_app_purchase`) | 🟢 | لا (حاليًا) |
| 15 | `com.android.vending.CHECK_LICENSE` | حماية من النسخ (pairip) | 🟢 | لا |
| 16 | `com.google.android.c2dm.permission.RECEIVE` | FCM push | 🟢 | Web Push |
| 17 | `com.google.android.gms.permission.AD_ID` | Firebase Analytics/قياس الإعلان | 🟡 خصوصية | **لا** |
| 18 | `ACCESS_ADSERVICES_AD_ID` | قياس الإعلانات (AdServices) | 🟡 خصوصية | **لا** |
| 19 | `ACCESS_ADSERVICES_ATTRIBUTION` | إسناد التثبيت (Install referrer) | 🟡 خصوصية | **لا** |
| 20 | `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | تتبع مصدر التثبيت (مرتبط بالإحالات `referral/`) | 🟡 | لا |
| 21 | `com.cashflow.expense_tracker.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | حماية داخلية (signature-level) لمستقبِل ديناميكي | 🟢 | لا |
| — | **غير موجودة (نقطة إيجابية)** | لا `READ_CONTACTS`، لا `READ_SMS` كامل، لا `READ_PHONE_STATE`، لا `READ_EXTERNAL_STORAGE` | ✅ | — |

### 3.2 قراءة أمنية/خصوصية سريعة

| الملاحظة | الدليل | التقييم |
|---|---|---|
| **تشفير الحقول الحساسة في قاعدة SMS** | `KeystoreFieldCipher`: `AES/GCM/NoPadding` على `AndroidKeyStore`، مفتاح `mezanetak_sms_candidates_v1`، وأعمدة `amount_sealed/merchant_sealed/body_sealed` (BLOB) | ✅ ممارسة ممتازة — المبلغ والتاجر ونص الرسالة مشفّرين على الجهاز |
| **منع النسخ الاحتياطي السحابي** | `res/xml/data_extraction_rules.xml` يستثني root/file/database/sharedpref/external بالكامل من `cloud-backup` و`device-transfer` | ✅ مقصود (بيانات مالية) |
| **إخفاء محتوى الإشعار على شاشة القفل** | مفاتيح `heldPublic`/`writtenPublic` مقابل `heldHint`/`writtenHint` في `SmsNotifier` | ✅ نسخة عامة للإشعار بدون مبالغ |
| **صلاحيات إعلانية + موقع** | `AD_ID`, `ADSERVICES_*`, `ACCESS_*_LOCATION` | ⚠️ تزيد سطح الخصوصية؛ مصاريفي مش محتاجها |
| **كشف سلامة الجهاز** | `safe_device` (`MockLocation.MainActivity`) + `pairip` license | ⚠️ حماية تجارية؛ غير مناسبة لتطبيق شخصي مفتوح |
| **مفاتيح Firebase مكشوفة** | `google_api_key`, `default_web_client_id`, `google_app_id` في `resources.arsc` | ℹ️ طبيعية (client keys) — الحماية الحقيقية في Security Rules |

---

## 4) المكونات والـManifest

### 4.1 عدّادات

| المكوّن | العدد | الأهم |
|---|---|---|
| Activities | 14 | `MainActivity` (FlutterActivity)، `WidgetActionActivity`، `UCropActivity` (قص الصور)، `GmsDocumentScanningDelegateActivity` (ماسح المستندات)، `SignInHubActivity`، `ProxyBillingActivity(V2)`، `PlayCoreDialogWrapperActivity` (تحديث داخل التطبيق)، `LicenseActivity` (pairip)، `WebViewActivity` (url_launcher) |
| Services | 19 | `FlowAssistantService` + `FlowAssistantSessionService` (VoiceInteractionService)، `FlutterFirebaseMessagingService`/`BackgroundService`، `SystemForegroundService` (WorkManager)، `GlanceRemoteViewsService` + `RemoteViewsCompatService` (ودجت)، `MultiInstanceInvalidationService` (Room)، `MetadataHolderService` (CameraX) |
| Receivers | 23 | `SmsReceiver` (محمي بـ`BROADCAST_SMS`, exported)، `SmsNotificationActionReceiver`، 7 ودجت Glance، `CashflowWidgetBootReceiver`، `ScheduledNotificationBootReceiver`/`Receiver`، `SharePlusPendingIntent`، FCM receivers |
| Providers | 10 | `ShareFileProvider`, `ImagePickerFileProvider`, `FlutterEmailSenderFileProvider`, `FileProvider` (open_filex), `FirebaseInitProvider`, `MlKitInitProvider`, `SentryPerformanceProvider`, `SentryNdkPreloadProvider`, `InitializationProvider` |

### 4.2 الروابط العميقة (Deep links) ونوايا المشاركة

| النوع | القيمة | المعنى |
|---|---|---|
| App Links (autoVerify) | `https://mezanetak.com/invite/{delegated,room,referral}/…` و`https://mezanetak.web.app/invite/…` | دعوات: **تفويض/إشراف**، **غرفة مشتركة**، **إحالة** |
| App Links | `https://mezanetak.com/auth/callback` | رجوع من تسجيل الدخول (ويب → تطبيق) |
| Custom scheme | `mezanetak://invite/{delegated,room,referral}/…` · `mezanetak://auth` · `mezanetak://widget/` | فتح التطبيق من ودجت/دعوة بدون ويب |
| `ACTION_SEND text/plain` | مستقبَل في `MainActivity` → قناة `cashflow/shared_text` (`takeSharedText`, `onSharedText`) | **"شارك النص للتطبيق"**: تقدر تعمل Share لرسالة البنك/نص مصروف من أي تطبيق فيتحوّل لعملية |
| `flutter_deeplinking_enabled=false` | الروابط متعامَلة يدويًا عبر `app_links` | تحكّم أدق في التوجيه |
| `queries` | `android.speech.RecognitionService`, `PROCESS_TEXT`, `VIEW https`, `CustomTabsService`, `GET_CONTENT`, `InAppBillingService.BIND` | تعرّف على خدمات النظام المستخدمة |

### 4.3 قنوات الاتصال Flutter ↔ Native (Method Channels)

| القناة | الكلاس | الوظيفة |
|---|---|---|
| `cashflow/sms_tracking` | `SmsTrackingChannel` | الواجهة الكاملة لتتبّع SMS (التفاصيل في §6.1) |
| `cashflow/sms_headless` | `SmsHeadlessEngine` | تشغيل محرك Flutter بلا واجهة (`smsHeadlessMain`, `takeWork`, `complete`) لمعالجة الرسائل في الخلفية |
| `cashflow/flow_wake` | `MainActivity` / `FlowAssistantPreferences` / `FlowAssistantLaunchStore` | حالة مساعد "Flow Live"، `requestAssistantRole`, `openAssistantSettings`, `onFlowWake` |
| `cashflow/flow_live_audio` | `FlowLiveAudioRoute` | توجيه الصوت للسبيكر أثناء الجلسة الصوتية |
| `cashflow/shared_text` | `MainActivity` | استقبال نص مشارك |
| `cashflow/launch` | `MainActivity` | إطلاق مؤجَّل/موجَّه (`takePendingLaunch`, `signalFlowLaunch`) |
| `cashflow/file_saver` | `MainActivity.saveToDownloads` | حفظ ملف عبر MediaStore (`relative_path`, `_display_name`, `is_pending`) |
| `com.cashflow/security` | `MainActivity.getSigningFingerprint` | بصمة توقيع التطبيق (للتحقق/الترخيص) |

### 4.4 إضافات Flutter المكتشفة (41 إضافة من `GeneratedPluginRegistrant`)

`app_links`, `audioplayers_android`, `connectivity_plus`, `device_info_plus`, `emoji_picker_flutter`, `file_picker`, `firebase_analytics`, `firebase_core`, `firebase_in_app_messaging`, `firebase_messaging`, `flutter_email_sender`, `flutter_keyboard_visibility`, `flutter_local_notifications`, `flutter_pcm_sound`, `flutter_plugin_android_lifecycle`, `flutter_secure_storage`, `flutter_timezone`, `google_mlkit_document_scanner`, `google_sign_in_android`, `home_widget`, `image_cropper`, `image_picker_android`, `in_app_purchase_android`, `in_app_review`, `in_app_update`, `jni`, `mobile_scanner`, `open_filex`, `package_info_plus`, `path_provider_android`, `pdfx`, `permission_handler_android`, `record_android`, `safe_device`, `sensors_plus`, `sentry_flutter`, `share_plus`, `shared_preferences_android`, `sqflite_android`, `url_launcher_android`, `webview_flutter_android`, `workmanager_android`.

**دلالات مباشرة:** `flutter_pcm_sound` + `record_android` (صوت خام/تسجيل)، `pdfx` (عرض/توليد PDF)، `emoji_picker_flutter` (مجتمع/تعليقات)، `sensors_plus` (إيماءة هزّ — يقابلها `settings_screen/shake.svg`)، `home_widget` (ودجت)، `google_mlkit_document_scanner` + `mobile_scanner` + `image_cropper` (مسح إيصالات/باركود)، `flutter_timezone` + `flutter_local_notifications` + `workmanager_android` (تذكيرات مجدولة)، `in_app_purchase/review/update` (تحقيق ربحي + تقييم + تحديث).

---

## 5) الشاشات المستخرجة

> المصدر: أسماء مجلدات/ملفات `assets/flutter_assets/assets/SVG/*` (461 ملف منظّم بأسماء شاشات)، أيقونات شريط التنقل `navbar/`، شبكة الأدوات `hub_screen/`، وشاشة التعريف `onboarding_screen/`.

### 5.1 شاشات مؤكَّدة بأسماء أصولها (33 مجموعة)

| الشاشة/المجموعة | الدليل (أسماء الأصول) | المحتوى المستنتج |
|---|---|---|
| **الرئيسية (Home)** | `home_screen/` (15): `add-circle, arrow-up, calendar, eye, eye-slash, filter, hub, menu, offline, receipt, sort, stop, telegram, voice, wallets` | ملخص + إضافة سريعة + **إظهار/إخفاء الأرصدة** + فلاتر وترتيب + وضع أوفلاين + إدخال صوتي + رابط تيليجرام |
| **إشارات الرئيسية (Home Signals)** | `home_signals/` (10): `allowance, cards, drift, dues, pace-over, pace-under, pulse, quiet, repeat, unusual` | **تنبيهات ذكية**: وتيرة صرف أعلى/أقل من المعتاد، مصروف غير معتاد، مستحقات، انحراف، هدوء، مصروف متكرر |
| **شبكة الأدوات (Hub)** | `hub_screen/` (27): `appointments, brain-dump, community, customize, debts, exchange-rates, flow-ai, goals, google-drive, holdings, import-expenses, installments, invoice-archive, recurring-expenses, reports, savings-circle, search, shared-rooms, shopping, smart-categories, spending-streak, subscriptions, supervision, voice, chevron-right, back, close-circle` | **قائمة كل الأدوات** — أقوى دليل على حجم المنتج |
| **شريط التنقل (Navbar)** | `navbar/` (14): `home, add, plus, reports, goals, debts, community, shopping, exchange-rates, flow-ai, invoice-archive, shared-rooms, supervision, appointments` | تنقّل سفلي **قابل للتخصيص** (`customize.svg`) |
| **إضافة مصروف** | `add_expense_screen/` (23): `calculator, camera, category, chart, check, clock, close, document, gallery, list, money, move-transaction, note, person, plus, repeat, scan, search, shop, swap, transfer, wallet` | آلة حاسبة، كاميرا/جاليري/مستند، مسح، تكرار، تحويل بين الحسابات، نقل عملية، تاجر/شخص، ملاحظة |
| **كل المصروفات** | `all_expenses_screen/pdf.svg` + `statistics/` (22) | قائمة + تصدير PDF + إحصاءات |
| **الإحصاءات/التقارير** | `statistics/`: `pie-chart, trending-up, trending-down, week, month(via calendar), fire, payments, swap, grid, list-view, download, share, filter, repeat, wallet, category, moon, calendar, check…` | رسوم دائرية/اتجاهات، أسبوعي/شهري، مقارنة، تنزيل ومشاركة |
| **الفئات والفئات الفرعية** | `categories/` (27) + `categories_screen/` (`categories, edit, my-categories, subcategories`) + `subcategories/` (**104** أيقونة) | فئات جاهزة + فئات المستخدم + **104 فئة فرعية** + تحرير |
| **الميزانية** | `budget/` (`budget-type, more, wallet`) + ودجت `widget_budget` | ميزانية إجمالية + **ميزانيات لكل فئة** + أنواع ميزانية |
| **الأهداف (Goals)** | ودجت `widget_goal` + `goal_card.webp` + Lottie `25/50/75/100%_of_goal` | أهداف ادخار بمراحل تقدّم واحتفال |
| **دائرة الادخار (جمعية)** | `savings_circle/` (8): `pot, draw, turn, member, organizer, late, empty, world` | **جمعية/دور أدوار**: منظّم، أعضاء، قرعة، دور، متأخر |
| **الغرف المشتركة** | `hub/shared-rooms` + `navbar/shared-rooms` + deep link `/invite/room/` | دفاتر مشتركة بين أشخاص بدعوة |
| **الإشراف/التفويض** | `supervision/` (11): `approve, binoculars, chat, copy, history, illustration, keyboard, link, unlink, unlock, user-add` + deep link `/invite/delegated/` | **إشراف بموافقات**: ربط/فصل، سجل، إضافة مستخدم، موافقة على عملية |
| **الديون والأقساط والاشتراكات والمتكررات** | `hub/debts, installments, subscriptions, recurring-expenses` + `categories/debt.svg, installment.svg, subscription.svg` + `subscriptions/` (`catalog, cloud, music, stream`) | إدارة ديون/أقساط/اشتراكات (بكتالوج خدمات) وجدولة متكررة |
| **الحسابات/الأصول** | `account_types/` (19): `bank, business, car, card, cash, charity, children, crypto, digital_wallet, education, emergency, family, gold, investment, other, salary, savings, shared, travel` + `hub/holdings` + `assets/silver.svg` | **19 نوع حساب/أصل** (نقد، بنك، استثمار، ذهب، كريبتو، محفظة رقمية…) |
| **البطاقات وتصاميمها** | `cards/` (**26** خلفية بطاقة): `gold_card_bg, charcoal_luxe, crimson_lynx, midnight_wave, rose_blush, taco_fiesta, streak_flame…` | بطاقات بتصاميم/ثيمات (بعضها مرتبط بالـstreak والحيوانات) |
| **التسوق/قوائم الشراء** | `shopping_screen/` (`basket-add, message-to-list, shopping-bag`) + `shopping_requests_illustration.webp` + Lottie `Loading cart` | قائمة مشتريات + **تحويل رسالة لقائمة** |
| **Brain dump** | `hub/brain-dump` + ودجت `widget_brain_dump` ("اكتب اليوم كله ونحن نقسّمه") + `pro_gate/brain-dump.svg` | لصق نص حر طويل → **تقسيمه لعدة عمليات** (ميزة **Pro**) |
| **Flow AI** | `hub/flow-ai`, `navbar/flow-ai`, `onboarding/flow_ai_financial_assistant.svg` | مساعد مالي ذكي (استنتاج: LLM/API خارجي) |
| **Flow Live (مساعد صوتي)** | `flow_live/` (`flow-live, mic-off`) + `VoiceInteractionService` + `@string/flow_assistant_name=Flow Live` | مساعد صوتي **على مستوى النظام** (يتفعّل بزر/من شاشة القفل) |
| **تتبّع SMS** | `sms_tracking/bank_message.svg` + كل طبقة `com.cashflow…sms` | شاشة تفعيل/مراجعة/سجل/ربط المرسل بحساب |
| **المسح الضوئي (إيصالات)** | `onboarding/smart_receipt_scanner.svg` + Lottie `Scanning receipt` + ML Kit document scanner + `mobile_scanner` + `profile/receipt-scan.svg` | مسح إيصال/فاتورة → عملية، وQR/باركود |
| **التصدير والتقارير** | `export_screen/` (`pdf-color, excel-color, spreadsheet, chevron-up`) + ودجت `widget_export` ("PDF and Excel reports") | تصدير **PDF + Excel** |
| **Google Drive** | `google_drive/` (`auto-sync, cloud-upload, reports, restore`) | نسخ احتياطي/مزامنة/استعادة من Drive |
| **الاستيراد** | `hub/import-expenses` | استيراد عمليات (CSV/ملف) |
| **أسعار الصرف** | `hub/exchange-rates`, `navbar/exchange-rates` | أسعار عملات (مصدر خارجي) |
| **المجتمع** | `community/` (12): `question, recommendation, experience, useful, comment, send, confirm, empty, pin, area, everywhere, price` + `emoji_picker_flutter` + موقع جغرافي | مجتمع أسئلة/توصيات بأسعار وأماكن |
| **الموعد/الحجوزات** | `hub/appointments`, `navbar/appointments` | مواعيد (استحقاقات/دفعات) |
| **أرشيف الفواتير** | `hub/invoice-archive`, `navbar/invoice-archive` | أرشفة فواتير/مستندات |
| **الملف الشخصي** | `profile_screen/` (15): `add-account, cloud-backup, id-card, login, logout, premium, profile, receipt-scan, scan-code, settings, voice, chat, copy, eye` | حساب، نسخ سحابي، **بريميوم**، مسح كود (إحالة)، إضافة حساب |
| **الأجهزة/الجلسات** | `devices_screen/` (`device, device-current`) | إدارة الأجهزة/الجلسات المرتبطة (أمان) |
| **التسجيل والدخول** | `auth/` (`lock, mail, reset-password`) + `secure_login_illustration.png` + Google Sign-In + `play-services-fido` (Passkeys) | بريد/كلمة مرور + Google + استعادة + **مفاتيح مرور (FIDO)** |
| **التفضيلات** | `preferences_screen/` (`appearance, currency, language`) | المظهر والعملة واللغة (74 لغة) |
| **الثيمات** | `theme_screen/` (10): `brightness, card-background, checkbox, hash, magic-star, paintbrush, pause, play, timer, paw` | ثيمات + خلفيات بطاقات + **حيوان أليف** + تحكم بالحركة/الصوت |
| **الإعدادات** | `settings_screen/` (19): `bell, sound, cloud, lock, shield?(drawer), themes, game-controller, campfire, name-order, voice-review, shake, tap, delete-sweep, report, star, error, warning, check, apartment, building` | إشعارات، صوت، سحابة، قفل، ألعاب/تحفيز، **Campfire**، ترتيب الاسم، مراجعة صوتية، هزّ الجهاز، تنظيف بيانات، بلاغ مشكلة، تقييم |
| **الإحالة** | `referral/` (`friends, redeem, referral`) + deep link `/invite/referral/` | برنامج إحالة واستبدال مكافآت |
| **Onboarding + What's new** | `onboarding_screen/` (5 شرائح: إحصاءات، Flow AI، تقارير PDF، ماسح إيصالات، إدخال صوتي) + `whats_new/` (`gift, play`) + `update_welcome/release_bloom.svg` + `in_app_update` | تعريف + جديد الإصدار + هدايا |
| **Pro gate (جدار الدفع)** | `pro_gate/brain-dump.svg` + `in_app_purchase` + `drawer/pro.svg` | ميزات مدفوعة (Brain dump مؤكَّد) |
| **التحفيز/الألعاب** | `mascots/` (12) + `pets/` (5 حيوانات: BMO, Kimja, flow, meow, nini — spritesheet + pet.json) + `campfire/` (`fire_pit, fire_flames, firewood, night_backdrop, foreground_grass`) + `morning_path.svg`, `night_path_nature.svg`, `flame_off.svg` + Lottie `Flame - Streak`, `Walking*`, `Pixel Duck`, `batman`, `Lovely Cat` + `hub/spending-streak` | سلسلة التزام (streak)، مسار صباحي/ليلي، حيوان أليف متحرك، جلسة "معسكر" استرخاء |

### 5.2 ودجت الشاشة الرئيسية (7)

| الودجت | الوصف الرسمي (`resources.arsc`) | البيانات المقروءة من `HomeWidgetPreferences` |
|---|---|---|
| `widget_balance` (2×2) | "Account balance and monthly summary" | `balance, income, spent, budgetLeft, budget_total, budget_used, monthly_income, monthly_expense, currency, w_synced_at, tapToStart` |
| `widget_budget` | "Budget usage by category" | `budget_total, budget_used, category_budgets[], cap, spent, noCategoryBudgets` |
| `widget_goal` | "Savings goal progress" | `top_goal{name,target,saved,remaining,pct}, noGoal` |
| `widget_recent` | "Recent transactions" | `recent_transactions[]{name,amount,currency,isIncome,ts}, today/yesterday, add/open` |
| `widget_brain_dump` (2×1) | "Write a whole day of spending at once" | `brainDump`, `brainDumpSubtitle` |
| `widget_export` | "Open PDF and Excel reports" | `export`, `exportSubtitle` |
| `widget_quick_actions` (4×1) | "Quick voice, scan, and add buttons" | `add, scan, voice` → مخزَّن في `cashflow_widget_action_store/pending_action` + deep link `mezanetak://widget/` |

---

## 6) المميزات (تحليل وظيفي)

### 6.1 ⭐ خط تتبّع SMS (أهم ميزة، وأقرب شيء لمصاريفي)

**المكوّنات:** `SmsReceiver` → `SmsIntake` → `SmsParser`/`GenericSmsParser`/`SmsTemplateRegistry` → `SmsPostingPolicy`/`SmsBudgetPolicy`/`SmsServerGate` → `SmsCandidateStore` (SQLite/Room) → `SmsProcessingWorker` (WorkManager) أو `SmsHeadlessEngine` (محرك Flutter بلا واجهة) → `SmsNotifier` (+ `SmsNotificationActionReceiver`).

**1) الطبقة اللغوية للتحليل**

| الكلاس | الوظيفة | الدليل |
|---|---|---|
| `SmsBanks` | سجل بنوك/محافظ بأسماء عربية وإنجليزية ومفاتيح بديلة | **~26 كيانًا**: CIB, NBE(البنك الأهلي), QNB, Banque Misr, Banque du Caire, Alexbank, AAIB, HSBC, ADIB, SAIB, Faisal, ABK, NBK, AIB(الاستثمار العربي), Mashreq, Crédit Agricole, Emirates NBD, InstaPay, Meeza(ميزة), Fawry, Vodafone Cash, Orange Cash, WE Pay, e& Cash(اتصالات كاش), valU(ڤاليو) |
| `SmsVocabulary` | مفردات تصنيف نوع العملية (عربي + إنجليزي) | `تم خصم, خصم, سحب, سحب نقدي, شراء, عملية شراء, مشتريات, سداد, دفع, مدفوعات, تحويل, تحويل وارد, وارد, إيداع, تم إضافة, تم تحويل, استرجاع, استرداد, مرتجع, رد مبلغ, إلغاء, مدين, أرسلت, حولت, إرسال, استلام, استلمت, إضافة, صراف` · `purchase, debited, deducted, withdrawal, cash withdrawal, atm, pos, refund, reversal, credited, deposit, incoming transfer, transfer to, sent to, you sent, paid, payment, spent, charged, cancelled…` |
| `SmsWordKind` / `SmsTransactionKind` | أنواع العمليات | `PURCHASE, DEBIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, REFUND, IGNORE` |
| `SmsTemplateRegistry` | **قوالب موثّقة لكل بنك** (Regex بمجموعات مسماة) | مثال مُستخرج حرفيًا لبنك مصر: `^تم اضافه مبلغ (?<amount>…) ?egp الي حساب رقم x+(?<last4>\d{4}) في` (`banque-misr.transfer-in.v1`)، `^تم تحويل مبلغ … من حساب رقم x+(?<last4>\d{4})` (`transfer-out.v1`)، `بطاقه بنك مصر \*+(?<last4>\d{4})، تم الان خصم (?<amount>…) ?egp ?عند (?<merchant>.+?) يوم \d{2}/\d{2}/\d{4}` (`purchase.v1`) |
| `SmsConfidence` | مستوى الثقة | **`VERIFIED`** (قالب موثّق) مقابل **`GENERIC`** (المحرّك العام) |
| `SmsText` | تطبيع النص العربي | إزالة/توحيد البادئات: `ال, لل, و, وال, بال, ب, ف, ل` + توحيد المسافات |
| `GenericSmsParser` | المحرّك العام | Regex للأرقام `(?<n>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?…)`، لآخر 4 أرقام `(?:card|account|acct|a/c|ending|بطاقه|البطاقه|كارت|الكارت|حساب|الحساب|المنتهي|المنتهيه|ينتهي)[^\d\n]{0,25}?(?:[*x•#]+)?(?<d>\d{4})(?!\d)`، للتاجر `(?:\bat\b|\bfrom merchant\b|merchant:?|لدى|لدي|عند|في متجر|من التاجر|التاجر:?)\s*(?<m>[^\n]{2,80})`، وعملات `EGP/ج.م/جم/جنيه/جنية/ل.ي?/e£/£/USD/$/دولار/EUR/€/يورو/GBP/SAR/ريال/AED/درهم` + تمييز "الرصيد المتاح/الحد المتاح/رصيدك/avail bal/avl bal/available limit/limit is" |
| `SmsExclusions` / `SmsExclusion` | استبعاد الرسائل غير المالية | `OTP, NO_AMOUNT, NO_TRANSACTION, FAILED, PERSONAL_SENDER, USER_IGNORED` |
| `SmsWordStore` + `SmsWordCalls` | **تعلُّم مفردات من المستخدم** | جدول `words(owner_id, word_key, kind, display, category, origin, created_at)`؛ عمليات `saveWord, removeWord, restoreWords, ruleLabel`؛ سمات `builtIn, hidden, protected, origin=user` |

**2) طبقة القرار (Policy)**

| العنصر | القيم المستخرجة |
|---|---|
| `SmsDecisionAction` | `AUTO_POST` · `REVIEW` · `DROP` |
| `SmsDecisionReason` | `AUTO_POST_OFF` · `AUTO_POST_PAUSED` · `FOREIGN_CURRENCY` · `KIND_NEEDS_REVIEW` · `PARSER_OUTDATED` · `SERVER_PAUSED` · `TRACKING_OFF` · `UNLINKED_SOURCE` · `UNVERIFIED_FORMAT` |
| `SmsBudgetPolicy` | `ActiveBudget` / `FixedBudget(budgetGroupId)` — **الميزانية جزء من قرار التسجيل** |
| `SmsServerGate` | `enabled, autoPostEnabled, minParserVersion` — **بوابة تحكّم من السيرفر** (إيقاف عام/إيقاف التسجيل الآلي/رفض نتائج محلل قديم) |
| `SmsSourceLink` | `sender + last4 → accountId, budgetGroupId, category, label, autoFile, approved_count` — **ربط متعلِّم** للمرسل/البطاقة بحساب وميزانية وفئة |
| `SmsIntake$Outcome` | `QUEUED, HELD_FOR_REVIEW, DUPLICATE, EXCLUDED, DROPPED, NO_OWNER` (+ `SHA-256` لإلغاء التكرار) |

**3) التخزين والمعالجة**

```sql
-- mezanetak_sms_candidates.db (SmsCandidateDb: onCreate + upgradeTo2/3/4)
CREATE TABLE candidates (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, state TEXT NOT NULL,
  created_at INTEGER NOT NULL, occurred_at INTEGER NOT NULL,
  amount_sealed BLOB NOT NULL, merchant_sealed BLOB, body_sealed BLOB,  -- مشفّرة AES/GCM
  account_id TEXT, category TEXT, lease_until INTEGER …, attempts …,
  confidence TEXT, currency TEXT, kind TEXT, last4 TEXT, reasons TEXT,
  sender TEXT, template_id TEXT, budget_group_id TEXT, settled_at …, updated_at …);
CREATE INDEX candidates_owner_state ON candidates(owner_id, state);
CREATE TABLE owner_settings (owner_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0, auto_post INTEGER DEFAULT 0, updated_at INTEGER);
CREATE TABLE source_links (owner_id, sender_key, last4, account_id, budget_group_id, approved_count, created_at, PRIMARY KEY(owner_id, sender_key, last4));
CREATE TABLE words (owner_id, word_key, kind, display, category, origin, created_at, PRIMARY KEY(owner_id, word_key, kind));
```

- **حالات المرشّح:** `pending → review → written / discarded` مع `lease_until` (تأجير لمنع المعالجة المزدوجة) و`attempts` — بعد **5 محاولات** فاشلة يتحوّل لـ`discarded`.
- **معالجة بالخلفية:** `SmsProcessingWorker` (CoroutineWorker + `retryOrGiveUp`) أو `SmsHeadlessEngine` (محرك Flutter بلا واجهة، نقطة دخول Dart اسمها `smsHeadlessMain`) — أي أن **منطق المطابقة/الفئات يعيش في Dart ويُستدعى بدون فتح التطبيق**.
- **تعدّد المستخدمين:** `SmsOwner` يقرأ `FlutterSharedPreferences` (`flutter.guest_mode`, `flutter.hive_active_scope_owner_v1`) → كل البيانات معزولة بـ`owner_id` + `purgeOwner`.

**4) الإشعارات القابلة للتنفيذ**

- قناة `sms_tracking` (`SmsNotifier.ensureChannel`) + قناة FCM `high_importance_channel_v2`.
- **زرّان في الإشعار:** `com.cashflow.expense_tracker.sms.FILE` (سجّل) و`…DISMISS` (تجاهل) عبر `SmsNotificationActionReceiver` → `filed from notification` / `dismissed from notification`.
- **نصوص الإشعارات تُضخّ من التطبيق/السيرفر:** مفتاح `mezanetak_sms_notification_strings` + `setNotificationStrings`، والمفاتيح: `titleExpense, titleIncome, actionFile, actionDismiss, waitingHint, heldHint, writtenHint, writtenPublic, heldPublic, needsApp, noAccount, channelName, lang, currencySymbol, categoryNames` — مع `{amount}` كعنصر نائب و`•••• ` لإخفاء الأرقام.
- **حالات عرض:** `waiting` (منتظر قرار) · `held` (محجوز للمراجعة) · `written` (اتسجّل) · `settled` · `canFileFromNotification`.

**5) واجهة القناة `cashflow/sms_tracking` (سطح البرمجة الكامل)**
`isAvailable, getSettings/setSettings, getServerGate/setServerGate, setNotificationStrings, owner, store, history, reviewItems, pendingCount, reviewCount, claimPending, resolve, settle, undo, saveLink/removeLink/links/unlinkAccount, launchRoute/takeLaunchRoute, purgeOwner, bank, words…` — أي أن الشاشة في Flutter عندها: **تفعيل، سجل، طابور مراجعة، ربط مرسل↔حساب، تراجع (undo)، وإطلاق موجَّه للتطبيق**.

### 6.2 مساعد "Flow Live" الصوتي

- `FlowAssistantService` يرث **`android.service.voice.VoiceInteractionService`** و`FlowAssistantSessionService` يرث `VoiceInteractionSessionService`، مع `res/xml/flow_voice_interaction.xml`:
  `supportsAssist="true"`, `supportsLaunchVoiceAssistFromKeyguard="true"`, `supportsLocalInteraction="true"`, `settingsActivity=MainActivity`, `label=@string/flow_assistant_name` = **"Flow Live"**.
- التطبيق **يطلب دور المساعد في أندرويد**: `requestAssistantRole` (`android.app.role.ASSISTANT`) و`openAssistantSettings` (`MANAGE_DEFAULT_APPS_SETTINGS`, `VOICE_INPUT_SETTINGS`) مع أخطاء `ROLE_REQUEST_ACTIVE` / `Assistant role request is already open`.
- `FlowLiveAudioRoute.routeToSpeaker` (`AUDIO` mode) + `flutter_pcm_sound` (تدفّق PCM خام — استنتاج: **كلمة إيقاظ محلية**) + `assets/SVG/flow_live/mic-off.svg`.
- **النتيجة:** المستخدم يقدر يقول "يا أندرويد/زر المساعد" ويسجّل مصروف بدون فتح التطبيق.

### 6.3 بقية حزم المميزات (دليلها الأصول/الإضافات)

| الحزمة | المكوّنات | الدليل |
|---|---|---|
| **AI / Brain dump** | تقسيم نص حر لمصروفات + مساعد مالي | `hub/brain-dump`, `pro_gate/brain-dump`, ودجت Brain dump، `hub/flow-ai` |
| **مسح المستندات والإيصالات** | ML Kit Document Scanner + ماسح باركود (3 نماذج tflite داخل الـAPK) + قصّ الصور (UCrop) + `pdfx` | `onboarding/smart_receipt_scanner`, Lottie `Scanning receipt`, `assets/mlkit_barcode_models/*.tflite` |
| **التقارير والتصدير** | PDF + Excel + مشاركة + بريد + حفظ في Downloads عبر MediaStore | `export_screen/*`, `cashflow/file_saver`, `share_plus`, `flutter_email_sender`, `open_filex`, Lottie `loading pdf`, `ExcelLoading` |
| **المزامنة السحابية** | Google Drive: مزامنة تلقائية، رفع، تقارير، استعادة | `google_drive/{auto-sync,cloud-upload,reports,restore}` |
| **الميزانيات** | ميزانية شهرية إجمالية + لكل فئة + تأثيرها على قرار تسجيل SMS | `budget/*`, ودجت الميزانية، `SmsBudgetPolicy` |
| **الأهداف** | هدف ادخار + احتفالات 25/50/75/100% | `widget_goal`, Lottie `*_of_goal`, `goal_card.webp` |
| **الجمعية/دائرة الادخار** | أدوار، قرعة، دور، متأخر | `savings_circle/*` |
| **المشاركة الاجتماعية المالية** | غرف مشتركة + إشراف بموافقات + دعوات بروابط | deep links `/invite/{room,delegated,referral}`, `supervision/*`, `shared-rooms` |
| **المجتمع** | أسئلة/توصيات/تجارب + تعليقات + إيموجي + موقع | `community/*`, `emoji_picker_flutter`, `ACCESS_*_LOCATION` |
| **الديون/الأقساط/الاشتراكات/المتكررات/المواعيد** | وحدات مستقلة في الـHub | `hub/{debts,installments,subscriptions,recurring-expenses,appointments,invoice-archive}` |
| **الأصول/الحسابات المتعددة** | 19 نوع حساب + holdings + تحويل بين الحسابات | `account_types/*`, `add_expense_screen/swap,transfer,move-transaction` |
| **أسعار الصرف** | شاشة/تبويب مستقل | `hub/exchange-rates` + عملات المحلل (EGP/USD/EUR/GBP/SAR/AED) |
| **التذكيرات والإشعارات** | إشعارات محلية مجدولة + FCM + In-App Messaging + إعادة جدولة بعد الإقلاع | `flutter_local_notifications`, `flutter_timezone`, `workmanager_android`, boot receivers |
| **التحفيز/الألعاب** | حيوانات أليفة (5)، سلاسل streak، مسار صباحي/ليلي، معسكر Campfire، ثيمات و26 خلفية بطاقة، خط Pixel/PressStart | `pets/*`, `mascots/*`, `campfire/*`, `theme_screen/*`, `cards/*` (26) |
| **الخصوصية والأمان** | قفل، إخفاء الأرصدة، تنظيف بيانات، أجهزة/جلسات، تشفير Keystore، secure storage، حظر النسخ الاحتياطي، كشف سلامة الجهاز، بصمة التوقيع | `home_screen/eye-slash`, `drawer/shield`, `settings_screen/{lock,delete-sweep}`, `devices_screen/*`, `KeystoreFieldCipher`, `flutter_secure_storage`, `data_extraction_rules.xml`, `safe_device`, `com.cashflow/security` |
| **النمو والتحقيق** | Pro/IAP، مراجعة داخل التطبيق، تحديث داخل التطبيق، إحالات، Analytics، Sentry | `in_app_purchase/review/update`, `referral/*`, `pro_gate/*`, `sentry_flutter` |
| **الوصول/اللغات** | 74 لغة (config splits)، تفضيلات مظهر/عملة/لغة، RTL (خطوط Cairo/Tajawal/IBM Plex Sans Arabic/Noto Naskh/Aref Ruqaa) | `splits0.xml`, `preferences_screen/*`, `assets/fonts`, `google_fonts` |

---

## 7) النصوص والموارد المستخرجة

### 7.1 نصوص على مستوى أندرويد (`resources.arsc` — 87 سلسلة، منها 22 تخص التطبيق)

```
app_name                          = Mezanetak
flow_assistant_name               = Flow Live
project_id                        = mezanetak
google_storage_bucket             = mezanetak.firebasestorage.app
google_app_id                     = 1:340085000934:android:66dbef9092e91a2f164927
gcm_defaultSenderId               = 340085000934
default_web_client_id             = 340085000934-83gckq7t7q5qfeuo3nf9c2es4bmaf04s.apps.googleusercontent.com
google_api_key / crash_reporting  = AIzaSyAa6uQqtvaDzhwroDNsLVwfj7BnafKYfEg   (مفتاح عميل عام)
fcm_fallback_notification_channel_label = Miscellaneous
widget_balance_desc               = Account balance and monthly summary
widget_brain_dump_desc            = Write a whole day of spending at once
widget_budget_desc                = Budget usage by category
widget_export_desc                = Open PDF and Excel reports
widget_goal_desc                  = Savings goal progress
widget_quick_actions_desc         = Quick voice, scan, and add buttons
widget_recent_desc                = Recent transactions
not_set / card_content_descriptor / modal_content_descriptor / modal_inner_content_descriptor
```

**نصوص عربية/إنجليزية داخل DEX (من طبقة Kotlin):** أسماء البنوك الـ22 بالعربية، مفردات `SmsVocabulary` (27 عربية + 28 إنجليزية)، قوالب بنك مصر الثلاثة، وتسميات الودجت:
`Balance, Spent, Income, Budget left, Open app, Add, Recent, Today, Yesterday, No transactions yet, Budget, No budget set, No category budgets yet, Other, Goal, Target, Remaining, No active goal, Export, Export data, PDF and Excel reports, Brain dump, QuickActions, Scan, Voice`.

### 7.2 الموارد الرسومية والصوتية

| النوع | العدد | تفاصيل |
|---|---|---|
| SVG | **461** | منظّمة في 43 مجلدًا بأسماء شاشات (أهمها `subcategories` بـ104 أيقونة، `cards` بـ26 خلفية، `categories` بـ27، `hub_screen` بـ27، `statistics` بـ22) |
| Lottie | **30** | `25/50/75/100%_of_goal`, `Flame - Streak`, `Scanning receipt`, `loading pdf`, `ExcelLoading`, `Loading cart`, `no_expense_here`, `Wait For Add`, `process`, `uhmmm`, `sage`, `Rain`, `batman`, `Walking*` (5), `Pixel Duck`, `Lovely Cat`, `Mr. Watermelone`, `Kawaii animals emoji`, `An naym 3d saving`, `Charcoal Black`, `Circle Loader 05`, `The robot broke and 404 error`, `money pf` |
| صور (webp/png) | **22** | `appicon`, `secure_login_illustration`, `financial_tools_hub`, `homepagw_3d-style-BG`, `shopping_requests_illustration`, `goal_card`, `profits`, `coin`, `dollar`, `road`, `obstacle_1`, `pinkflower`, `kitty`, `banimage`, `notavalible`, `batman_logo_theme`, `categories`, `google` |
| حيوانات أليفة | **5** | `BMO, Kimja, flow, meow, nini` — لكل واحد `pet.json` + `spritesheet.webp` (مثال: `{"id":"pocketpal","displayName":"BMO","description":"…pixel art, with Codex pet animations and looking directions.","spriteVersionNumber":2,"kind":"creature"}`) |
| خطوط | **28** | Cairo (متغيّر)، IBM Plex Sans Arabic (7 أوزان)، Tajawal (6)، Noto Naskh Arabic، Aref Ruqaa، Inter، Material Icons، Iconsax، Cupertino Icons، **Pixelify Sans (4)، Press Start 2P (5)** للأجزاء "الأركيدية" |
| صوت | **3** | `app_notifaction.mp3` (في `res/raw` و`assets/sounds`)، `purchase-success-.mp3` |
| نماذج ML | **3** tflite | `barcode_ssd_mobilenet_v1_dmp25_quant`, `oned_feature_extractor_mobile`, `oned_auto_regressor_mobile` (ماسح الباركود) + ماسح المستندات عبر GMS |
| Shaders | 2 | `ink_sparkle.frag`, `stretch_effect.frag` (تأثيرات Material) |
| أخرى | — | `assets/certs/ca_bundle.pem` (حزمة جذور Mozilla بتاريخ 2026-05-14 — لطلبات HTTPS/تثبيت شهادة مخصص)، `res/layout/widget_*` (7 تخطيطات ودجت)، `res/raw/com_android_billingclient_*` (إعدادات الفوترة) |

---

## 8) المقارنة مع مصاريفي

### 8.1 لقطة على مصاريفي اليوم

Next.js 16 (App Router + Server Actions) · TypeScript · Tailwind 4 · Drizzle ORM · libSQL/SQLite · Zod — **5,807 سطر** في `src/`.

| العنصر | الوضع |
|---|---|
| الصفحات | 6: `/` (لوحة)، `/cards` + `/cards/[id]`، `/transactions`، `/messages`، `/settings`، `/offline` |
| الجداول | `cards, categories, messages, transactions, api_tokens, parser_rules, settings` |
| البنوك | **14** + `generic` (CIB, NBE, QNB, بنك مصر, الإسكندرية, القاهرة, العربي الأفريقي, HSBC, ADIB, إنستاباي, فودافون كاش, الراجحي, SNB, الإمارات دبي الوطني) |
| الفئات | **16** فئة مسطّحة بكلمات مفتاحية مصرية — **بدون فئات فرعية** |
| التحليل | `parseSms()` + تطبيع + قواعد Regex مخصّصة من الإعدادات + درجة ثقة (عتبة 0.55) |
| الاستقبال | `/api/ingest` (Bearer token) ← **يعتمد على تطبيق خارجي** (SMS Forwarder/MacroDroid/Tasker) + لصق يدوي متعدد |
| الأرصدة | حساب من آخر "رصيد متاح" + العمليات الأحدث (`balances.ts`) |
| التحليلات | مصروف الشهر مقابل السابق، 6 شهور، توزيع الفئات، أكتر التجار، متوسط العملية |
| التصدير | **CSV / JSON / نسخة احتياطية JSON** |
| الصوت | `parseVoiceExpense()` عبر Web Speech API (مصري) — مسودة مصروف |
| الأوفلاين | PWA + IndexedDB (`offline-store.ts`) + مزامنة `/api/offline` + service worker |
| الميزانيات | **حقل `categories.monthlyBudget` موجود لكن بلا واجهة/حساب/تنبيه** |
| التذكيرات | **حقلا `cards.statementDay` و`cards.dueDay` موجودان بلا استخدام** |
| المصادقة | **لا يوجد** (استخدام شخصي) |
| i18n | عربية فقط (RTL) |

### 8.2 جدول المقارنة التفصيلي

الرموز: ✅ موجود · 🟨 جزئي/بذرة موجودة · ❌ غير موجود · 🚫 خارج النطاق المقترح

| المجال | Mezanetak (الدليل) | مصاريفي | الفجوة |
|---|---|---|---|
| **قراءة SMS تلقائيًا** | أصلي: `RECEIVE_SMS` + Receiver + Worker + محرك headless | 🟨 webhook `/api/ingest` عبر تطبيق خارجي | تطبيق أندرويد مرافق (أو تحسين مسار الـwebhook) |
| **محلل عربي/إنجليزي** | `GenericSmsParser` + تطبيع بادئات (`SmsText`) + عملات + last4 + تاجر | ✅ `parseSms` + `normalize` + `currency` + last4 + تاجر | **متكافئ تقريبًا** — تفوّق بسيط لميزانيتي في تطبيع البادئات العربية |
| **قوالب بنوك موثّقة** | `SmsTemplateRegistry` (`banque-misr.*.v1`) + `SmsConfidence=VERIFIED/GENERIC` | 🟨 `parser_rules` (Regex يدوي من المستخدم فقط) | **قوالب جاهزة لكل بنك + تمييز الثقة موثّق/عام** |
| **عدد البنوك/المحافظ** | ~26 (منها SAIB, فيصل, الأهلي الكويتي, الكويت الوطني, الاستثمار العربي, المشرق, كريدي أجريكول, ميزة, فوري, أورنج كاش, وي باي, اتصالات كاش, ڤاليو) | 14 (+ الراجحي/SNB السعودية) | **+11 كيانًا مصريًا ناقصًا** |
| **مفردات يتعلّمها المستخدم** | `words` table + `saveWord/removeWord/restoreWords` + `builtIn/protected/hidden` | 🟨 تحرير `keywords` للفئات يدويًا | حلقة تعلّم من المراجعة |
| **استبعادات الرسائل** | `OTP, NO_AMOUNT, NO_TRANSACTION, FAILED, PERSONAL_SENDER, USER_IGNORED` | 🟨 `IGNORED` + ثقة منخفضة | أسباب صريحة + مرسل شخصي |
| **سياسة قرار + أسباب** | `AUTO_POST/REVIEW/DROP` + 9 أسباب + `SmsServerGate(enabled, autoPostEnabled, minParserVersion)` | 🟨 حالات `PARSED/NEEDS_REVIEW/UNMATCHED/IGNORED/DUPLICATE/FAILED` بلا سياسة قابلة للضبط | **محرك سياسة + أسباب + عتبات + مفتاح إيقاف** |
| **ربط المرسل بالحساب (تعلّم)** | `source_links(sender_key,last4) → account_id, budget_group_id, category, label, auto_file, approved_count` | 🟨 ربط بآخر 4 أرقام + بنك | ربط على مستوى المرسل مع عدّاد موافقات وتعلّم |
| **تشفير البيانات الحساسة** | AES/GCM عبر Android Keystore لأعمدة `amount/merchant/body` | ❌ (نص صريح في SQLite) + `api_tokens.token` نص صريح | تشفير/تجزئة + إخفاء في الواجهة |
| **إشعارات بإجراءات** | إشعار فيه زرّا "سجّل/تجاهل" + نصوص قابلة للضبط + نسخة عامة لشاشة القفل | ❌ | Web Push (بأزرار محدودة) + صندوق مراجعة بإجراءات سريعة |
| **ودجت** | 7 ودجت (رصيد/ميزانية/هدف/عمليات/brain dump/تصدير/إجراءات) | ❌ | 🚫 يحتاج تطبيق أصلي؛ بديل الويب: PWA Shortcuts + شاشة "اليوم" |
| **مساعد صوتي** | `VoiceInteractionService` "Flow Live" على مستوى النظام + keyguard + PCM | 🟨 `parseVoiceExpense` عبر Web Speech (داخل الصفحة) | تحسين الصوت في الويب (اختصارات، PWA) — الدور الكامل مستحيل ويب |
| **ميزانيات** | إجمالية + لكل فئة + مرتبطة بقرار التسجيل + ودجت | 🟨 `monthlyBudget` في الـschema فقط | **ميزانيات فعّالة: شريط استهلاك، تجاوز، تنبيه** |
| **تذكيرات/مواعيد** | `flutter_local_notifications` + timezone + WorkManager + boot receiver | 🟨 `statementDay/dueDay` بلا استخدام | تذكير سداد/كشف حساب (Web Push أو بريد) |
| **أهداف ادخار** | `goals` + احتفالات مراحل | ❌ | وحدة أهداف |
| **ديون/أقساط/اشتراكات/متكررات** | 4 وحدات مستقلة | ❌ (فئات فقط: `سداد بطاقة`, `فواتير واشتراكات`) | وحدات + جدول تكرار |
| **أنواع حسابات/أصول** | 19 نوعًا (نقد، بنك، استثمار، ذهب، كريبتو، محفظة رقمية…) + holdings | 🟨 `cards` فقط (CREDIT/DEBIT/PREPAID) | تعميم `cards` → `accounts` |
| **جمعية/دائرة ادخار** | `savings_circle` (منظّم، قرعة، دور، متأخر) | ❌ | 🚫 P3 (منتج جديد) |
| **غرف مشتركة/إشراف** | `shared_rooms` + `supervision` + دعوات | ❌ (لا مصادقة) | 🚫 P3 — يتطلب Auth أولًا |
| **مجتمع/إحالات** | `community` + `referral` + موقع | ❌ | 🚫 P4 |
| **تقارير PDF/Excel** | `pdfx` + تصدير Excel/PDF + مشاركة + بريد + MediaStore | 🟨 CSV/JSON/backup | **PDF (تقرير شهري) + XLSX** |
| **استيراد** | `import-expenses` + ماسح مستندات + كاميرا/جاليري | 🟨 لصق رسائل فقط | استيراد CSV/كشف حساب + OCR إيصال |
| **Brain dump (تقسيم نص حر)** | ودجت + شاشة + Pro gate | 🟨 لصق رسائل متعددة (رسالة/سطر) | تقسيم نص حر ذكي لعدة عمليات |
| **إشارات ذكية** | 10 إشارات (`pace-over/under, unusual, drift, dues, quiet, repeat, allowance, pulse, cards`) | 🟨 مقارنة شهر بشهر فقط | **محرّك إشارات** (وتيرة، شذوذ، مستحقات) |
| **إحصاءات متقدمة** | أسبوعي/شهري/مقارنات/اتجاهات/مشاركة/تنزيل | 🟨 6 شهور + فئات + تجار + متوسط | فترات مرنة + مقارنة + مشاركة صورة |
| **فئات فرعية** | 104 أيقونة فئة فرعية + "فئاتي" | ❌ (16 مسطّحة) | فئات فرعية + أيقونات |
| **مزامنة سحابية/نسخ احتياطي** | Google Drive (auto-sync/restore/reports) + منع النسخ الاحتياطي للنظام | 🟨 تصدير JSON + IndexedDB + `/api/offline` | مزامنة Drive/ملف دوري + سجل مزامنة |
| **أوفلاين** | Hive + sqflite + connectivity | ✅ IndexedDB + SW + مزامنة | **مصاريفي أقوى نسبيًا (ويب)** — ينقصه حل التعارضات |
| **مصادقة/مستخدمون** | Google + بريد + Passkeys (FIDO) + أجهزة/جلسات + `owner_id` + وضع ضيف | ❌ | Auth متعدد المستخدمين (متطلب للمزامنة الفعلية) |
| **تعدد اللغات** | 74 لغة | ❌ عربي فقط | i18n (ar/en مبدئيًا) |
| **ثيمات/تخصيص** | 10 عناصر ثيم + 26 خلفية بطاقة + ترتيب الاسم + اهتزاز | 🟨 6 ألوان بطاقة + وضع داكن/فاتح (CSS) | ثيمات + خلفيات بطاقات |
| **تحفيز/ألعاب** | 5 حيوانات + streak + campfire + مسار صباحي/ليلي | ❌ | 🚫 P3 (اختياري) |
| **تحقيق ربحي** | IAP Pro + مراجعة + تحديث | ❌ | 🚫 P4 |
| **مراقبة الأخطاء** | Sentry (+NDK) + Firebase Analytics | ❌ | Sentry/Logging + قياس بسيط |
| **مشاركة نص للتطبيق** | `ACTION_SEND` → `cashflow/shared_text` | ❌ | ✅ **Web Share Target** (رخيص جدًا في PWA) |
| **اختصارات سريعة** | ودجت `add/scan/voice` + `mezanetak://widget/` | ❌ | ✅ **PWA `shortcuts`** |
| **إخفاء الأرصدة** | `home_screen/eye-slash.svg` | ❌ | ✅ رخيص |
| **تنظيف/حذف بيانات** | `delete-sweep` + `purgeOwner` + `reset` | 🟨 `data-management.tsx` (نسخ/حذف تجريبي) | سياسة احتفاظ + حذف حسب الفترة |

---

## 9) جدول الأولويات المقترح (للموافقة — لم يُنفَّذ شيء)

**معيار الأولوية:** (الأثر على المستخدم المصري) × (القرب من مهمة مصاريفي الأساسية: بطاقات + رسائل بنك) ÷ (الجهد + المخاطرة).
**الجهد:** S = أقل من يوم · M = 1–3 أيام · L = أسبوع+ · XL = مشروع مستقل.
**المنصة:** W = ويب/PWA الحالي · A = يتطلب تطبيق أندرويد مرافق · B = الاثنين.

### 🔴 P0 — مكاسب سريعة على الجوهر (أوصي نبدأ بيها)

| # | البند | الدليل من Mezanetak | الوضع في مصاريفي | الجهد | الأثر | المنصة | ملاحظات/اعتماديات |
|---|---|---|---|---|---|---|---|
| 1 | **ميزانيات شهرية فعّالة** (إجمالي + لكل فئة): شريط استهلاك، متبقّي، تجاوز، لون تحذيري | ودجت `widget_budget` + `SmsBudgetPolicy(ActiveBudget/FixedBudget)` | 🟨 `categories.monthlyBudget` موجود بلا استخدام | M | ⭐⭐⭐⭐⭐ | W | migration صغيرة + `stats.ts` + قسم في لوحة التحكم والإعدادات |
| 2 | **تذكير بمواعيد السداد وكشف الحساب** | `flutter_local_notifications` + `flutter_timezone` + boot receivers | 🟨 `statementDay/dueDay` بلا استخدام | M | ⭐⭐⭐⭐⭐ | W | Web Push (يحتاج VAPID) أو بديل بسيط: تنبيه داخل الصفحة + بريد |
| 3 | **توسيع سجل البنوك/المحافظ المصرية** (+11: SAIB, فيصل, الأهلي الكويتي, الكويت الوطني, الاستثمار العربي, المشرق, كريدي أجريكول, ميزة, فوري, أورنج كاش, وي باي, اتصالات كاش, ڤاليو) | `SmsBanks` (22 اسم عربي/23 إنجليزي + مفاتيح بديلة) | 14 بنك | S | ⭐⭐⭐⭐ | W | تعديل `src/lib/sms/banks.ts` فقط + عيّنات في `samples.ts` |
| 4 | **قوالب بنوك موثّقة داخل المحلل** + مستوى ثقة `VERIFIED` مقابل `GENERIC` | `SmsTemplateRegistry` (`banque-misr.purchase/transfer-in/transfer-out.v1`) + `SmsConfidence` | 🟨 قواعد Regex يدوية فقط | M | ⭐⭐⭐⭐⭐ | W | بذرة قوالب في الكود + أولوية أعلى من المحرّك العام + شارة في واجهة المراجعة |
| 5 | **Web Share Target**: مشاركة نص الرسالة من أي تطبيق أندرويد إلى مصاريفي | `ACTION_SEND text/plain` → `cashflow/shared_text` | ❌ | S | ⭐⭐⭐⭐ | W | `share_target` في `manifest.ts` + `/messages?shared=…` — بديل عملي لـSMS Forwarder |
| 6 | **PWA Shortcuts + إخفاء الأرصدة (عين/عين مشطوبة)** | ودجت `add/scan/voice` + `home_screen/eye-slash.svg` | ❌ | S | ⭐⭐⭐ | W | `shortcuts` في الـmanifest + حالة في `localStorage` |
| 7 | **أسباب صريحة لقرار الرسالة** (`FOREIGN_CURRENCY, UNLINKED_SOURCE, UNVERIFIED_FORMAT, KIND_NEEDS_REVIEW…`) تظهر في صندوق المراجعة | `SmsDecisionReason` (9 قيم) + `reasons` في جدول `candidates` | 🟨 حالة فقط بدون سبب | S | ⭐⭐⭐⭐ | W | إضافة `reasons` لجدول `messages` + عرضها كـchips |

### 🟠 P1 — عمق الجوهر (بعد موافقتك على P0)

| # | البند | الدليل | الوضع | الجهد | الأثر | المنصة | ملاحظات |
|---|---|---|---|---|---|---|---|
| 8 | **محرك سياسة التسجيل الآلي** (AUTO_POST/REVIEW/DROP + عتبات + إيقاف مؤقت + مفتاح عام) | `SmsPostingPolicy`, `SmsServerGate(enabled, autoPostEnabled, minParserVersion)` | 🟨 | M | ⭐⭐⭐⭐⭐ | W | صفحة "سياسة الرسائل" في الإعدادات + سجل قرارات |
| 9 | **تعلّم المفردات من المراجعة** (كلمة → نوع/فئة/تجاهل، مع built-in/user/protected) | `words` table + `SmsWordCalls(saveWord, removeWord, restoreWords)` | 🟨 | M | ⭐⭐⭐⭐ | W | زر "علّم المحلل" على كل رسالة مراجعة |
| 10 | **ربط على مستوى المرسل** (`sender + last4 → card, category, budget, label, autoFile` + عدّاد موافقات) | `source_links` | 🟨 | M | ⭐⭐⭐⭐ | W | يقلّل المراجعة المتكررة بشكل كبير |
| 11 | **تقارير PDF + Excel** (تقرير شهري/حسب بطاقة/فئة) | `export_screen/{pdf-color,excel-color}`, `pdfx`, ودجت Export | 🟨 CSV/JSON | M | ⭐⭐⭐⭐ | W | مكتبة PDF (عربية/RTL تحتاج خطوط مضمّنة) + XLSX |
| 12 | **تعميم البطاقات إلى حسابات** (19 نوع: نقد، بنك، محفظة، استثمار، ذهب…) + تحويل بين الحسابات | `account_types/*`, `add_expense_screen/{swap,transfer,move-transaction}` | 🟨 | L | ⭐⭐⭐⭐ | W | migration + إعادة تسمية مفهومية مع الحفاظ على التوافق |
| 13 | **محرّك إشارات ذكية** (وتيرة أعلى/أقل، مصروف غير معتاد، مستحقات، انحراف، هدوء، تكرار) | `home_signals/*` (10) | 🟨 | M | ⭐⭐⭐⭐ | W | قواعد إحصائية محلية على بيانات موجودة (بدون AI) |
| 14 | **فئات فرعية + أيقونات** | `subcategories/` (104) + `categories_screen/*` | ❌ | M | ⭐⭐⭐ | W | `parent_id` + طقم أيقونات (يمكن توليد SVG) |
| 15 | **Brain dump**: لصق نص حر طويل → مسودة عدة عمليات | ودجت/screen + `pro_gate/brain-dump` | 🟨 لصق رسائل | M | ⭐⭐⭐⭐ | W | نسخة قواعدية أولًا، ثم اختيارية بالـAI |
| 16 | **تأمين المفاتيح والبيانات** (تجزئة `api_tokens` بدل النص الصريح، تسجيل آخر استخدام، إخفاء أرقام جزئيًا) | `KeystoreFieldCipher` + `flutter_secure_storage` | ❌ | S–M | ⭐⭐⭐⭐ | W | لا يوجد تشفير Keystore في الويب، لكن التجزئة + الإخفاء متاحان |
| 17 | **أهداف ادخار** (هدف، تقدّم، تاريخ مستهدف، احتفال 25/50/75/100%) | `widget_goal` + Lottie `*_of_goal` | ❌ | M | ⭐⭐⭐ | W | جدول `goals` + بطاقة في اللوحة |
| 18 | **تطبيق أندرويد مرافق (MVP)** يقرأ SMS ويرسلها لـ`/api/ingest` مباشرة | كل طبقة `com.cashflow…sms` | ❌ | XL | ⭐⭐⭐⭐⭐ | A | يلغي الاعتماد على SMS Forwarder؛ يبدأ بـReceiver + Worker + POST (بدون headless Flutter) |

### 🟡 P2 — توسعات مدروسة

| # | البند | الدليل | الجهد | الأثر | المنصة | ملاحظات |
|---|---|---|---|---|---|---|
| 19 | استيراد كشف حساب (CSV/PDF) | `hub/import-expenses`, `all_expenses_screen/pdf` | M | ⭐⭐⭐⭐ | W | في خارطة الطريق أصلًا |
| 20 | مسح إيصال بالكاميرا (OCR) | ML Kit document scanner + `mobile_scanner` + UCrop | L | ⭐⭐⭐ | W | الويب: Tesseract.js أو خدمة OCR؛ يحتاج مراجعة يدوية |
| 21 | ديون + أقساط + اشتراكات + مصروفات متكررة | `hub/{debts,installments,subscriptions,recurring-expenses}` | L | ⭐⭐⭐⭐ | W | جدول تكرار + توليد عمليات مستقبلية |
| 22 | مواعيد/استحقاقات + أرشيف فواتير | `hub/{appointments,invoice-archive}` | M | ⭐⭐⭐ | W | يعتمد على 21 |
| 23 | أسعار صرف + عرض متعدد العملات | `hub/exchange-rates` + عملات المحلل | M | ⭐⭐⭐ | W | `fxAmount/fxCurrency` موجودة؛ ينقص مصدر أسعار |
| 24 | مزامنة/نسخ احتياطي سحابي (Drive أو WebDAV أو ملف دوري) + سجل مزامنة | `google_drive/*` | L | ⭐⭐⭐ | W | يتطلب Auth (25) أو تكامل OAuth |
| 25 | مصادقة متعددة المستخدمين + أجهزة/جلسات + وضع ضيف | Google/Passkeys + `devices_screen` + `guest_mode` + `owner_id` | L | ⭐⭐⭐⭐ | W | متطلب سابق للمشاركة والسحابة |
| 26 | حل تعارضات المزامنة الأوفلاين (updatedAt/last-write-wins + سجل) | Hive/sqflite + connectivity | M | ⭐⭐⭐ | W | تحسين `/api/offline` |
| 27 | i18n (ar/en) مع بنية ترجمة | 74 config split + `preferences_screen/language` | M | ⭐⭐ | W | استخراج النصوص من 6 صفحات |
| 28 | مراقبة أخطاء وقياس (Sentry/لوغ) | `sentry_flutter` + Analytics | S | ⭐⭐⭐ | W | مفيد قبل أي نشر واسع |
| 29 | ثيمات + خلفيات بطاقات + ترتيب الاسم | `theme_screen/*` + `cards/` (26) | M | ⭐⭐ | W | تحسين بصري |
| 30 | إحصاءات متقدمة (فترات مرنة، مقارنة، تصدير/مشاركة صورة) | `statistics/*` (22) | M | ⭐⭐⭐ | W | يعتمد على 11 |

### 🟢 P3 / ⚪ P4 — تحفيز ومجتمع وتحقيق (اختياري وخارج الجوهر)

| # | البند | الدليل | الجهد | الأثر | المنصة |
|---|---|---|---|---|---|
| 31 | سلسلة التزام (streak) + شارات | `hub/spending-streak`, Lottie `Flame - Streak`, `flame_off` | M | ⭐⭐ | W |
| 32 | غرف مشتركة + إشراف بموافقات | `shared_rooms`, `supervision/*`, `/invite/delegated` | XL | ⭐⭐ | W |
| 33 | جمعية/دائرة ادخار | `savings_circle/*` | L | ⭐⭐⭐ (محليًا) | W |
| 34 | حيوانات أليفة/تحريك/معسكر | `pets/*`, `mascots/*`, `campfire/*` | L | ⭐ | W |
| 35 | مجتمع توصيات + إحالات | `community/*`, `referral/*` | XL | ⭐ | W |
| 36 | اشتراك مدفوع (Pro) | `in_app_purchase`, `pro_gate`, `drawer/pro` | L | ⭐ | W/A |
| 37 | ودجت أندرويد (7) + مساعد صوتي على مستوى النظام | ودجت Glance + `VoiceInteractionService` | XL | ⭐⭐ | A |
| 38 | **نظافة المستودع**: نقل `reference-apks/*.apk` (22MB) خارج Git (Git LFS أو Release asset أو `.gitignore` + دليل داخلي) | حجم الـpack الحالي 12.59 MiB | S | ⭐⭐ (هندسي) | Repo |

### 🚫 ما لا أنصح بنسخه

`AD_ID`/`ADSERVICES_*`/Install-referrer (تتبع إعلاني) · `ACCESS_*_LOCATION` · `pairip`/`CHECK_LICENSE` و`safe_device` (كشف root) · صلاحيات `FOREGROUND_SERVICE`/`WAKE_LOCK`/`BOOT_COMPLETED` في سياق ويب · نموذج "الحيوانات/المعسكر" كاستثمار مبكر.

---

## 10) توصيات معمارية لو وافقت

1. **ابدأ بالـschema أولًا:** `messages.reasons` (JSON) + `parser_templates` (قوالب موثّقة) + `sender_links` + تفعيل `monthlyBudget/statementDay/dueDay` — كل ده يخدم P0 وP1 بدون إعادة بناء.
2. **افصل "المحلل" عن "السياسة":** المحلل يرجّع حقائق (مبلغ/تاجر/last4/نوع/ثقة)، والسياسة ترجّع قرارًا بأسباب — نفس فصل `SmsParser` عن `SmsPostingPolicy` في التطبيق المرجعي، وده يخلي الاختبارات (`scripts/test-parser.ts`) أسهل.
3. **خلي القوالب الموثّقة بيانات لا كود:** جدول/ملف JSON فيه `id` بإصدار (`bank.template.v1`) — يسمح بـ`minParserVersion` لاحقًا وتحديث القوالب بدون نشر كود.
4. **الخصوصية قبل الميزات الاجتماعية:** أي ميزة تشارك بيانات (غرف/إشراف/مجتمع) تحتاج Auth + سياسة احتفاظ أولًا.
5. **التطبيق الأندرويد المرافق (18) يكون "رفيع":** Receiver + Worker + تشفير محلي + POST لـ`/api/ingest` الموجود حاليًا — بلا واجهة، فيستفيد من كل الاستثمار الحالي في المحلل على السيرفر.

---

## 11) خطوات مقترحة بعد الموافقة

1. تختار الحزمة (P0 كلها / بنود محددة / P0+P1).
2. أفتح فرع العمل على نفس الـPR الحالي وأنفّذ البنود بالترتيب، مع migration + اختبارات `parser:test` لكل تغيير في المحلل.
3. تحديث `README.md` (المميزات + خارطة الطريق) مع كل حزمة.
4. الـPR يفضل مفتوح حتى نخلّص كل التحديثات المتفق عليها (زي ما طلبت).

> ❗ لم يُعدَّل أي ملف في `src/` ضمن هذا التحليل — الإضافات الوحيدة هي وثائق `docs/`.
