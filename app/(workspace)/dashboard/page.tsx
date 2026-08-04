"use client";

import {
  clearRecentFiles,
  getRecentFiles,
  type RecentFileItem,
} from "@/lib/storage/recentFiles";
import {
  Archive,
  ArrowRight,
  Bot,
  Clock3,
  FileImage,
  FileText,
  Files,
  ImageIcon,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  WandSparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const availableTools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDF documents into one organized file.",
    href: "/merge-pdf",
    category: "PDF Tools",
    icon: Files,
    accent: "bg-red-50 text-red-600",
  },
  {
    title: "Split PDF",
    description: "Extract selected pages and create a separate PDF document.",
    href: "/split-pdf",
    category: "PDF Tools",
    icon: Scissors,
    accent: "bg-orange-50 text-orange-600",
  },
  {
    title: "Compress PDF",
    description: "Reduce PDF file size while preserving readable quality.",
    href: "/compress-pdf",
    category: "PDF Tools",
    icon: Archive,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "Organize PDF",
    description: "Reorder, rotate, move, and remove PDF pages visually.",
    href: "/organize-pdf",
    category: "PDF Tools",
    icon: Layers3,
    accent: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Watermark PDF",
    description: "Add custom text, logos, stamps, or signatures to PDF pages.",
    href: "/watermark-pdf",
    category: "PDF Tools",
    icon: WandSparkles,
    accent: "bg-pink-50 text-pink-600",
  },
  {
    title: "Unlock PDF",
    description: "Remove PDF password protection using the correct password.",
    href: "/unlock-pdf",
    category: "Security",
    icon: UnlockKeyhole,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Word to PDF",
    description: "Convert readable DOCX content into a downloadable PDF.",
    href: "/word-to-pdf",
    category: "Office",
    icon: FileText,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    title: "JPG to PDF",
    description: "Combine JPG or PNG images into one PDF document.",
    href: "/jpg-to-pdf",
    category: "Images",
    icon: ImageIcon,
    accent: "bg-teal-50 text-teal-600",
  },
  {
    title: "PDF to JPG",
    description: "Convert PDF pages into individual JPG images or a ZIP file.",
    href: "/pdf-to-jpg",
    category: "Images",
    icon: FileImage,
    accent: "bg-violet-50 text-violet-600",
  },
];

const quickActions = [
  {
    title: "Merge PDF",
    description: "Combine documents",
    href: "/merge-pdf",
    icon: Files,
    accent: "bg-red-50 text-red-600",
  },
  {
    title: "Word to PDF",
    description: "Convert a DOCX file",
    href: "/word-to-pdf",
    icon: FileText,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    title: "Watermark PDF",
    description: "Add text or a logo",
    href: "/watermark-pdf",
    icon: WandSparkles,
    accent: "bg-pink-50 text-pink-600",
  },
  {
    title: "Unlock PDF",
    description: "Remove a password",
    href: "/unlock-pdf",
    icon: UnlockKeyhole,
    accent: "bg-emerald-50 text-emerald-600",
  },
];

const comingSoonTools = [
  {
    title: "Protect PDF",
    description: "Add secure password protection and document permissions.",
    icon: LockKeyhole,
  },
  {
    title: "PDF to Word",
    description: "Convert PDF documents into editable Word files.",
    icon: FileText,
  },
  {
    title: "Nova AI Workspace",
    description: "Summarize, explain, translate, and chat with documents.",
    icon: Bot,
  },
];

