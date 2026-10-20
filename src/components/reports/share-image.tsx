"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * مشاركة التقرير كصورة — البند الناقص في «إحصاءات متقدمة».
 *
 * بنرسم ملخص الفترة على <canvas> (من غير أي مكتبة) وبنوفر:
 * تنزيل PNG · مشاركة عبر Web Share API (لو الجهاز يدعم مشاركة الملفات) · نسخ الصورة.
 */

export interface ShareCategory {
  name: string;
  emoji: string;
  total: number;
  pct: number;
}

export interface ShareReportData {
  periodLabel: string;
  spent: number;
  income: number;
  net: number;
  txCount: number;
  currency: string;
  budgetPct: number | null;
  budgetRemaining: number | null;
  categories: ShareCategory[];
  projected?: number | null;
  streak?: number;
}

const WIDTH = 1080;
const HEIGHT = 1350;

function money(value: number, currency: string): string {
  const rounded = Math.round(value);
  const formatted = rounded.toLocaleString("en-US");
  const symbol = currency === "EGP" ? "ج.م" : currency;
  return `${formatted} ${symbol}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ShareReportImage({ data }: { data: ShareReportData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // خلفية متدرجة
    const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bg.addColorStop(0, "#070d16");
    bg.addColorStop(0.55, "#0d1725");
    bg.addColorStop(1, "#111c2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // هالة براند
    const glow = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.08, 40, WIDTH * 0.85, HEIGHT * 0.08, 520);
    glow.addColorStop(0, "rgba(52,211,153,0.28)");
    glow.addColorStop(1, "rgba(52,211,153,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.direction = "rtl";
    ctx.textAlign = "right";

    // الترويسة
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 64px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText("مصاريفي — تقرير الفترة", WIDTH - 72, 140);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 34px system-ui, 'Segoe UI', sans-serif";
    ctx.fillText(data.periodLabel, WIDTH - 72, 196);

    // كروت الأرقام
    const cards = [
      { label: "إجمالي الصرف", value: money(data.spent, data.currency), color: "#fda4af" },
      { label: "إجمالي الدخل", value: money(data.income, data.currency), color: "#6ee7b7" },
      { label: "الصافي", value: money(data.net, data.currency), color: data.net >= 0 ? "#7dd3fc" : "#fca5a5" },
    ];
    const cardW = (WIDTH - 72 * 2 - 24 * 2) / 3;
    cards.forEach((card, index) => {
      const x = WIDTH - 72 - cardW * (index + 1) - 24 * index;
      ctx.fillStyle = "rgba(15,23,42,0.72)";
      roundRect(ctx, x, 248, cardW, 168, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText(card.label, x + cardW - 26, 300);
      ctx.fillStyle = card.color;
      ctx.font = "800 44px system-ui, sans-serif";
      ctx.fillText(card.value, x + cardW - 26, 372);
    });

    // الميزانية
    let y = 486;
    if (data.budgetPct !== null) {
      ctx.fillStyle = "rgba(15,23,42,0.72)";
      roundRect(ctx, 72, y, WIDTH - 144, 132, 28);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "600 30px system-ui, sans-serif";
      ctx.fillText(`استهلكت ${data.budgetPct}% من الميزانية`, WIDTH - 100, y + 52);
      if (data.budgetRemaining !== null) {
        ctx.fillStyle = data.budgetRemaining >= 0 ? "#6ee7b7" : "#fda4af";
        ctx.font = "500 26px system-ui, sans-serif";
        ctx.fillText(
          data.budgetRemaining >= 0
            ? `المتبقي ${money(data.budgetRemaining, data.currency)}`
            : `تجاوزت بـ ${money(-data.budgetRemaining, data.currency)}`,
          WIDTH - 100,
          y + 96,
        );
      }
      // شريط الاستهلاك
      const barX = 100;
      const barW = WIDTH - 200;
      ctx.fillStyle = "rgba(148,163,184,0.25)";
      roundRect(ctx, barX, y + 112, barW, 10, 6);
      ctx.fill();
      const pct = Math.min(100, Math.max(0, data.budgetPct));
      ctx.fillStyle = pct >= 100 ? "#fb7185" : pct >= 80 ? "#fbbf24" : "#34d399";
      roundRect(ctx, barX + barW - (barW * pct) / 100, y + 112, (barW * pct) / 100, 10, 6);
      ctx.fill();
      y += 168;
    }

    // الفئات
    if (data.categories.length) {
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      ctx.font = "700 36px system-ui, sans-serif";
      ctx.fillText("أكبر الفئات", WIDTH - 72, y + 40);
      y += 72;

      const maxTotal = Math.max(...data.categories.map((c) => c.total), 1);
      data.categories.slice(0, 6).forEach((cat) => {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "600 30px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${cat.emoji} ${cat.name}`, WIDTH - 72, y + 34);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "500 26px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${money(cat.total, data.currency)} · ${cat.pct}%`, 72, y + 34);

        const barW = WIDTH - 144;
        ctx.fillStyle = "rgba(148,163,184,0.18)";
        roundRect(ctx, 72, y + 52, barW, 14, 8);
        ctx.fill();
        const w = (barW * cat.total) / maxTotal;
        const grad = ctx.createLinearGradient(72 + barW - w, 0, 72 + barW, 0);
        grad.addColorStop(0, "#10b981");
        grad.addColorStop(1, "#34d399");
        ctx.fillStyle = grad;
        roundRect(ctx, 72 + barW - w, y + 52, w, 14, 8);
        ctx.fill();
        y += 92;
      });
    }

    // التذييل
    ctx.textAlign = "right";
    ctx.fillStyle = "#64748b";
    ctx.font = "500 26px system-ui, sans-serif";
    const footerBits = [
      `${data.txCount} عملية`,
      data.projected ? `متوقع الشهر الجاي ${money(data.projected, data.currency)}` : null,
      data.streak ? `سلسلة ${data.streak} يوم 🔥` : null,
    ].filter(Boolean);
    ctx.fillText(footerBits.join(" · "), WIDTH - 72, HEIGHT - 108);
    ctx.fillStyle = "#34d399";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText("مصاريفي · بياناتك على جهازك", WIDTH - 72, HEIGHT - 62);
    ctx.textAlign = "left";
    ctx.fillStyle = "#475569";
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(new Date().toLocaleDateString("ar-EG"), 72, HEIGHT - 62);
  }, [data]);

  useEffect(() => {
    draw();
  }, [draw]);

  async function toBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  async function download() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `masareefy-report-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setNote("اتنزّلت الصورة ✅");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const file = new File([blob], "masareefy-report.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (typeof nav.canShare === "function" && nav.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "تقرير مصاريفي", text: data.periodLabel });
        setNote("اتشاركت ✅");
      } else if (navigator.share) {
        await navigator.share({ title: "تقرير مصاريفي", text: `${data.periodLabel}: صرف ${money(data.spent, data.currency)}` });
        setNote("اتشارك كنص (الجهاز مش بيدعم مشاركة الصور)");
      } else {
        setNote("المتصفح مش بيدعم المشاركة — نزّل الصورة وابعتها يدوي");
      }
    } catch (error) {
      setNote(error instanceof Error && error.name === "AbortError" ? "اتلغت المشاركة" : "حصل خطأ في المشاركة");
    } finally {
      setBusy(false);
    }
  }

  async function copyImage() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await toBlob();
      if (!blob) return;
      const clip = navigator.clipboard as Clipboard & { write?: (items: ClipboardItem[]) => Promise<void> };
      if (typeof ClipboardItem !== "undefined" && clip?.write) {
        await clip.write([new ClipboardItem({ "image/png": blob })]);
        setNote("اتنسخت الصورة للحافظة ✅");
      } else {
        setNote("المتصفح مش بيدعم نسخ الصور — استخدم التنزيل");
      }
    } catch {
      setNote("مقدرناش ننسخ الصورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={share} disabled={busy} className="btn-primary !px-3 !py-1.5 !text-[11px]">
          📤 مشاركة الصورة
        </button>
        <button type="button" onClick={download} disabled={busy} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
          ⬇️ تنزيل PNG
        </button>
        <button type="button" onClick={copyImage} disabled={busy} className="btn-ghost !px-3 !py-1.5 !text-[11px]">
          📋 نسخ الصورة
        </button>
        {note ? <span className="self-center text-[11px] text-ink-400">{note}</span> : null}
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full max-w-[280px] rounded-2xl border border-ink-700/60 shadow-lg shadow-black/40"
        aria-label="ملخص التقرير كصورة"
      />
    </div>
  );
}
