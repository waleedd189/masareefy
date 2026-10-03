"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider() {
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    queueMicrotask(() => setOnline(navigator.onLine));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  if (online && !installPrompt) return null;

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs ${online ? "border-brand-500/30 bg-brand-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
      <span className="font-semibold">{online ? "ثبّت مصاريفي على الموبايل واستخدمه كتطبيق" : "أنت أوفلاين — الإدخالات الجديدة هتتحفظ على الجهاز"}</span>
      {installPrompt ? <button type="button" onClick={() => void install()} className="btn-primary !px-3 !py-1.5 !text-xs">تثبيت التطبيق</button> : <a href="/offline" className="font-bold text-amber-200">فتح وضع أوفلاين ←</a>}
    </div>
  );
}
