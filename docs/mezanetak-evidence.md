# ملحق الأدلة الخام — تحليل `Mezanetak.apk`

> كل ما هنا مستخرج آليًا من الـAPK (بدون تشغيله). الملفات الوسيطة محفوظة خارج المستودع في `/home/user/scratch/`.
> العودة للتحليل: [`mezanetak-analysis.md`](./mezanetak-analysis.md)

## أ) أوامر إعادة الإنتاج

```bash
# 1) فك الـAPK
mkdir -p /tmp/apk && unzip -q reference-apks/Mezanetak.apk -d /tmp/apk

# 2) تثبيت أدوات التحليل الثابت (لا حاجة لـJava/apktool)
pip3 install --break-system-packages androguard   # 4.1.4

# 3) Manifest + موارد + DEX
python3 - <<'EOF'
from androguard.misc import AnalyzeAPK
a, d, dx = AnalyzeAPK('reference-apks/Mezanetak.apk')
print(a.get_package(), a.get_androidversion_name(), a.get_min_sdk_version(), a.get_target_sdk_version())
print(sorted(a.get_permissions()))
print(sorted(a.get_activities()), sorted(a.get_services()), sorted(a.get_receivers()), sorted(a.get_providers()))
sa = dx.get_strings_analysis()          # كل السلاسل النصية في الـDEX مع مراجعها
EOF

# 4) نصوص موارد أندرويد
python3 - <<'EOF'
from androguard.core.apk import APK
a = APK('reference-apks/Mezanetak.apk')
open('res_strings.xml','wb').write(a.get_android_resources().get_strings_resources())
EOF

# 5) جرد الأصول (أسماء الشاشات مستنتجة منها)
find /tmp/apk/assets/flutter_assets -type f | sort
```

## ب) البطاقة التقنية

- **package**: `com.cashflow.expense_tracker`
- **app_name**: `Mezanetak`
- **versionName**: `1.1.4`
- **versionCode**: `100226`
- **minSdk**: `29`
- **targetSdk**: `36`
- **main_activity**: `com.cashflow.expense_tracker.MainActivity`
- **libraries**: `['android.ext.adservices', 'androidx.window.extensions', 'androidx.window.sidecar']`
- **features**: `['android.hardware.camera']`

## ج) الصلاحيات (23)

- `android.permission.ACCESS_ADSERVICES_AD_ID`
- `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`
- `android.permission.ACCESS_COARSE_LOCATION`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.CAMERA`
- `android.permission.FOREGROUND_SERVICE`
- `android.permission.FOREGROUND_SERVICE_SHORT_SERVICE`
- `android.permission.INTERNET`
- `android.permission.MODIFY_AUDIO_SETTINGS`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.READ_MEDIA_AUDIO`
- `android.permission.RECEIVE_BOOT_COMPLETED`
- `android.permission.RECEIVE_SMS`
- `android.permission.RECORD_AUDIO`
- `android.permission.VIBRATE`
- `android.permission.WAKE_LOCK`
- `com.android.vending.BILLING`
- `com.android.vending.CHECK_LICENSE`
- `com.cashflow.expense_tracker.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`
- `com.google.android.c2dm.permission.RECEIVE`
- `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`
- `com.google.android.gms.permission.AD_ID`

### صلاحيات مُعلَنة من التطبيق
- `com.cashflow.expense_tracker.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`

## د) الأنشطة Activities (14)

- `androidx.glance.appwidget.action.ActionTrampolineActivity`
- `androidx.glance.appwidget.action.InvisibleActionTrampolineActivity`
- `com.android.billingclient.api.ProxyBillingActivity`
- `com.android.billingclient.api.ProxyBillingActivityV2`
- `com.cashflow.expense_tracker.MainActivity`
- `com.cashflow.expense_tracker.WidgetActionActivity`
- `com.google.android.gms.auth.api.signin.internal.SignInHubActivity`
- `com.google.android.gms.common.api.GoogleApiActivity`
- `com.google.android.play.core.common.PlayCoreDialogWrapperActivity`
- `com.google.mlkit.vision.documentscanner.internal.GmsDocumentScanningDelegateActivity`
- `com.pairip.licensecheck.LicenseActivity`
- `com.xamdesign.safe_device.MockLocation.MainActivity`
- `com.yalantis.ucrop.UCropActivity`
- `io.flutter.plugins.urllauncher.WebViewActivity`

## هـ) الخدمات Services (19)

- `androidx.camera.core.impl.MetadataHolderService`
- `androidx.core.widget.RemoteViewsCompatService`
- `androidx.glance.appwidget.GlanceRemoteViewsService`
- `androidx.room.MultiInstanceInvalidationService`
- `androidx.work.impl.background.systemjob.SystemJobService`
- `androidx.work.impl.foreground.SystemForegroundService`
- `com.cashflow.expense_tracker.FlowAssistantService`
- `com.cashflow.expense_tracker.FlowAssistantSessionService`
- `com.google.android.datatransport.runtime.backends.TransportBackendDiscovery`
- `com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService`
- `com.google.android.gms.auth.api.signin.RevocationBoundService`
- `com.google.android.gms.measurement.AppMeasurementJobService`
- `com.google.android.gms.measurement.AppMeasurementService`
- `com.google.android.gms.metadata.ModuleDependencies`
- `com.google.firebase.components.ComponentDiscoveryService`
- `com.google.firebase.messaging.FirebaseMessagingService`
- `com.google.mlkit.common.internal.MlKitComponentDiscoveryService`
- `io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingBackgroundService`
- `io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService`

## و) المستقبلات Receivers (23)

- `androidx.glance.appwidget.MyPackageReplacedReceiver`
- `androidx.glance.appwidget.action.ActionCallbackBroadcastReceiver`
- `androidx.profileinstaller.ProfileInstallReceiver`
- `androidx.work.impl.background.systemalarm.RescheduleReceiver`
- `androidx.work.impl.diagnostics.DiagnosticsReceiver`
- `androidx.work.impl.utils.ForceStopRunnable$BroadcastReceiver`
- `com.cashflow.cashflow.CashflowBalanceWidget`
- `com.cashflow.cashflow.CashflowBrainDumpWidget`
- `com.cashflow.cashflow.CashflowBudgetWidget`
- `com.cashflow.cashflow.CashflowExportWidget`
- `com.cashflow.cashflow.CashflowGoalWidget`
- `com.cashflow.cashflow.CashflowQuickActionsWidget`
- `com.cashflow.cashflow.CashflowRecentWidget`
- `com.cashflow.cashflow.CashflowWidgetBootReceiver`
- `com.cashflow.expense_tracker.sms.SmsNotificationActionReceiver`
- `com.cashflow.expense_tracker.sms.SmsReceiver`
- `com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver`
- `com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver`
- `com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver`
- `com.google.android.gms.measurement.AppMeasurementReceiver`
- `com.google.firebase.iid.FirebaseInstanceIdReceiver`
- `dev.fluttercommunity.plus.share.SharePlusPendingIntent`
- `io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingReceiver`

## ز) المزوّدات Providers (10)

- `androidx.startup.InitializationProvider`
- `com.crazecoder.openfile.FileProvider`
- `com.google.firebase.provider.FirebaseInitProvider`
- `com.google.mlkit.common.internal.MlKitInitProvider`
- `com.sidlatau.flutteremailsender.FlutterEmailSenderFileProvider`
- `dev.fluttercommunity.plus.share.ShareFileProvider`
- `io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingInitProvider`
- `io.flutter.plugins.imagepicker.ImagePickerFileProvider`
- `io.sentry.android.core.SentryPerformanceProvider`
- `io.sentry.ndk.SentryNdkPreloadProvider`

## ح) السلاسل النصية المستخرجة من كود التطبيق (Kotlin/DEX)

إجمالي الكلاسات في الـDEX: **16,593**، منها **68** كلاس تطبيق يحمل سلاسل نصية، بمجموع **924** سلسلة.

### `com.cashflow.expense_tracker.sms.parser.SmsBanks` (88)