function formatRecentDate(createdAt: string) {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function DashboardPage() {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    setRecentFiles(getRecentFiles());
    setGreeting(getGreeting());
  }, []);

  const filteredTools = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return availableTools;
    }

    return availableTools.filter((tool) => {
      return (
        tool.title.toLowerCase().includes(normalizedSearch) ||
        tool.description.toLowerCase().includes(normalizedSearch) ||
        tool.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm]);

  function handleClearHistory() {
    clearRecentFiles();
    setRecentFiles([]);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 transition-colors dark:bg-slate-950 sm:px-7 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-blue-300">
              <Sparkles size={16} />
              PDFNova Workspace
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white md:text-5xl">
              {greeting}, Prasenjit 👋
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600 dark:text-slate-400">
              Continue your document work, open a quick tool, or start
              something new from your private PDF workspace.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <ShieldCheck size={19} />
            Browser-based private processing
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white shadow-2xl">
          <div className="grid gap-10 p-7 md:p-10 xl:grid-cols-[1.35fr_0.65fr] xl:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 backdrop-blur">
                <Zap size={16} />
                PDFNova 3.0
              </div>

              <h2 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
                Beautiful, fast and intelligent document tools
              </h2>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
                Convert, organize, secure, and manage PDFs without leaving your
                browser. Your supported files stay on your device.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/word-to-pdf"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-blue-800 transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  Convert Word to PDF
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/merge-pdf"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Merge PDF files
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-medium text-blue-100">
                  Working tools
                </p>

                <p className="mt-3 text-4xl font-extrabold">
                  {availableTools.length}
                </p>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-medium text-blue-100">
                  Recent tasks
                </p>

                <p className="mt-3 text-4xl font-extrabold">
                  {recentFiles.length}
                </p>
              </div>

              <div className="col-span-2 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-200">
                    <ShieldCheck size={22} />
                  </div>

                  <div>
                    <p className="font-bold">Privacy-first workspace</p>

                    <p className="mt-1 text-sm leading-6 text-blue-100">
                      Supported tools process documents locally in your
                      browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                Continue working
              </p>

              <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                Quick actions
              </h2>
            </div>

            <Link
              href="#all-tools"
              className="hidden items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700 sm:inline-flex"
            >
              View all tools
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group flex items-center gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${action.accent}`}
                  >
                    <Icon size={23} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-950 dark:text-white">
                      {action.title}
                    </p>

                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-slate-400">
                      {action.description}
                    </p>
                  </div>

                  <ArrowRight
                    size={18}
                    className="shrink-0 text-gray-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                  />
                </Link>
              );
            })}
          </div>
        </section>

        <section
          id="all-tools"
          className="mt-12"
        >
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
                Tool library
              </p>

              <h2 className="mt-2 text-3xl font-extrabold text-gray-950 dark:text-white">
                Everything in one workspace
              </h2>

              <p className="mt-3 text-gray-600 dark:text-slate-400">
                Search by tool name, description, or category.
              </p>
            </div>

            <div className="w-full xl:max-w-md">
              <label htmlFor="tool-search" className="sr-only">
                Search document tools
              </label>

              <div className="relative">
                <Search
                  size={20}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="tool-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search Merge, Word, Images..."
                  className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 pl-12 pr-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {searchTerm.trim()
                ? `${filteredTools.length} matching ${
                    filteredTools.length === 1 ? "tool" : "tools"
                  }`
                : `${availableTools.length} working tools`}
            </p>

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
              >
                Clear search
              </button>
            )}
          </div>

          {filteredTools.length > 0 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredTools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tool.accent}`}
                      >
                        <Icon size={25} />
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                        {tool.category}
                      </span>
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-gray-950 dark:text-white">
                      {tool.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-400">
                      {tool.description}
                    </p>

                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      Open tool
                      <ArrowRight
                        size={16}
                        className="transition group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
              <Search className="mx-auto text-gray-400" size={36} />

              <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
                No matching tools
              </h3>

              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                Try searching for PDF, Word, image, security, or conversion.
              </p>

              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Show all tools
              </button>
            </div>
          )}
        </section>

        <section className="mt-12 grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  Recent activity
                </p>

                <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                  Your latest files
                </h2>
              </div>

              {recentFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 size={17} />
                  Clear history
                </button>
              )}
            </div>

            {recentFiles.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950">
                <Clock3 className="mx-auto text-gray-400" size={34} />

                <p className="mt-4 font-semibold text-gray-700 dark:text-slate-200">
                  No recent activity yet
                </p>

                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  Completed document tasks will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {recentFiles.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">
                        {item.fileName}
                      </p>

                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                        {item.toolName} • {formatRecentDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-blue-700 to-cyan-500 p-8 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <MessageSquareText size={24} />
              </div>

              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-50">
                Coming soon
              </span>
            </div>

            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-blue-100">
              Nova AI Workspace
            </p>

            <h2 className="mt-3 text-3xl font-extrabold">
              Understand documents faster
            </h2>

            <p className="mt-4 leading-7 text-blue-50">
              Summarize, explain, translate, search, and chat with your PDF
              documents from one intelligent workspace.
            </p>

            <div className="mt-7 space-y-3">
              {[
                "Summarize long documents",
                "Ask questions about your PDF",
                "Translate and explain content",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur"
                >
                  <Sparkles size={17} className="text-cyan-200" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled
              className="mt-8 cursor-not-allowed rounded-xl bg-white/80 px-6 py-3 font-semibold text-blue-700 opacity-80"
            >
              Join the future workspace
            </button>
          </div>
        </section>

        <section className="mt-12 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-400">
              Coming next
            </p>

            <h2 className="mt-2 text-3xl font-extrabold text-gray-950 dark:text-white">
              The workspace is still growing
            </h2>

            <p className="mt-3 text-gray-600 dark:text-slate-400">
              More security, office, and AI tools are being prepared.
            </p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {comingSoonTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <div
                  key={tool.title}
                  className="relative rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="absolute right-5 top-5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                    Coming soon
                  </span>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-gray-950 dark:text-white">
                    {tool.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    {tool.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}