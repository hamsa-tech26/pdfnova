import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white px-5 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-gray-950 dark:text-white">
            Kukureku PDF
          </p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-slate-400">
            Free PDF and document tools built for fast, private browser-based workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-gray-600 dark:text-slate-300">
          <Link href="/#tools" className="transition hover:text-blue-600">
            PDF Tools
          </Link>
          <Link href="/about" className="transition hover:text-blue-600">
            About
          </Link>
          <Link href="/trust" className="transition hover:text-blue-600">
            Trust Center
          </Link>
          <Link
            href="/guides/private-pdf-tools"
            className="transition hover:text-blue-600"
          >
            PDF Privacy Guide
          </Link>
          <Link href="/press" className="transition hover:text-blue-600">
            Press
          </Link>
          <Link href="/privacy" className="transition hover:text-blue-600">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-blue-600">
            Terms
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-7 max-w-7xl border-t border-gray-100 pt-6 text-xs leading-5 text-gray-400 dark:border-slate-900 dark:text-slate-500">
        © {year} Kukureku. Supported current tools process documents locally in your browser.
      </div>
    </footer>
  );
}