```
AAIB
ABK
ADIB
AIB
Alexbank
Banque Misr
Banque du Caire
CIB
Crédit Agricole
Emirates NBD
Faisal Bank
Fawry
HSBC
InstaPay
Mashreq
Meeza
NBK
National Bank of Egypt
Orange Cash
QNB
SAIB
Vodafone Cash
WE Pay
aaib
abk
adib
aib
alahly
alexbank
ar
arabinvestment
bankalahly
bankmisr
banqueducaire
banquemisr
bdc
bm
cae
cib
creditagricole
e& cash
ecash
emiratesnbd
enbd
etisalat
etisalatcash
faisal
fawry
fibe
hsbc
instapay
ipn
mashreq
meeza
nbe
nbk
orange
orangecash
qnb
saib
valU
valu
vfcash
vodafone
vodafonecash
wepay
أورنج كاش
إنستاباي
اتصالات كاش
الإمارات دبي الوطني
البنك الأهلي
البنك الأهلي الكويتي
البنك العربي الأفريقي
المشرق
بنك الإسكندرية
بنك الاستثمار العربي
بنك القاهرة
بنك الكويت الوطني
بنك سايب
بنك فيصل
بنك مصر
فودافون كاش
فوري
كريدي أجريكول
مصرف أبوظبي الإسلامي
ميزة
وي باي
ڤاليو
```

### `com.cashflow.expense_tracker.sms.parser.GenericSmsParser` (81)

```
 avail
 balance
 card 
 date 
 dated 
 on 
 ref 
 using 
 via 
 with 
 الرصيد
 الساعه
 المتاح
 ببطاقه
 بتاريخ
 بطاقه
 رصيد
 رقم 
 في 
 كارت
 للمزيد
 يوم
(?:\bat\b|\bfrom merchant\b|\bmerchant:?|لدى|لدي|عند|في متجر|من التاجر|التاجر:?)\s*(?<m>[^\n]{2,80})
(?:card|account|acct|a/c|ending|ending with|بطاقه|البطاقه|كارت|الكارت|حساب|الحساب|المنتهي|المنتهيه|ينتهي)[^\d\n]{0,25}?(?:[*x•#]+)?(?<d>\d{4})(?!\d)
(?<![\d.,])(?<n>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?|\.\d{1,2})\s?
(?<c>(?:
(?<c>(?<![a-z\d])(?:
)(?![a-z])|(?:
)(?![ء-ي])|(?:
))
)|(?<![ء-ي\d])(?:
)|(?<!\d)(?:
. 
AED
Collection contains no element matching the predicate.
EGP
EUR
GBP
SAR
USD
\batm
\s?(?<n>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?|\.\d{1,2})(?!\d)
aed
avail bal
available balance
available limit
avl bal
bal 
balance
c
d
egp
eur
e£
gbp
l.e
l.e.
le
limit is
m
n
sar
usd
£
الحد المتاح
الرصيد
المتاح
ج.م
ج.م.
جم
جنية
جنيه
جنيها
جنيهات
درهم
دولار
رصيد
رصيدك
ريال
يورو
€
```

### `com.cashflow.expense_tracker.sms.parser.SmsVocabulary` (58)

```
atm
canceled
cancelled
cash withdrawal
charged
credited
debit
debited
deducted
deposit
deposited
incoming transfer
paid
payment
pos
purchase
purchased
received
refund
refunded
reversal
reversed
sent to
spent
transfer to
transferred
withdrawal
withdrawn
you sent
أرسلت
إرسال
إضافة
إلغاء
إيداع
استرجاع
استرداد
استلام
استلمت
تحويل
تحويل وارد
تم إضافة
تم تحويل
تم خصم
حولت
خصم
دفع
رد مبلغ
سحب
سحب نقدي
سداد
شراء
صراف
عملية شراء
مدفوعات
مدين
مرتجع
مشتريات
وارد
```

### `com.cashflow.expense_tracker.sms.store.SmsCandidateStore` (54)

```
 AND (kind IS NULL OR kind NOT IN (
 unreadable
'
))
Failed requirement.
SELECT COUNT(*) FROM candidates WHERE owner_id = ? AND state = ? AND lease_until <= ?
SmsStore
UPDATE candidates SET attempts = attempts + 1, lease_until = 0, state = CASE WHEN attempts + 1 >= 5 THEN ? ELSE state END, settled_at = CASE WHEN attempts + 1 >= 5 THEN ? ELSE NULL END WHERE id = ? AND state = ?
account_id
amount_sealed
attempts
body_sealed
budget_group_id
candidates
category
confidence
created_at
created_at ASC
currency
discarded
discarded 
enabled
error
exists
id
id = ?
id = ? AND owner_id = ? AND state = ? AND account_id IS NOT NULL AND (currency IS NULL OR currency = 'EGP') AND (kind IS NULL OR kind NOT IN ('TRANSFER_IN', 'REFUND'))
id = ? AND owner_id = ? AND state IN (?, ?)
id = ? AND state = ?
kind
last4
lease_until
merchant_sealed
noAccount
occurred_at
occurred_at DESC
owner_id
owner_id = ?
owner_id = ? AND state = ?
owner_id = ? AND state = ? AND lease_until <= ?
owner_id = ? AND state IN (?, ?, ?)
owner_settings
pending
reasons
review
sender
settled_at
settled_at DESC
source_links
state
template_id
updated_at
words
written
```

### `com.cashflow.expense_tracker.MainActivity` (53)

```
%02X
Assistant role request is already open
ERROR
Failed to create MediaStore record
Failed to open output stream
INVALID_ARGS
ROLE_REQUEST_ACTIVE
SAVE_FAILED
SHA-256
_display_name
android.app.role.ASSISTANT
android.intent.action.SEND
android.intent.extra.TEXT
android.settings.MANAGE_DEFAULT_APPS_SETTINGS
android.settings.SETTINGS
android.settings.VOICE_INPUT_SETTINGS
application/octet-stream
assistantSelected
cashflow/file_saver
cashflow/flow_wake
cashflow/launch
cashflow/shared_text
com.cashflow/security
content
contentBytes
contentBytes or content is required
enabled
fileName
fileName is required
flow_wake_listener
getSigningFingerprint
getStatus
getWidgetAction
is_pending
lastError
mimeType
mime_type
onFlowWake
onSharedText
onWidgetAction
openAssistantSettings
pause
relative_path
requestAssistantRole
resume
running
saveToDownloads
start
stop
supported
takePendingLaunch
takeSharedText
text/
```

### `com.cashflow.expense_tracker.sms.parser.SmsExclusions` (43)

```
+ -()
activation code
could not be completed
declined
do not share
don't share
failed
insufficient
never share
not successful
one time password
one-time password
otp
passcode
rejected
security code
unsuccessful
verification code
was not completed
الرصيد غير كافي
الرقم السري المؤقت
تعذر
تم رفض
رصيد غير كاف
رفض
رمز التأكيد
رمز التحقق
رمز التفعيل
رمز المرور
غير ناجحة
فشل
فشلت
كلمة السر المؤقتة
كلمة المرور لمرة واحدة
كود التحقق
كود التفعيل
لا تشارك
لا تعطي
لا تفصح
لم تتم
لم يتم
مرفوض
مرفوضة
```

### `com.cashflow.expense_tracker.sms.SmsTrackingChannel` (41)

```
accountId
android.permission.RECEIVE_SMS
autoFile
autoPostEnabled
bank
budgetGroupId
cashflow/sms_tracking
category
changed
claimPending
enabled
getServerGate
getSettings
history
id
isAvailable
label
last4
launchRoute
links
minParserVersion
outcome
owner
owner is required
pendingCount
purgeOwner
removeLink
resolve
reviewCount
reviewItems
saveLink
sender
setNotificationStrings
setServerGate
setSettings
settle
state
store
takeLaunchRoute
undo
unlinkAccount
```

### `com.cashflow.expense_tracker.sms.store.SmsCandidate` (35)

```
, accountId=
, amount=
, attempts=
, body=
, budgetGroupId=
, category=
, confidence=
, createdAt=
, currency=
, kind=
, last4=
, merchant=
, occurredAt=
, ownerId=
, reasons=
, sender=
, state=
, templateId=
SmsCandidate(id=
accountId
amount
body
budgetGroupId
category
confidence
currency
id
kind
last4
merchant
occurredAt
ownerId
reasons
sender
state
```

