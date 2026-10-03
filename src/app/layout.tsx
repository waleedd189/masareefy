import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "مصاريفي | متابعة الفيز والمصروفات",
  description:
    "تطبيق لمتابعة مصروفات بطاقات الفيزا وأرصدتها، بيقرأ رسائل البنك تلقائياً ويربط كل رسالة بالبطاقة الخاصة بها.",
  applicationName: "مصاريفي",
};

export const viewport: Viewport = {
  themeColor: "#070d16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
