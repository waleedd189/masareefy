"use client";

import { useSyncExternalStore } from "react";
import {
  ACCENT_OPTIONS,
  FONT_OPTIONS,
  MODE_OPTIONS,
  NAME_ORDER_OPTIONS,
  RADIUS_OPTIONS,
  DEFAULT_THEME,
  getThemeServerSnapshot,
  getThemeSnapshot,
  subscribeTheme,
  updateTheme,
  type ThemePrefs,
} from "@/lib/theme";

/**
 * لوحة السمة والمظهر: لون التمييز · الوضع الداكن/الفاتح · حجم الخط · الاستدارة · ترتيب اسم الحساب.
 *
 * التغيير فوري (على `<html>` مباشرة) ومحفوظ في `localStorage`،
 * وبيشتغل على كل الصفحات لأن كل الألوان متغيرات CSS.
 */
export function ThemePanel() {
  // السمة المحفوظة بتتقرأ من localStorage كمخزن خارجي — من غير setState في effect
  const prefs = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  function update<K extends keyof ThemePrefs>(key: K, value: ThemePrefs[K]) {
    updateTheme({ ...prefs, [key]: value });
  }

  function reset() {
    updateTheme(DEFAULT_THEME);
  }

  const chip = (active: boolean) =>
    `rounded-xl border px-3 py-1.5 text-[11px] font-bold transition ${
      active
        ? "border-brand-400/60 bg-brand-500/15 text-brand-200"
        : "border-ink-700/70 bg-ink-800/50 text-ink-400 hover:border-ink-500"
    }`;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="field-label">لون التمييز</span>
        <div className="flex flex-wrap gap-2">
          {ACCENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update("accent", option.value)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition ${
                prefs.accent === option.value
                  ? "border-brand-400/60 bg-brand-500/15 text-brand-200"
                  : "border-ink-700/70 bg-ink-800/50 text-ink-400 hover:border-ink-500"
              }`}
              title={option.label}
            >
              <span
                className="h-4 w-4 rounded-full ring-2 ring-white/20"
                style={{ background: option.swatch }}
                aria-hidden
              />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="field-label">الوضع</span>
          <div className="flex flex-wrap gap-2">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("mode", option.value)}
                className={chip(prefs.mode === option.value)}
              >
                {option.icon} {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="field-label">حجم الخط</span>
          <div className="flex flex-wrap gap-2">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("font", option.value)}
                className={chip(prefs.font === option.value)}
                title={option.hint}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="field-label">حوافّ الكروت</span>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("radius", option.value)}
                className={chip(prefs.radius === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="field-label">ترتيب اسم الحساب على البطاقة</span>
          <div className="flex flex-wrap gap-2">
            {NAME_ORDER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => update("nameOrder", option.value)}
                className={chip(prefs.nameOrder === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 pt-3">
        <p className="text-[11px] leading-relaxed text-ink-500">
          السمة بتتحفظ على الجهاز ده (localStorage) وبتتطبّق قبل الرسم، فمفيش رفرفة بين الألوان —
          وبتأثر على كل الصفحات لأن الألوان كلها متغيرات CSS.
        </p>
        <button type="button" onClick={reset} className="btn-ghost !px-3 !py-1.5 !text-xs">
          ↺ رجوع للافتراضي
        </button>
      </div>
    </div>
  );
}
