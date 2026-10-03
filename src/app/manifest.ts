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
  };
}
