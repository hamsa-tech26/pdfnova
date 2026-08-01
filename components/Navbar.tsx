import { FileText, Sparkles } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200">
            <FileText size={22} />
          </div>

          <div>
            <p className="text-xl font-extrabold tracking-tight text-gray-950">
              PDFNova
            </p>
            <p className="text-xs font-medium text-gray-500">
              AI document workspace
            </p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#tools"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            Tools
          </a>

          <a
            href="#ai"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            <Sparkles size={16} />
            AI PDF
          </a>

          <a
            href="#pricing"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            Pricing
          </a>

          <a
            href="#about"
            className="text-sm font-semibold text-gray-700 transition hover:text-blue-600"
          >
            About
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 sm:block">
            Login
          </button>

          <button className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-600 sm:px-5">
            Start Free
          </button>
        </div>
      </div>
    </header>
  );
}