### `com.cashflow.expense_tracker.sms.SmsNotifier` (33)

```
 · 
%,.0f
%,.2f
EGP
REFUND
SMS
TRANSFER_IN
actionDismiss
actionFile
approve:
categoryNames
channelName
com.cashflow.expense_tracker.sms.DISMISS
com.cashflow.expense_tracker.sms.FILE
currencySymbol
heldHint
heldPublic
lang
log
mezanetak_sms_notification_strings
mezanetak_sms_route
needsApp
noAccount
sms_tracking
titleExpense
titleIncome
waitingHint
written
writtenHint
writtenPublic
{amount}
{}
•••• 
```

### `com.cashflow.expense_tracker.sms.SmsWordCalls` (26)

```
BANK
accountId
amount
bank
body
builtIn
category
currency
excluded
hidden
kind
last4
matchedWord
merchant
original
preview
protected
removeWord
restoreWords
ruleLabel
saveWord
sender
text
unknown 
word
words
```

### `com.cashflow.cashflow.CashflowRecentWidget` (23)

```
+
Add
No transactions yet
Other
Recent
Today
Yesterday
[]
add
amount
currency
isIncome
months
name
noTransactions
open
other
recent
recent_transactions
today
ts
yesterday
−
```

### `com.cashflow.expense_tracker.sms.store.SmsSourceLinkStoreKt` (22)

```
UNLINKED_SOURCE
account_id
auto_file
budget_group_id
candidates
category
created_at
created_at ASC
label
last4
lease_until
owner_id
owner_id = ?
owner_id = ? AND account_id = ?
owner_id = ? AND account_id = ? AND state IN (?, ?)
owner_id = ? AND sender_key = ? AND last4 = ?
pending
reasons
review
sender_key
source_links
state
```

### `com.cashflow.cashflow.CashflowBalanceWidget` (19)

```
Balance
Budget left
HomeWidgetPreferences
Income
Open app
Spent
balance
budgetLeft
budget_total
budget_used
currency
income
monthly_expense
monthly_income
open
spent
tapToStart
w_synced_at
—
```

### `com.cashflow.cashflow.CashflowBudgetWidget` (18)

```
 / 
%
Budget
No budget set
No category budgets yet
Other
[]
budget
budget_total
budget_used
cap
category_budgets
currency
name
noBudget
noCategoryBudgets
other
spent
```

### `com.cashflow.expense_tracker.sms.store.NewSmsCandidate` (18)

```
, accountId=
, amount=
, body=
, budgetGroupId=
, category=
, confidence=
, currency=
, kind=
, last4=
, merchant=
, occurredAt=
, ownerId=
, reasons=
, sender=
, state=
, templateId=
NewSmsCandidate(id=
pending
```

### `com.cashflow.expense_tracker.sms.store.SmsCandidateDb` (17)

```
ALTER TABLE candidates ADD COLUMN 
ALTER TABLE source_links ADD COLUMN auto_file INTEGER NOT NULL DEFAULT 1
ALTER TABLE source_links ADD COLUMN category TEXT
ALTER TABLE source_links ADD COLUMN label TEXT
CREATE INDEX candidates_owner_state ON candidates(owner_id, state)
CREATE TABLE candidates (\n  id TEXT PRIMARY KEY,\n  owner_id TEXT NOT NULL,\n  state TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  occurred_at INTEGER NOT NULL,\n  amount_sealed BLOB NOT NULL,\n  merchant_sealed BLOB,\n  body_sealed BLOB,\n  account_id TEXT,\n  category TEXT,\n  lease_until INTEGER NOT NULL DEFAULT 0,\n  attempts INTEGER NOT NULL DEFAULT 0,\n  settled_at INTEGER\n)
CREATE TABLE owner_settings (\n  owner_id TEXT PRIMARY KEY,\n  enabled INTEGER NOT NULL DEFAULT 0,\n  auto_post INTEGER NOT NULL DEFAULT 0,\n  updated_at INTEGER NOT NULL\n)
CREATE TABLE source_links (\n  owner_id TEXT NOT NULL,\n  sender_key TEXT NOT NULL,\n  last4 TEXT NOT NULL DEFAULT '',\n  account_id TEXT NOT NULL,\n  budget_group_id TEXT,\n  approved_count INTEGER NOT NULL DEFAULT 0,\n  created_at INTEGER NOT NULL,\n  PRIMARY KEY (owner_id, sender_key, last4)\n)
CREATE TABLE words (\n  owner_id TEXT NOT NULL,\n  word_key TEXT NOT NULL,\n  kind TEXT NOT NULL,\n  display TEXT NOT NULL,\n  category TEXT,\n  origin TEXT NOT NULL,\n  created_at INTEGER NOT NULL,\n  PRIMARY KEY (owner_id, word_key, kind)\n)
budget_group_id TEXT
confidence TEXT
currency TEXT
kind TEXT
last4 TEXT
reasons TEXT
sender TEXT
template_id TEXT
```

### `com.cashflow.cashflow.CashflowGoalWidget` (15)

```
%
Goal
No active goal
Remaining
Target
currency
goal
goals
name
noGoal
pct
remaining
saved
target
top_goal
```

### `com.cashflow.expense_tracker.sms.store.SmsWordStoreKt` (15)

```
category
created_at
created_at DESC
display
empty word
hidden
kind
origin
owner_id
owner_id = ?
owner_id = ? AND origin = ?
owner_id = ? AND word_key = ? AND kind = ? AND origin = ?
user
word_key
words
```

### `com.cashflow.expense_tracker.sms.SmsProcessingWorker` (14)

```
), attempt 
SmsWorker
call to 'resume' before 'invoke' with coroutine
candidates
deferred (
engine timed out
hive owned elsewhere
ownerClaimed
probe
purge report: 
purgeExpenseId
report: 
results
ui attached
```

### `com.cashflow.expense_tracker.sms.SmsIntake` (7)

```
%02x
SHA-256
SmsIntake
decision 
excluded: 
pending
review
```

### `com.cashflow.expense_tracker.sms.parser.SmsParseResult$Transaction` (10)

```
, amount=
, category=
, confidence=
, currency=
, last4=
, matchedWord=
, merchant=
, occurredAt=
, templateId=
Transaction(kind=
```

### `com.cashflow.expense_tracker.WidgetActionStore` (10)

```
add
braindump
budget
cashflow_widget_action_store
export
goals
open
pending_action
scan
voice
```

### `com.cashflow.expense_tracker.sms.parser.SmsText` (9)

```
\s+
ال
ب
بال
ف
ل
لل
و
وال
```

### `com.cashflow.cashflow.CashflowWidgetBootReceiver` (9)

```
CashflowWidget
android.intent.action.BOOT_COMPLETED
android.intent.action.DATE_CHANGED
android.intent.action.LOCALE_CHANGED
android.intent.action.MY_PACKAGE_REPLACED
android.intent.action.QUICKBOOT_POWERON
android.intent.action.TIMEZONE_CHANGED
android.intent.action.TIME_SET
boot refresh failed: 
```

### `com.cashflow.expense_tracker.sms.policy.SmsDecisionReason` (9)

```
AUTO_POST_OFF
AUTO_POST_PAUSED
FOREIGN_CURRENCY
KIND_NEEDS_REVIEW
PARSER_OUTDATED
SERVER_PAUSED
TRACKING_OFF
UNLINKED_SOURCE
UNVERIFIED_FORMAT
```

### `com.cashflow.expense_tracker.sms.SmsNotificationActionReceiver` (8)

```
SmsNotifAction
action failed: 
candidateId
com.cashflow.expense_tracker.sms.DISMISS
com.cashflow.expense_tracker.sms.FILE
discarded
dismissed from notification
filed from notification
```

### `com.cashflow.expense_tracker.sms.parser.SmsTemplateRegistry` (8)

```
Banque Misr
EGP
^تم اضافه مبلغ (?<amount>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?) ?egp الي حساب رقم x+(?<last4>\d{4}) في 
^تم تحويل مبلغ (?<amount>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?) ?egp من حساب رقم x+(?<last4>\d{4}) في 
banque-misr.purchase.v1
banque-misr.transfer-in.v1
banque-misr.transfer-out.v1
بطاقه بنك مصر \*+(?<last4>\d{4})، تم الان خصم (?<amount>\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?) ?egp ?عند (?<merchant>.+?) يوم \d{2}/\d{2}/\d{4}
```

