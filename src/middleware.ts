import { NextResponse, type NextRequest } from "next/server";

/**
 * بوابة دخول اختيارية للتطبيق المنشور على الإنترنت.
 *
 * التطبيق مفيش فيه تسجيل دخول (استخدام شخصي)، فلو نشرته علني على Vercel مثلًا
 * أي حد يعرف الرابط يقدر يشوف بياناتك المالية. الحل: لو حطيت `APP_ACCESS_CODE`
 * في متغيرات البيئة، كل الصفحات بتطلب كلمة السر دي (HTTP Basic Auth) —
 * والمتصفح بيحفظها فمتحسش بفرق في الاستخدام.
 *
 * من غير المتغير ده ⇒ البوابة مقفولة والتطبيق يشتغل عادي (للاستخدام المحلي).
 *
 * مستثنى من البوابة:
 * - `/api/ingest` لأنه محمي بمفتاح API مجزّأ (SHA-256) من صفحة الإعدادات،
 *   وتطبيق SMS Forwarder على الموبايل مش هيعرف يعمل Basic Auth بسهولة.
 * - الملفات الساكنة (`_next`, الأيقونات, الـmanifest) لأنها مفيهاش بيانات.
 */

/** مسارات مستثناة من كلمة السر */
const PUBLIC_PREFIXES = ["/_next", "/icons", "/api/ingest", "/manifest.webmanifest", "/favicon.ico"];

/** مقارنة بأمان ضد هجمات التوقيت */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decodeBasic(header: string): string | null {
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !value) return null;
  try {
    const decoded = atob(value);
    const separator = decoded.indexOf(":");
    return separator === -1 ? null : decoded.slice(separator + 1);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const code = process.env.APP_ACCESS_CODE?.trim();
  if (!code) return NextResponse.next();

  const path = request.nextUrl.pathname;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return NextResponse.next();

  const provided = decodeBasic(request.headers.get("authorization") ?? "");
  if (provided && safeEqual(provided, code)) return NextResponse.next();

  return new NextResponse("مطلوب كلمة سر للوصول لمصاريفي", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Masareefy", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  // كل حاجة ما عدا الملفات الساكنة اللي مالهاش لازمة في المطابقة
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
