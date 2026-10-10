import KukurekuBrandMark from "@/components/KukurekuBrandMark";
import MobileSiteNavigation from "@/components/MobileSiteNavigation";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <KukurekuBrandMark
            size={36}
            priority
            className="drop-shadow-lg"
          />

          <div>
            <p className="whitespace-nowrap text-base font-extrabold tracking-tight text-gray-950 dark:text-white sm:text-xl">
              Kukureku PDF
            </p>
            <p className="hidden text-xs font-medium text-gray-500 dark:text-slate-400 sm:block">
              Free private PDF tools
            </p>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-8 md:flex">
          <Link
            href="/#tools"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            Tools
          </Link>

          <Link
            href="/#ai"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            <Sparkles size={16} />
            AI PDF
          </Link>

          <Link
            href="/trust"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            Trust
          </Link>

          <Link
            href="/guides"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            Guides
          </Link>

          <Link
            href="/about"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            About
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <MobileSiteNavigation />
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center whitespace-nowrap rounded-xl bg-gray-950 px-3 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-100 sm:px-5 sm:text-sm"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