### `com.cashflow.expense_tracker.sms.policy.SmsSourceLink` (7)

```
, accountId=
, autoFile=
, budget=
, category=
, label=
, last4=
SmsSourceLink(sender=
```

### `com.cashflow.cashflow.CashflowQuickActionsWidget` (7)

```
Add
QuickActions
Scan
Voice
add
scan
voice
```

### `com.cashflow.expense_tracker.FlowLiveAudioRoute` (7)

```
Could not restore the audio route: 
Could not route Flow Live to the speaker: 
FlowLiveAudioRoute
audio
cashflow/flow_live_audio
release
routeToSpeaker
```

### `com.cashflow.expense_tracker.sms.parser.SmsWordKind` (7)

```
DEBIT
IGNORE
PURCHASE
REFUND
TRANSFER_IN
TRANSFER_OUT
WITHDRAWAL
```

### `com.cashflow.expense_tracker.sms.store.KeystoreFieldCipher` (7)

```
AES
AES/GCM/NoPadding
AndroidKeyStore
GCM
NoPadding
mezanetak_sms_candidates_v1
sealed field too short
```

### `com.cashflow.cashflow.CashflowBrainDumpWidget` (6)

```
Brain dump
BrainDump
Write it all — we'll split it up
brainDump
brainDumpSubtitle
braindump
```

### `com.cashflow.expense_tracker.sms.SmsIntake$Outcome` (6)

```
DROPPED
DUPLICATE
EXCLUDED
HELD_FOR_REVIEW
NO_OWNER
QUEUED
```

### `com.cashflow.expense_tracker.sms.parser.SmsExclusion` (6)

```
FAILED
NO_AMOUNT
NO_TRANSACTION
OTP
PERSONAL_SENDER
USER_IGNORED
```

### `com.cashflow.expense_tracker.sms.parser.SmsTemplate` (5)

```
, currency=
, kind=
, pattern=
, senders=
SmsTemplate(id=
```

### `com.cashflow.expense_tracker.sms.parser.SmsTransactionKind` (6)

```
DEBIT
PURCHASE
REFUND
TRANSFER_IN
TRANSFER_OUT
WITHDRAWAL
```

### `com.cashflow.cashflow.CashflowExportWidget` (5)

```
Export
Export data
PDF and Excel reports
export
exportSubtitle
```

### `com.cashflow.expense_tracker.b` (3)

```
 = 
[
]
```

### `com.cashflow.expense_tracker.sms.SmsHeadlessEngine$run$2` (5)

```
call to 'resume' before 'invoke' with coroutine
cashflow/sms_headless
complete
smsHeadlessMain
takeWork
```

### `com.cashflow.expense_tracker.sms.parser.SmsParser` (3)

```
amount
last4
merchant
```

### `com.cashflow.expense_tracker.sms.parser.SmsWord` (4)

```
, builtIn=
, category=
, kind=
SmsWord(text=
```

### `com.cashflow.expense_tracker.sms.policy.SmsDecision` (4)

```
, accountId=
, budgetGroupId=
, reasons=
SmsDecision(action=
```

### `com.cashflow.expense_tracker.sms.SmsReceiver` (3)

```
SmsReceiver
android.provider.Telephony.SMS_RECEIVED
intake failed: 
```

### `com.cashflow.expense_tracker.sms.SmsServerGateStore` (4)

```
autoPostEnabled
enabled
mezanetak_sms_server_gate
minParserVersion
```

### `com.cashflow.expense_tracker.sms.parser.SmsBanks$Bank` (3)

```
, ar=
, en=
Bank(keys=
```

### `com.cashflow.expense_tracker.sms.parser.SmsMessage` (3)

```
, body=
, receivedAt=
SmsMessage(sender=
```

### `com.cashflow.expense_tracker.sms.policy.SmsServerGate` (3)

```
, autoPostEnabled=
, minParserVersion=
SmsServerGate(enabled=
```

### `com.cashflow.expense_tracker.FlowAssistantPreferences` (3)

```
enabled
flow_wake_preferences
last_error
```

### `com.cashflow.expense_tracker.sms.SmsOwner` (3)

```
FlutterSharedPreferences
flutter.guest_mode
flutter.hive_active_scope_owner_v1
```

### `com.cashflow.expense_tracker.sms.SmsProcessingWorker$Companion` (3)

```
mezanetak_sms_process
probe
purgeExpenseId
```

### `com.cashflow.expense_tracker.sms.policy.SmsDecisionAction` (3)

```
AUTO_POST
DROP
REVIEW
```

### `com.cashflow.expense_tracker.sms.store.SmsOwnerSettings` (2)

```
SmsOwnerSettings(enabled=
enabled
```

### `com.cashflow.expense_tracker.FlowAssistantLaunchStore` (2)

```
flow_wake_launch
pending
```

### `com.cashflow.expense_tracker.sms.SmsNotificationActions` (2)

```
candidateId
com.cashflow.expense_tracker.sms.FILE
```

### `com.cashflow.expense_tracker.sms.b` (2)

```
Failed to process view hierarchy.
android_view_system
```

### `com.cashflow.expense_tracker.sms.parser.SmsConfidence` (2)

```
GENERIC
VERIFIED
```

### `com.cashflow.expense_tracker.sms.parser.SmsParseResult$Excluded` (1)

```
Excluded(reason=
```

### `com.cashflow.expense_tracker.sms.policy.SmsBudgetPolicy$FixedBudget` (1)

```
FixedBudget(budgetGroupId=
```

### `com.cashflow.expense_tracker.sms.policy.SmsPostingPolicy` (2)

```
*
EGP
```

### `com.cashflow.expense_tracker.sms.store.SmsCandidateStore$1` (2)

```
currentTimeMillis
currentTimeMillis()J
```

### `com.cashflow.expense_tracker.sms.store.SmsCandidateStore$Companion` (2)

```
mezanetak_sms_candidates.db
mezanetak_sms_candidates_v0
```

### `com.cashflow.expense_tracker.WidgetActionActivity` (1)

```
widget_action
```

### `com.cashflow.expense_tracker.a` (1)

```
Must set a non-null database name to a configuration that uses the no backup directory.
```

### `com.cashflow.expense_tracker.sms.SmsHeadlessEngine$run$2$2` (1)

```
call to 'resume' before 'invoke' with coroutine
```

### `com.cashflow.expense_tracker.sms.SmsLaunchRoute` (1)

```
mezanetak_sms_route
```

### `com.cashflow.expense_tracker.sms.c` (1)

```
Taking screenshot failed (view.draw).
```

### `com.cashflow.expense_tracker.sms.policy.SmsBudgetPolicy$ActiveBudget` (1)

```
ActiveBudget
```
## ط) إضافات Flutter المُسجَّلة (42) — من `GeneratedPluginRegistrant`

