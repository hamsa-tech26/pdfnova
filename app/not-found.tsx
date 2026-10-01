import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
          404
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white">
          This page could not be found
        </h1>
        <p className="mt-4 leading-7 text-gray-600 dark:text-slate-400">
          The link may be outdated, or the page may have moved. You can return to Peakatee PDF and choose a document tool.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Back to Peakatee PDF
        </Link>
      </div>
    </main>
  );
}
