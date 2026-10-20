/**
 * نظام السمات (بند 29 في مصفوفة Mezanetak).
 *
 * الفكرة: السمة كلها **متغيرات CSS** معرّفة في `globals.css`، وإحنا هنا بس
 * بنحط قيمها على `<html>` كـ`data-*` attributes — فأي مكوّن بيتغيّر شكله
 * من غير ما يعرف حاجة عن السمات.
 *
 * الحفظ في `localStorage` (مش في قاعدة البيانات) لأن السمة تفضيل جهاز/متصفح،
 * وبيقرأها سكريبت صغير داخل `<head>` قبل الرسم عشان مفيش «رفرفة» بين السمات.
 */

export const THEME_STORAGE_KEY = "masareefy:theme";

export type ThemeMode = "dark" | "light";
export type ThemeAccent = "emerald" | "sky" | "violet" | "amber" | "rose" | "teal";
export type ThemeFont = "sm" | "md" | "lg" | "xl";
export type ThemeRadius = "sharp" | "soft" | "round";
export type ThemeNameOrder = "name" | "last4";

export interface ThemePrefs {
  mode: ThemeMode;
  accent: ThemeAccent;
  font: ThemeFont;
  radius: ThemeRadius;
  nameOrder: ThemeNameOrder;
}

export const DEFAULT_THEME: ThemePrefs = {
  mode: "dark",
  accent: "emerald",
  font: "md",
  radius: "soft",
  nameOrder: "name",
};

export const ACCENT_OPTIONS: { value: ThemeAccent; label: string; swatch: string }[] = [
  { value: "emerald", label: "أخضر زمردي", swatch: "#10b981" },
  { value: "sky", label: "أزرق سماوي", swatch: "#0ea5e9" },
  { value: "violet", label: "بنفسجي", swatch: "#8b5cf6" },
  { value: "amber", label: "كهرماني", swatch: "#f59e0b" },
  { value: "rose", label: "وردي", swatch: "#f43f5e" },
  { value: "teal", label: "تركوازي", swatch: "#14b8a6" },
];

export const MODE_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "dark", label: "داكن", icon: "🌙" },
  { value: "light", label: "فاتح", icon: "☀️" },
];

export const FONT_OPTIONS: { value: ThemeFont; label: string; hint: string }[] = [
  { value: "sm", label: "صغير", hint: "14.5px" },
  { value: "md", label: "وسط", hint: "16px" },
  { value: "lg", label: "كبير", hint: "17.5px" },
  { value: "xl", label: "كبير جدًا", hint: "19px" },
];

export const RADIUS_OPTIONS: { value: ThemeRadius; label: string }[] = [
  { value: "sharp", label: "حوادّ حادة" },
  { value: "soft", label: "ناعم" },
  { value: "round", label: "دائري" },
];

export const NAME_ORDER_OPTIONS: { value: ThemeNameOrder; label: string }[] = [
  { value: "name", label: "الاسم الأول" },
  { value: "last4", label: "آخر 4 أرقام الأول" },
];

/** السمة الافتراضية لـemerald مش محتاجة attribute (نفس قيمة الـ@theme) */
const SKIP_DEFAULTS: Record<keyof ThemePrefs, string> = {
  mode: "dark",
  accent: "emerald",
  font: "md",
  radius: "soft",
  nameOrder: "name",
};

/** تطبيق السمة على عنصر `<html>` (بيستخدمها اللوحة والسكريبت المبكر) */
export function applyTheme(root: HTMLElement, prefs: ThemePrefs): void {
  const attrs: Record<string, string> = {
    "data-mode": prefs.mode,
    "data-accent": prefs.accent,
    "data-font": prefs.font,
    "data-radius": prefs.radius,
    "data-name-order": prefs.nameOrder,
  };
  for (const [key, value] of Object.entries(attrs)) {
    const prop = key.replace("data-", "").replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()) as keyof ThemePrefs;
    if (value === SKIP_DEFAULTS[prop]) root.removeAttribute(key);
    else root.setAttribute(key, value);
  }
}

/** قراءة السمة المحفوظة (مع تجاهل أي قيمة مش معروفة) */
export function readTheme(storage: Storage | null): ThemePrefs {
  if (!storage) return DEFAULT_THEME;
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<ThemePrefs>;
    return {
      mode: MODE_OPTIONS.some((o) => o.value === parsed.mode) ? (parsed.mode as ThemeMode) : DEFAULT_THEME.mode,
      accent: ACCENT_OPTIONS.some((o) => o.value === parsed.accent)
        ? (parsed.accent as ThemeAccent)
        : DEFAULT_THEME.accent,
      font: FONT_OPTIONS.some((o) => o.value === parsed.font) ? (parsed.font as ThemeFont) : DEFAULT_THEME.font,
      radius: RADIUS_OPTIONS.some((o) => o.value === parsed.radius)
        ? (parsed.radius as ThemeRadius)
        : DEFAULT_THEME.radius,
      nameOrder: NAME_ORDER_OPTIONS.some((o) => o.value === parsed.nameOrder)
        ? (parsed.nameOrder as ThemeNameOrder)
        : DEFAULT_THEME.nameOrder,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(storage: Storage | null, prefs: ThemePrefs): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // التخزين مقفول (وضع خاص) — السمة هتشتغل للجلسة دي بس
  }
}

/**
 * سكريبت صغير بيتحط في `<head>` وبيشتغل قبل أي رسم،
 * عشان المستخدم ميشوفش السمة الافتراضية لحظة قبل ما تتطبق سِمته.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(!raw)return;var p=JSON.parse(raw);var r=document.documentElement;var map={"data-mode":"dark","data-accent":"emerald","data-font":"md","data-radius":"soft","data-name-order":"name"};var set={"data-mode":p.mode,"data-accent":p.accent,"data-font":p.font,"data-radius":p.radius,"data-name-order":p.nameOrder};for(var k in set){var v=set[k];if(!v)continue;if(v===map[k])r.removeAttribute(k);else r.setAttribute(k,v);}}catch(e){}})();`;

/* ── ربط اللوحة بالتخزين (من غير setState داخل effect) ─────────────────────
   بنستخدم `useSyncExternalStore`: المخزن هو localStorage نفسه،
   وأي تعديل بينادي `updateTheme` اللي بيكتب + يطبّق + يعلن التغيير. */

export const THEME_CHANGE_EVENT = "masareefy:theme-change";

let snapshotCache: { raw: string | null; value: ThemePrefs } = { raw: null, value: DEFAULT_THEME };

/** نسخة مستقرة مرجعيًا من السمة المحفوظة (لازمة لـuseSyncExternalStore) */
export function getThemeSnapshot(): ThemePrefs {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (raw !== snapshotCache.raw) snapshotCache = { raw, value: readTheme(window.localStorage) };
  return snapshotCache.value;
}

/** على السيرفر مفيش تخزين — السمة الافتراضية (والسكريبت المبكر هيظبطها في المتصفح) */
export function getThemeServerSnapshot(): ThemePrefs {
  return DEFAULT_THEME;
}

export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

/** حفظ + تطبيق فوري + إعلان التغيير لكل المشتركين */
export function updateTheme(next: ThemePrefs): void {
  writeTheme(window.localStorage, next);
  applyTheme(document.documentElement, next);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