| الإضافة | الدلالة الوظيفية |
|---|---|
| `app_links` | روابط عميقة / App Links |
| `audioplayers_android` | تشغيل أصوات (نجاح العملية، إشعار، معسكر) |
| `connectivity_plus` | كشف الاتصال → وضع أوفلاين |
| `device_info_plus` | معلومات الجهاز (الأجهزة/الجلسات) |
| `emoji_picker_flutter` | لوحة إيموجي (المجتمع/التعليقات) |
| `file_picker` | اختيار ملفات (استيراد/أرشيف فواتير) |
| `firebase_analytics` | قياس استخدام |
| `firebase_core` | تهيئة Firebase |
| `firebase_in_app_messaging` | رسائل داخل التطبيق (حملات) |
| `firebase_messaging` | إشعارات Push (FCM) |
| `flutter_email_sender` | إرسال تقارير/ملفات بالبريد |
| `flutter_keyboard_visibility` | تحكم في الواجهة مع الكيبورد |
| `flutter_local_notifications` | تنبيهات محلية مجدولة (تذكيرات) |
| `flutter_pcm_sound` | تسجيل PCM خام (كلمة إيقاظ/مساعد صوتي) |
| `flutter_plugin_android_lifecycle` | دورة حياة أندرويد للـplugins |
| `flutter_secure_storage` | تخزين آمن للمفاتيح |
| `flutter_timezone` | المنطقة الزمنية للتذكيرات |
| `google_mlkit_document_scanner` | مسح المستندات/الإيصالات |
| `google_sign_in_android` | تسجيل دخول Google |
| `home_widget` | جسر بيانات الودجت (SharedPreferences) |
| `image_cropper` | قص الصور (UCrop) |
| `image_picker_android` | كاميرا/جاليري |
| `in_app_purchase_android` | اشتراك Pro (فوترة Play) |
| `in_app_review` | طلب تقييم داخل التطبيق |
| `in_app_update` | تحديث داخل التطبيق |
| `jni` | ربط Dart بمكتبات أصلية (JNIgen) |
| `mobile_scanner` | مسح باركود/QR |
| `open_filex` | فتح ملف خارجي |
| `package_info_plus` | معلومات الإصدار |
| `path_provider_android` | مسارات الملفات |
| `pdfx` | عرض/معالجة PDF |
| `permission_handler_android` | طلب الصلاحيات |
| `record_android` | تسجيل صوتي (الإدخال الصوتي) |
| `safe_device` | كشف root/mocks/mock location |
| `sensors_plus` | حساسات (إيماءة الهزّ) |
| `sentry_flutter` | مراقبة الأخطاء والأداء |
| `share_plus` | مشاركة ملفات/نصوص |
| `shared_preferences_android` | تفضيلات محلية |
| `sqflite_android` | قاعدة بيانات SQLite لـDart |
| `url_launcher_android` | فتح روابط خارجية |
| `webview_flutter_android` | متصفح داخلي |
| `workmanager_android` | مهام خلفية مجدولة |

## ي) نصوص `resources.arsc` (87 سلسلة؛ المعروض ما يخص التطبيق/التكاملات)

```xml
<string name="app_name">Mezanetak</string>
<string name="default_web_client_id">340085000934-83gckq7t7q5qfeuo3nf9c2es4bmaf04s.apps.googleusercontent.com</string>
<string name="fcm_fallback_notification_channel_label">Miscellaneous</string>
<string name="flow_assistant_name">Flow Live</string>
<string name="gcm_defaultSenderId">340085000934</string>
<string name="google_api_key">AIzaSyAa6uQqtvaDzhwroDNsLVwfj7BnafKYfEg</string>
<string name="google_app_id">1:340085000934:android:66dbef9092e91a2f164927</string>
<string name="google_crash_reporting_api_key">AIzaSyAa6uQqtvaDzhwroDNsLVwfj7BnafKYfEg</string>
<string name="google_storage_bucket">mezanetak.firebasestorage.app</string>
<string name="project_id">mezanetak</string>
<string name="widget_balance_desc">Account balance and monthly summary</string>
<string name="widget_brain_dump_desc">Write a whole day of spending at once</string>
<string name="widget_budget_desc">Budget usage by category</string>
<string name="widget_export_desc">Open PDF and Excel reports</string>
<string name="widget_goal_desc">Savings goal progress</string>
<string name="widget_quick_actions_desc">Quick voice, scan, and add buttons</string>
<string name="widget_recent_desc">Recent transactions</string>
```

## ك) جرد أصول Flutter (561 ملفًا) — أسماء الشاشات والمميزات مستنتجة منها

### `AssetManifest.bin` (1)

```
AssetManifest.bin
```

### `FontManifest.json` (1)

```
FontManifest.json
```

### `NOTICES.Z` (1)

```
NOTICES.Z
```

### `NativeAssetsManifest.json` (1)

```
NativeAssetsManifest.json
```

### `assets/SVG/account_types` (19)

```
bank.svg, business.svg, car.svg, card.svg, cash.svg, charity.svg
children.svg, crypto.svg, digital_wallet.svg, education.svg, emergency.svg, family.svg
gold.svg, investment.svg, other.svg, salary.svg, savings.svg, shared.svg
travel.svg
```

### `assets/SVG/add_expense_screen` (23)

```
calculator.svg, camera.svg, category.svg, chart.svg, check.svg, clock.svg
close-circle.svg, close.svg, document.svg, gallery.svg, list.svg, money.svg
move-transaction.svg, note.svg, person.svg, plus.svg, repeat.svg, scan.svg
search.svg, shop.svg, swap.svg, transfer.svg, wallet.svg
```

### `assets/SVG/all_expenses_screen` (1)

```
pdf.svg
```

### `assets/SVG/assets` (1)

```
silver.svg
```

### `assets/SVG/auth` (3)

```
lock.svg, mail.svg, reset-password.svg
```

### `assets/SVG/budget` (3)

```
budget-type.svg, more.svg, wallet.svg
```

### `assets/SVG/calendar_dialog` (4)

```
cumulative.svg, custom-date.svg, month.svg, today.svg
```

### `assets/SVG/campfire` (5)

```
fire_flames.svg, fire_pit.svg, firewood.svg, foreground_grass.svg, night_backdrop.svg
```

### `assets/SVG/cards` (26)

```
ana_naym_card_bg.svg, ash_ember_card.svg, ash_guilloche_card.svg, charcoal_luxe_card_bg.svg, crimson_lynx_card_bg.svg, el3ay2a_purple_card.svg
farid_paper_card.svg, gold_card_bg.svg, gold_tree_card.svg, midnight_wave_card.svg, neubrutal_slab_card.svg, romana_lacquer_card.svg
rose_blush_card_bg.svg, rose_cat_card.svg, sage_card_bg.svg, saving3d_stack_card.svg, sayed_mint_card.svg, slate_purple_card_bg.svg
streak_flame_card_bg.svg, streak_shore_card.svg, taco_fiesta_card_bg.svg, taco_marble_card.svg, teal_graphite_card_bg.svg, temo_copper_card.svg
unique_card_bg.svg, warm_copper_card_bg.svg
```

### `assets/SVG/categories` (27)

```
bills.svg, coffe.svg, debt.svg, education.svg, entertainment.svg, family.svg
food.svg, fuel.svg, gift.svg, grocery.svg, health.svg, home.svg
income.svg, installment.svg, insurance.svg, internet.svg, maintenance.svg, other.svg
personal_care.svg, phone.svg, rent.svg, saving.svg, shopping.svg, sport.svg
subscription.svg, transport.svg, travel.svg
```

### `assets/SVG/categories_screen` (4)

```
categories.svg, edit.svg, my-categories.svg, subcategories.svg
```

### `assets/SVG/community` (12)

```
area.svg, comment.svg, confirm.svg, empty.svg, everywhere.svg, experience.svg
pin.svg, price.svg, question.svg, recommendation.svg, send.svg, useful.svg
```

### `assets/SVG/core` (12)

```
app_logo.svg, back-rtl.svg, ban.svg, budget.svg, check-circle.svg, chevron-down.svg
chevron-rtl.svg, info.svg, logout.svg, refresh.svg, trash.svg, whatsapp.svg
```

### `assets/SVG/devices_screen` (2)

```
device-current.svg, device.svg
```

### `assets/SVG/drawer` (13)

```
chevron.svg, dark-mode.svg, delete.svg, feedback.svg, globe.svg, light-mode.svg
login.svg, pro.svg, profile.svg, reset.svg, settings.svg, shield.svg
whats-new.svg
```

### `assets/SVG/export_screen` (4)

```
chevron-up.svg, excel-color.svg, pdf-color.svg, spreadsheet.svg
```

### `assets/SVG/flame_off.svg` (1)

```
flame_off.svg
```

### `assets/SVG/flow_live` (2)

```
flow-live.svg, mic-off.svg
```

### `assets/SVG/google_drive` (4)

```
auto-sync.svg, cloud-upload.svg, reports.svg, restore.svg
```

### `assets/SVG/home_screen` (15)

```
add-circle.svg, arrow-up.svg, calendar.svg, eye-slash.svg, eye.svg, filter.svg
hub.svg, menu.svg, offline.svg, receipt.svg, sort.svg, stop.svg
telegram.svg, voice.svg, wallets.svg
```

### `assets/SVG/home_signals` (10)

