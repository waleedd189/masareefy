import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مصاريفي — متابعة الفيز والمصروفات",
    short_name: "مصاريفي",
    description: "متابعة بطاقاتك ومصروفاتك ورسائل البنك، حتى بدون اتصال بالإنترنت.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070d16",
    theme_color: "#070d16",
    lang: "ar",
    dir: "rtl",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // مشاركة نص من أي تطبيق (رسالة بنك/إيصال نصي) ← صفحة التفريغ
    // مقابل `ACTION_SEND text/plain` → `shared_text` في Mezanetak
    share_target: {
      action: "/brain-dump",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { title: "title", text: "text", url: "url" },
    },
    // اختصارات الضغط المطوّل على أيقونة التطبيق (مقابل `quick-actions` widget)
    shortcuts: [
      {
        name: "تسجيل مصروف سريع",
        short_name: "مصروف",
        description: "اكتب اليوم كله ونحن نقسّمه",
        url: "/brain-dump?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "لصق رسائل البنك",
        short_name: "رسائل",
        description: "حلّل رسائل البنك وسجّلها",
        url: "/messages?focus=paste",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "تقرير الشهر",
        short_name: "تقرير",
        description: "تقرير قابل للطباعة والتصدير",
        url: "/reports?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "الأهداف",
        short_name: "الأهداف",
        description: "أهداف الادخار وتقدّمها",
        url: "/goals?source=shortcut",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
