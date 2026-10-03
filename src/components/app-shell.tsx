import Link from "next/link";
import { NavLinks } from "./nav-links";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] gap-6 px-3 pb-24 pt-4 sm:px-5 lg:pb-8">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col justify-between rounded-3xl border border-ink-700/70 bg-ink-900/70 p-4 backdrop-blur lg:flex">
        <div>
          <Link href="/" className="mb-8 flex items-center gap-3 px-2 pt-2">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl shadow-lg shadow-brand-500/30">
              💳
            </span>
            <span>
              <span className="block text-lg font-extrabold leading-tight">مصاريفي</span>
              <span className="block text-[11px] text-ink-400">متابعة الفيز والمصروفات</span>
            </span>
          </Link>
          <NavLinks />
        </div>
        <div className="rounded-2xl border border-ink-700/60 bg-ink-950/60 p-3 text-[11px] leading-relaxed text-ink-400">
          بتحلّل رسائل البنك محلياً على جهازك — مفيش بيانات بتروح لأي طرف تالت.
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-700/70 bg-ink-950/95 px-2 py-2 backdrop-blur lg:hidden">
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