```
allowance.svg, cards.svg, drift.svg, dues.svg, pace-over.svg, pace-under.svg
pulse.svg, quiet.svg, repeat.svg, unusual.svg
```

### `assets/SVG/hub_screen` (27)

```
appointments.svg, back.svg, brain-dump.svg, chevron-right.svg, close-circle.svg, community.svg
customize.svg, debts.svg, exchange-rates.svg, flow-ai.svg, goals.svg, google-drive.svg
holdings.svg, import-expenses.svg, installments.svg, invoice-archive.svg, recurring-expenses.svg, reports.svg
savings-circle.svg, search.svg, shared-rooms.svg, shopping.svg, smart-categories.svg, spending-streak.svg
subscriptions.svg, supervision.svg, voice.svg
```

### `assets/SVG/loader` (2)

```
loader_mascot.svg, loader_ring.svg
```

### `assets/SVG/mascots` (12)

```
bear.svg, bird.svg, cat.svg, caterpillar.svg, chick.svg, flame.svg
hero.svg, rooster.svg, sleeping-cat.svg, snail.svg, taco.svg, watermelon.svg
```

### `assets/SVG/morning_path.svg` (1)

```
morning_path.svg
```

### `assets/SVG/navbar` (14)

```
add.svg, appointments.svg, community.svg, debts.svg, exchange-rates.svg, flow-ai.svg
goals.svg, home.svg, invoice-archive.svg, plus.svg, reports.svg, shared-rooms.svg
shopping.svg, supervision.svg
```

### `assets/SVG/night_path_nature.svg` (1)

```
night_path_nature.svg
```

### `assets/SVG/notebook_thankyou_background.svg` (1)

```
notebook_thankyou_background.svg
```

### `assets/SVG/onboarding_screen` (5)

```
financial_statistics.svg, flow_ai_financial_assistant.svg, pdf_financial_reports.svg, smart_receipt_scanner.svg, smart_voice_expense_entry.svg
```

### `assets/SVG/preferences_screen` (3)

```
appearance.svg, currency.svg, language.svg
```

### `assets/SVG/pro_gate` (1)

```
brain-dump.svg
```

### `assets/SVG/profile_screen` (15)

```
add-account.svg, back-arrow.svg, chat.svg, cloud-backup.svg, copy.svg, eye.svg
id-card.svg, login.svg, logout.svg, premium.svg, profile.svg, receipt-scan.svg
scan-code.svg, settings.svg, voice.svg
```

### `assets/SVG/referral` (3)

```
friends.svg, redeem.svg, referral.svg
```

### `assets/SVG/savings_circle` (8)

```
draw.svg, empty.svg, late.svg, member.svg, organizer.svg, pot.svg
turn.svg, world.svg
```

### `assets/SVG/settings_screen` (19)

```
apartment.svg, bell.svg, building.svg, campfire.svg, check.svg, cloud.svg
delete-sweep.svg, error.svg, game-controller.svg, lock.svg, name-order.svg, report.svg
shake.svg, sound.svg, star.svg, tap.svg, themes.svg, voice-review.svg
warning.svg
```

### `assets/SVG/shopping_screen` (3)

```
basket-add.svg, message-to-list.svg, shopping-bag.svg
```

### `assets/SVG/sms_tracking` (1)

```
bank_message.svg
```

### `assets/SVG/statistics` (22)

```
calendar.svg, category.svg, check-circle.svg, check.svg, chevron-left.svg, chevron-right.svg
close.svg, download.svg, filter.svg, fire.svg, grid.svg, list-view.svg
moon.svg, payments.svg, pie-chart.svg, repeat.svg, share.svg, swap.svg
trending-down.svg, trending-up.svg, wallet.svg, week.svg
```

### `assets/SVG/subcategories` (104)

```
apps.svg, baby_bottle.svg, ball.svg, beans.svg, bed.svg, bolt.svg
books.svg, box.svg, broom.svg, building.svg, bulb.svg, burger.svg
bus.svg, cake.svg, car.svg, car_wash.svg, card.svg, certificate.svg
chart.svg, cloud.svg, coins.svg, crescent.svg, croissant.svg, donut.svg
drop.svg, dumbbell.svg, faucet.svg, ferris.svg, flame.svg, flask.svg
fuel_pump.svg, gamepad.svg, gas_tank.svg, gear.svg, glasses.svg, gold.svg
hands_heart.svg, headphones.svg, hospital.svg, jersey.svg, juice.svg, key.svg
laptop.svg, lifebuoy.svg, lipstick.svg, lotus.svg, map.svg, meat.svg
medical_bag.svg, metro.svg, milk.svg, mobile_data.svg, music.svg, notebook.svg
oil_can.svg, palette.svg, pan.svg, parking.svg, party.svg, passport.svg
paw.svg, pencil.svg, people.svg, perfume.svg, pill.svg, plane.svg
plant.svg, plug.svg, popcorn.svg, receipt.svg, restaurant.svg, ring.svg
road.svg, roller.svg, router.svg, sandwich.svg, school.svg, scissors.svg
scooter.svg, shaker.svg, shield_car.svg, shield_cross.svg, shield_heart.svg, shield_house.svg
shoe.svg, smartphone.svg, sofa.svg, spray.svg, store.svg, suitcase.svg
swim.svg, takeaway.svg, taxi.svg, tea.svg, ticket.svg, tooth.svg
toothbrush.svg, trash.svg, tshirt.svg, tv.svg, van.svg, vegetables.svg
video_course.svg, watch.svg
```

### `assets/SVG/subscriptions` (4)

```
catalog.svg, cloud.svg, music.svg, stream.svg
```

### `assets/SVG/supervision` (11)

```
approve.svg, binoculars.svg, chat.svg, copy.svg, history.svg, illustration.svg
keyboard.svg, link.svg, unlink.svg, unlock.svg, user-add.svg
```

### `assets/SVG/theme_screen` (10)

```
brightness.svg, card-background.svg, checkbox.svg, hash.svg, magic-star.svg, paintbrush.svg
pause.svg, paw.svg, play.svg, timer.svg
```

### `assets/SVG/update_welcome` (1)

```
release_bloom.svg
```

### `assets/SVG/whats_new` (2)

```
gift.svg, play.svg
```

### `assets/certs` (1)

```
ca_bundle.pem
```

### `assets/fonts` (4)

```
ArefRuqaa-Regular.ttf, Cairo-VariableFont_slnt,wght.ttf, Inter-VariableFont_opsz,wght.ttf, NotoNaskhArabic-Regular.ttf
```

### `assets/images` (20)

```
app_icon.png, app_icon_foreground.png, appicon.webp, banimage.webp, batman_logo_theme.webp, categories%20.webp
coin.webp, dollar.webp, financial_tools_hub.webp, goal_card.webp, google.webp, homepagw_3d-style-BG.webp
kitty.webp, notavalible.webp, obstacle_1.webp, pinkflower.webp, profits.webp, road.webp
secure_login_illustration.png, shopping_requests_illustration.webp
```

### `assets/lottie` (30)

```
100%25_of_goal.json, 25%25_of_goal.json, 50%25_of_goal.json, 75%25_of_goal.json, An_%20naym_3d_saving.json, Charcoal%20Black.json
Circle%20Loader%2005.json, Excelloading.json, Flame%20-%20Streak.json, Kawaii%20animals%20emoji%20animation.json, Loading%20cart.json, Lovely%20Cat.json
Mr.%20Watermelone.json, Pixel%20Duck.json, Rain.json, Scanning%20receipt.json, The%20robot%20broke%20and%20404%20error.json, Wait%20For%20Add.json
Walking%20Chicken.json, Walking%20Duck.json, Walking.json, Walking_Taco.json, batman.json, loading%20pdf.json
money%20pf.json, no_expense_here.json, process.json, sage.json, uhmmm.json, walking_mascot.json
```

### `assets/navbar_svg` (1)

```
calendar-clock-time-svgrepo-com.svg
```

### `assets/pets` (10)

```
pet.json, pet.json, pet.json, pet.json, pet.json, spritesheet.webp
spritesheet.webp, spritesheet.webp, spritesheet.webp, spritesheet.webp
```

