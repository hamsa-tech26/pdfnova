import KukurekuBrandMark from "@/components/KukurekuBrandMark";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <KukurekuBrandMark
            size={40}
            priority
            className="drop-shadow-lg"
          />

          <div>
            <p className="text-xl font-extrabold tracking-tight text-gray-950 dark:text-white">
              Kukureku PDF
            </p>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Free private PDF tools
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
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
            href="/about"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            About
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-600 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-100 sm:px-5"
          >
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
