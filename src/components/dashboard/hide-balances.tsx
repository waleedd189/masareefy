"use client";

import { useEffect } from "react";

const STORAGE_KEY = "masareefy.hideBalances";
const HIDE_CLASS = "hide-money";

/**
 * إخفاء الأرصدة — مقابل زر "إخفاء الأرصدة" في Mezanetak (خصوصية في الأماكن العامة).
 *
 * بيطبّق class على <html> والـCSS بيطمس أي عنصر فيه `data-money`.
 * الحالة بتتعامل مع الـDOM/التخزين مباشرة (من غير setState) عشان الاشتغال
 * يشتغل قبل أول render ومتحصلش إعادة رسم متتالية.
 */
export function HideBalancesToggle() {
  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      stored = false;
    }
    document.documentElement.classList.toggle(HIDE_CLASS, stored);
    const label = document.getElementById("hide-balances-label");
    if (label) label.textContent = stored ? "🙈 مخفية" : "👁️ الأرصدة";
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains(HIDE_CLASS);
    document.documentElement.classList.toggle(HIDE_CLASS, next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // التخزين مش متاح (وضع خاص) — الإخفاء يشتغل للجلسة الحالية بس
    }
    const label = document.getElementById("hide-balances-label");
    if (label) label.textContent = next ? "🙈 مخفية" : "👁️ الأرصدة";
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost !px-3 !py-1.5 !text-xs print:hidden"
      title="إظهار/إخفاء كل المبالغ على الشاشة"
    >
      <span id="hide-balances-label">👁️ الأرصدة</span>
    </button>
  );
}