### `assets/sounds` (2)

```
app_notifaction.mp3, purchase-success-.mp3
```

### `fonts` (1)

```
MaterialIcons-Regular.otf
```

### `google_fonts` (21)

```
IBMPlexSansArabic-Bold.ttf, IBMPlexSansArabic-ExtraLight.ttf, IBMPlexSansArabic-Light.ttf, IBMPlexSansArabic-Medium.ttf, IBMPlexSansArabic-Regular.ttf, IBMPlexSansArabic-SemiBold.ttf
IBMPlexSansArabic-Thin.ttf, PixelifySans-Bold.ttf, PixelifySans-Medium.ttf, PixelifySans-Regular.ttf, PixelifySans-SemiBold.ttf, PressStart2P-Bold.ttf
PressStart2P-Medium.ttf, PressStart2P-Regular.ttf, PressStart2P-SemiBold.ttf, Tajawal-Black.ttf, Tajawal-Bold.ttf, Tajawal-ExtraBold.ttf
Tajawal-Light.ttf, Tajawal-Medium.ttf, Tajawal-Regular.ttf
```

### `packages` (4)

```
CupertinoIcons.ttf, iconsax.ttf, record.fixwebmduration.js, record.worklet.js
```

### `shaders` (2)

```
ink_sparkle.frag, stretch_effect.frag
```

## ل) ملفات `res/xml` المفكوكة

### `res/xml/flow_voice_interaction.xml`

```xml
<voice-interaction-service xmlns:android="http://schemas.android.com/apk/res/android" android:settingsActivity="com.cashflow.expense_tracker.MainActivity" android:sessionService="com.cashflow.expense_tracker.FlowAssistantSessionService" android:recognitionService="" android:supportsAssist="true" android:supportsLaunchVoiceAssistFromKeyguard="true" android:supportsLocalInteraction="true"/>
```

### `res/xml/data_extraction_rules.xml`

```xml
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="."/>
    <exclude domain="file" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="external" path="."/>
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="."/>
    <exclude domain="file" path="."/>
    <exclude domain="database" path="."/>
    <exclude domain="sharedpref" path="."/>
    <exclude domain="external" path="."/>
  </device-transfer>
</data-extraction-rules>
```

### `res/xml/widget_balance_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100D9" android:minWidth="130.000000dip" android:minHeight="130.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0520" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="110.000000dip" android:minResizeHeight="110.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0520" android:targetCellWidth="2" android:targetCellHeight="2"/>
```

### `res/xml/widget_quick_actions_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DE" android:minWidth="250.000000dip" android:minHeight="60.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0525" android:previewImage="@7F0E0000" android:resizeMode="0x00000001" android:minResizeWidth="180.000000dip" android:minResizeHeight="60.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0525" android:targetCellWidth="4" android:targetCellHeight="1"/>
```

### `res/xml/widget_brain_dump_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DA" android:minWidth="180.000000dip" android:minHeight="60.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0521" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="140.000000dip" android:minResizeHeight="60.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0521" android:targetCellWidth="2" android:targetCellHeight="1"/>
```

### `res/xml/widget_budget_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DB" android:minWidth="250.000000dip" android:minHeight="130.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0522" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="180.000000dip" android:minResizeHeight="110.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0522" android:targetCellWidth="4" android:targetCellHeight="2"/>
```

### `res/xml/widget_goal_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DD" android:minWidth="250.000000dip" android:minHeight="130.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0524" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="180.000000dip" android:minResizeHeight="110.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0524" android:targetCellWidth="4" android:targetCellHeight="2"/>
```

### `res/xml/widget_recent_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DF" android:minWidth="250.000000dip" android:minHeight="190.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0526" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="180.000000dip" android:minResizeHeight="110.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0526" android:targetCellWidth="4" android:targetCellHeight="3"/>
```

### `res/xml/widget_export_info.xml`

```xml
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:description="@7F1100DC" android:minWidth="180.000000dip" android:minHeight="60.000000dip" android:updatePeriodMillis="0" android:initialLayout="@7F0B0523" android:previewImage="@7F0E0000" android:resizeMode="0x00000003" android:minResizeWidth="140.000000dip" android:minResizeHeight="60.000000dip" android:widgetCategory="0x00000001" android:previewLayout="@7F0B0523" android:targetCellWidth="2" android:targetCellHeight="1"/>
```

### `res/xml/filepaths.xml`

```xml
<paths>
  <external-path name="external-path" path="."/>
  <external-cache-path name="external-cache-path" path="."/>
  <external-files-path name="external-files-path" path="."/>
  <files-path name="files_path" path="."/>
  <cache-path name="cache-path" path="."/>
  <root-path name="root" path="."/>
