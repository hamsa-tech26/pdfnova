import PeakateeBrandMark from "@/components/PeakateeBrandMark";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <PeakateeBrandMark
  size={40}
  priority
  className="drop-shadow-lg"
/>

          <div>
            <p className="text-xl font-extrabold tracking-tight text-gray-950">
              Peakatee
            </p>
            <p className="text-xs font-medium text-gray-500">
              Private PDF workspace
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/#tools"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            Tools
          </a>

          <a
            href="/#ai"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            <Sparkles size={16} />
            AI PDF
          </a>

          <a
            href="/#about"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            About
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">

          <Link href="/dashboard" className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-600 dark:bg-white dark:text-slate-950 dark:hover:bg-blue-100 sm:px-5">
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}