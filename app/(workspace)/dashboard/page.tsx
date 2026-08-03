"use client";

import {
  clearRecentFiles,
  getRecentFiles,
  type RecentFileItem,
} from "@/lib/storage/recentFiles";
import {
  Archive,
  ArrowRight,
  Clock3,
  FileImage,
  FileText,
  Layers3,
  MessageSquareText,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const availableTools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDF files into one document.",
    href: "/merge-pdf",
    icon: FileText,
    accent: "bg-red-50 text-red-600",
  },
  {
    title: "Split PDF",
    description: "Extract selected pages into a new PDF.",
    href: "/split-pdf",
    icon: Scissors,
    accent: "bg-orange-50 text-orange-600",
  },
  {
    title: "Compress PDF",
    description: "Optimize a PDF and reduce its file size where possible.",
    href: "/compress-pdf",
    icon: Archive,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "JPG to PDF",
    description: "Turn JPG or PNG images into one PDF document.",
    href: "/jpg-to-pdf",
    icon: FileImage,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "PDF to JPG",
    description: "Convert PDF pages into downloadable JPG images.",
    href: "/pdf-to-jpg",
    icon: FileImage,
    accent: "bg-violet-50 text-violet-600",
  },
  {
    title: "Organize PDF",
    description: "Reorder, rotate, and remove pages from a PDF.",
    href: "/organize-pdf",
    icon: Layers3,
    accent: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Watermark PDF",
    description: "Add text, logos, stamps, or signatures to PDF pages.",
    href: "/watermark-pdf",
    icon: WandSparkles,
    accent: "bg-pink-50 text-pink-600",
  },
];

const comingSoonTools = [
  {
    title: "Protect PDF",
    description: "Add password protection and document permissions.",
    icon: FileText,
  },
  {
    title: "PDF to Word",
    description: "Convert PDF documents into editable Word files.",
    icon: FileText,
  },
  {
    title: "Nova AI",
    description: "Summarize and chat with your PDF documents.",
    icon: MessageSquareText,
  },
];

function formatRecentDate(createdAt: string) {
  const date = new Date(createdAt);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function DashboardPage() {
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  const filteredTools = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return availableTools;
    }

    return availableTools.filter((tool) => {
      return (
        tool.title.toLowerCase().includes(normalizedSearch) ||
        tool.description.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [searchTerm]);

  function handleClearHistory() {
    clearRecentFiles();
    setRecentFiles([]);
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-8 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl md:p-12">
          <div className="grid items-center gap-10 xl:grid-cols-[1.4fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 backdrop-blur">
                <Sparkles size={16} />
                PDFNova Workspace
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
                Everything you need to work smarter with PDFs
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">
                Merge, split, compress, convert, organize, watermark, and
                manage documents in one private browser-based workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/merge-pdf"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-blue-800 transition hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  Start with Merge PDF
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/organize-pdf"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Organize a PDF
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
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-200">
                    <Zap size={22} />
                  </div>

                  <div>
                    <p className="font-bold">
                      Private browser processing
                    </p>

                    <p className="mt-1 text-sm text-blue-100">
                      Your files stay on your device for supported tools.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                Quick actions
              </p>

              <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
                Choose a document tool
              </h2>

              <p className="mt-3 text-gray-600">
                Search for a tool or choose one from the available workspace.
              </p>
            </div>

            <div className="w-full lg:max-w-md">
              <label htmlFor="tool-search" className="sr-only">
                Search PDF tools
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
                  placeholder="Search tools, for example Merge PDF"
                  className="w-full rounded-2xl border border-gray-300 bg-white py-3.5 pl-12 pr-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {searchTerm.trim()
                ? `${filteredTools.length} matching ${
                    filteredTools.length === 1 ? "tool" : "tools"
                  }`
                : `${availableTools.length} tools available`}
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
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tool.accent}`}
                      >
                        <Icon size={25} />
                      </div>

                      <ArrowRight
                        size={20}
                        className="text-gray-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                      />
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-gray-950">
                      {tool.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {tool.description}
                    </p>

                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                      Open tool
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
              <Search className="mx-auto text-gray-400" size={36} />

              <h3 className="mt-4 text-lg font-bold text-gray-900">
                No tools found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Try searching for Merge, Split, Compress, JPG, Organize, or
                Watermark.
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

        <section className="mt-12 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
                  Activity
                </p>

                <h2 className="mt-2 text-2xl font-extrabold text-gray-950">
                  Recent files
                </h2>
              </div>

              {recentFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={17} />
                  Clear history
                </button>
              )}
            </div>

            {recentFiles.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                <Clock3 className="mx-auto text-gray-400" size={34} />

                <p className="mt-4 font-semibold text-gray-700">
                  No recent activity yet
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Completed document tasks will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {recentFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {item.fileName}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {item.toolName} • {formatRecentDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-violet-700 via-blue-700 to-cyan-500 p-8 text-white shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <MessageSquareText size={24} />
            </div>

            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-blue-100">
              Nova AI
            </p>

            <h2 className="mt-3 text-3xl font-extrabold">
              Understand documents faster
            </h2>

            <p className="mt-4 leading-7 text-blue-50">
              Future AI tools will help summarize, explain, translate, and chat
              with your PDF documents.
            </p>

            <button
              type="button"
              disabled
              className="mt-8 cursor-not-allowed rounded-xl bg-white/80 px-6 py-3 font-semibold text-blue-700 opacity-80"
            >
              Coming Soon
            </button>
          </div>
        </section>

        <section className="mt-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
              Coming next
            </p>

            <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
              More tools are on the way
            </h2>
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-3">
            {comingSoonTools.map((tool) => {
              const Icon = tool.icon;

              return (
                <div
                  key={tool.title}
                  className="relative rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <span className="absolute right-5 top-5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                    Coming soon
                  </span>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
                    <Icon size={23} />
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-gray-950">
                    {tool.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
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