</paths>
```

## م) مقتطفات `AndroidManifest.xml` (المكوّنات الخاصة بالتطبيق)

```xml
<uses-permission android:name="android.permission.RECEIVE_SMS"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<queries>
<action android:name="android.speech.RecognitionService"/>
<action android:name="android.intent.action.PROCESS_TEXT"/>
<data android:mimeType="text/plain"/>
<action android:name="android.intent.action.VIEW"/>
<data android:scheme="https"/>
<action android:name="android.support.customtabs.action.CustomTabsService"/>
<action android:name="android.intent.action.GET_CONTENT"/>
<data android:mimeType="*/*"/>
<action android:name="com.android.vending.billing.InAppBillingService.BIND"/>
<action android:name="com.google.android.apps.play.billingtestcompanion.BillingOverrideService.BIND"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-feature android:name="android.hardware.camera" android:required="false"/>
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SHORT_SERVICE"/>
<uses-permission android:name="com.google.android.c2dm.permission.RECEIVE"/>
<uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
<uses-permission android:name="android.permission.ACCESS_ADSERVICES_ATTRIBUTION"/>
<uses-permission android:name="android.permission.ACCESS_ADSERVICES_AD_ID"/>
<uses-permission android:name="com.android.vending.BILLING"/>
<uses-permission android:name="com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE"/>
<permission android:name="com.cashflow.expense_tracker.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" android:protectionLevel="0x00000002"/>
<uses-permission android:name="com.cashflow.expense_tracker.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"/>
<receiver android:name="com.cashflow.expense_tracker.sms.SmsReceiver" android:permission="android.permission.BROADCAST_SMS" android:exported="true">
<intent-filter>
<action android:name="android.provider.Telephony.SMS_RECEIVED"/>
</intent-filter>
<receiver android:name="com.cashflow.expense_tracker.sms.SmsNotificationActionReceiver" android:exported="false"/>
<activity android:theme="@7F12014B" android:name="com.cashflow.expense_tracker.WidgetActionActivity" android:exported="false" android:excludeFromRecents="true" android:noHistory="true"/>
<activity android:theme="@7F12014B" android:name="com.cashflow.expense_tracker.MainActivity" android:exported="true" android:taskAffinity="" android:launchMode="1" android:configChanges="0x40003FB4" android:windowSoftInputMode="0x00000010" android:hardwareAccelerated="true">
<meta-data android:name="flutter_deeplinking_enabled" android:value="false"/>
<intent-filter>
<action android:name="android.intent.action.MAIN"/>
<category android:name="android.intent.category.LAUNCHER"/>
</intent-filter>
<intent-filter android:autoVerify="true">
<action android:name="android.intent.action.VIEW"/>
<category android:name="android.intent.category.DEFAULT"/>
<category android:name="android.intent.category.BROWSABLE"/>
<data android:scheme="https" android:host="mezanetak.web.app" android:pathPrefix="/invite/delegated/"/>
<data android:scheme="https" android:host="mezanetak.web.app" android:pathPrefix="/invite/room/"/>
<data android:scheme="https" android:host="mezanetak.web.app" android:pathPrefix="/invite/referral/"/>
</intent-filter>
<intent-filter android:autoVerify="true">
<action android:name="android.intent.action.VIEW"/>
<category android:name="android.intent.category.DEFAULT"/>
<category android:name="android.intent.category.BROWSABLE"/>
<data android:scheme="https" android:host="mezanetak.com" android:pathPrefix="/invite/delegated/"/>
<data android:scheme="https" android:host="mezanetak.com" android:pathPrefix="/invite/room/"/>
<data android:scheme="https" android:host="mezanetak.com" android:pathPrefix="/invite/referral/"/>
</intent-filter>
<intent-filter android:autoVerify="true">
<action android:name="android.intent.action.VIEW"/>
<category android:name="android.intent.category.DEFAULT"/>
<category android:name="android.intent.category.BROWSABLE"/>
<data android:scheme="https" android:host="mezanetak.com" android:pathPrefix="/auth/callback"/>
</intent-filter>
<intent-filter>
<action android:name="android.intent.action.SEND"/>
<category android:name="android.intent.category.DEFAULT"/>
<data android:mimeType="text/plain"/>
</intent-filter>
<intent-filter>
<action android:name="android.intent.action.VIEW"/>
<category android:name="android.intent.category.DEFAULT"/>
<category android:name="android.intent.category.BROWSABLE"/>
<data android:scheme="mezanetak" android:host="invite" android:pathPrefix="/delegated/"/>
<data android:scheme="mezanetak" android:host="invite" android:pathPrefix="/room/"/>
<data android:scheme="mezanetak" android:host="invite" android:pathPrefix="/referral/"/>
</intent-filter>
<intent-filter>
<action android:name="android.intent.action.VIEW"/>
<category android:name="android.intent.category.DEFAULT"/>
<category android:name="android.intent.category.BROWSABLE"/>
<data android:scheme="mezanetak" android:host="auth"/>
</intent-filter>
<service android:label="@7F11004F" android:name="com.cashflow.expense_tracker.FlowAssistantService" android:permission="android.permission.BIND_VOICE_INTERACTION" android:exported="true">
<intent-filter>
<action android:name="android.service.voice.VoiceInteractionService"/>
</intent-filter>
<meta-data android:name="android.voice_interaction" android:resource="@7F140003"/>
<service android:name="com.cashflow.expense_tracker.FlowAssistantSessionService" android:permission="android.permission.BIND_VOICE_INTERACTION" android:exported="true"/>
<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="high_importance_channel_v2"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F14000D"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F140008"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F14000A"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F14000C"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F14000E"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F140009"/>
<intent-filter>
<action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
</intent-filter>
<meta-data android:name="android.appwidget.provider" android:resource="@7F14000B"/>
<receiver android:name="com.cashflow.cashflow.CashflowWidgetBootReceiver" android:enabled="true" android:exported="false">
<intent-filter>
<action android:name="android.intent.action.BOOT_COMPLETED"/>
<action android:name="android.intent.action.QUICKBOOT_POWERON"/>
<action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
<action android:name="android.intent.action.DATE_CHANGED"/>
<action android:name="android.intent.action.TIME_SET"/>
<action android:name="android.intent.action.TIMEZONE_CHANGED"/>
<action android:name="android.intent.action.LOCALE_CHANGED"/>
</intent-filter>
<receiver android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver" android:exported="false"/>
<receiver android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver" android:exported="false">
<intent-filter>
<action android:name="android.intent.action.BOOT_COMPLETED"/>
<action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
<action android:name="android.intent.action.QUICKBOOT_POWERON"/>
<action android:name="com.htc.intent.action.QUICKBOOT_POWERON"/>
</intent-filter>
<intent-filter>
<action android:name="com.google.firebase.MESSAGING_EVENT"/>
</intent-filter>
<intent-filter>
<action android:name="com.google.android.c2dm.intent.RECEIVE"/>
</intent-filter>
<intent-filter>
<action android:name="com.google.android.gms.metadata.MODULE_DEPENDENCIES"/>
</intent-filter>
<activity android:name="com.xamdesign.safe_device.MockLocation.MainActivity" android:exported="false"/>
<intent-filter>
<action android:name="EXTRA_CHOSEN_COMPONENT"/>
</intent-filter>
<service android:name="androidx.work.impl.foreground.SystemForegroundService" android:enabled="@7F040004" android:exported="false" android:directBootAware="false" android:foregroundServiceType="0x00000800"/>
<intent-filter>
<action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
</intent-filter>
<intent-filter>
<action android:name="com.google.android.c2dm.intent.RECEIVE"/>
</intent-filter>
<intent-filter android:priority="-500">
<action android:name="com.google.firebase.MESSAGING_EVENT"/>
</intent-filter>
<intent-filter>
<action android:name="android.intent.action.BOOT_COMPLETED"/>
</intent-filter>
<intent-filter>
<action android:name="androidx.work.diagnostics.REQUEST_DIAGNOSTICS"/>
</intent-filter>
<uses-library android:name="androidx.window.extensions" android:required="false"/>
<uses-library android:name="androidx.window.sidecar" android:required="false"/>
<uses-library android:name="android.ext.adservices" android:required="false"/>
<intent-filter>
<action android:name="androidx.profileinstaller.action.INSTALL_PROFILE"/>
</intent-filter>
<intent-filter>
<action android:name="androidx.profileinstaller.action.SKIP_FILE"/>
</intent-filter>
<intent-filter>
<action android:name="androidx.profileinstaller.action.SAVE_PROFILE"/>
</intent-filter>
<intent-filter>
<action android:name="androidx.profileinstaller.action.BENCHMARK_OPERATION"/>
</intent-filter>
<meta-data android:name="com.android.vending.splits.required" android:value="true"/>
<meta-data android:name="com.android.stamp.source" android:value="https://play.google.com/store"/>
<meta-data android:name="com.android.stamp.type" android:value="STAMP_TYPE_DISTRIBUTION_APK"/>
<uses-permission android:name="com.android.vending.CHECK_LICENSE"/>
```

## ن) مخطط قاعدة بيانات SMS المستخرج من `SmsCandidateDb`

```sql
ALTER TABLE candidates ADD COLUMN 

ALTER TABLE source_links ADD COLUMN auto_file INTEGER NOT NULL DEFAULT 1

ALTER TABLE source_links ADD COLUMN category TEXT

ALTER TABLE source_links ADD COLUMN label TEXT

CREATE INDEX candidates_owner_state ON candidates(owner_id, state)

CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  amount_sealed BLOB NOT NULL,
  merchant_sealed BLOB,
  body_sealed BLOB,
  account_id TEXT,
  category TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  settled_at INTEGER
)

CREATE TABLE owner_settings (
  owner_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  auto_post INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
)

CREATE TABLE source_links (
  owner_id TEXT NOT NULL,
  sender_key TEXT NOT NULL,
  last4 TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL,
  budget_group_id TEXT,
  approved_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, sender_key, last4)
)

CREATE TABLE words (
  owner_id TEXT NOT NULL,
  word_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  display TEXT NOT NULL,
  category TEXT,
  origin TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_id, word_key, kind)
)

```

## س) مفاتيح التخزين والإعدادات المحلية

```
FlutterSharedPreferences
flutter.guest_mode
flutter.hive_active_scope_owner_v1
HomeWidgetPreferences
cashflow_widget_action_store
pending_action
flow_wake_preferences
flow_wake_launch
mezanetak_sms_candidates.db
mezanetak_sms_candidates_v0
mezanetak_sms_candidates_v1 (Keystore alias)
mezanetak_sms_notification_strings
mezanetak_sms_process (WorkManager)
mezanetak_sms_route
mezanetak_sms_server_gate
high_importance_channel_v2 (FCM default channel)
sms_tracking (notification channel)
```

## ع) حدود التحليل

- الـAPK هو **base split** من App Bundle: لا يحتوي `lib/` ولا `libapp.so` ولا `kernel_blob.bin` ⇒ **كود Dart (شاشات ومنطق Flutter) غير متاح** للتحليل الثابت، وكذلك نصوص الواجهة المترجمة (موجودة في `config.<lang>` splits وعددها 74).
- أسماء الشاشات والمميزات في التقرير مستنتجة من: أسماء مجلدات/ملفات `assets/flutter_assets` (461 SVG منظّمة بأسماء شاشات)، قائمة الإضافات الـ42، طبقة Kotlin في الـDEX (103 كلاس)، الـManifest، و`resources.arsc`.
- لم يتم فك تشفير/تشغيل أي كود، ولم تُستخرج مفاتيح خاصة (لا يوجد `libapp.so` أصلًا)، ولم يُتصل بأي خادم.
