"use client";

import {
  clearRecentFiles,
  getRecentFiles,
  type RecentFileItem,
} from "@/lib/storage/recentFiles";
import {
  Archive,
  FileImage,
  FileText,
  MessageSquareText,
  Scissors,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDF files into one document.",
    href: "/merge-pdf",
    icon: FileText,
    accent: "bg-red-50 text-red-600",
    available: true,
  },
  {
    title: "Split PDF",
    description: "Extract selected pages into a new PDF.",
    href: "/split-pdf",
    icon: Scissors,
    accent: "bg-orange-50 text-orange-600",
    available: true,
  },
  {
    title: "Compress PDF",
    description: "Reduce PDF file size while keeping good quality.",
    href: "/compress-pdf",
    icon: Archive,
    accent: "bg-amber-50 text-amber-600",
    available: true,
  },
  {
    title: "JPG to PDF",
    description: "Turn JPG or PNG images into one PDF document.",
    href: "/jpg-to-pdf",
    icon: FileImage,
    accent: "bg-emerald-50 text-emerald-600",
    available: true,
  },
  {
    title: "PDF to Word",
    description: "Convert PDFs into editable Word documents.",
    href: "#",
    icon: FileText,
    accent: "bg-blue-50 text-blue-600",
    available: false,
  },
  {
    title: "AI Chat",
    description: "Ask questions and understand your PDF faster.",
    href: "#",
    icon: MessageSquareText,
    accent: "bg-cyan-50 text-cyan-600",
    available: false,
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

  useEffect(() => {
    setRecentFiles(getRecentFiles());
  }, []);

  function handleClearHistory() {
    clearRecentFiles();
    setRecentFiles([]);
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
              PDFNova Workspace
            </p>

            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 md:text-5xl">
              Your document tools in one place
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-8 text-gray-600">
              Choose a tool, upload your file, and complete your PDF task in
              seconds.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
            <Sparkles size={16} />
            Free workspace
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-gray-950">Quick tools</h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon;

              if (!tool.available) {
                return (
                  <div
                    key={tool.title}
                    className="relative rounded-3xl border border-gray-200 bg-white p-6 opacity-70 shadow-sm"
                  >
                    <div className="absolute right-5 top-5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                      Coming soon
                    </div>

                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tool.accent}`}
                    >
                      <Icon size={24} />
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-gray-950">
                      {tool.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {tool.description}
                    </p>

                    <span className="mt-6 inline-flex text-sm font-semibold text-gray-400">
                      Not available yet
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tool.accent}`}
                  >
                    <Icon size={24} />
                  </div>

                  <h3 className="mt-6 text-xl font-bold text-gray-950">
                    {tool.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {tool.description}
                  </p>

                  <span className="mt-6 inline-flex text-sm font-semibold text-blue-600">
                    Open tool
                    <span className="ml-2 transition group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-12 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-950">Recent files</h2>

              {recentFiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 size={17} />
                  Clear
                </button>
              )}
            </div>

            {recentFiles.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <FileText className="mx-auto text-gray-400" size={32} />

                <p className="mt-4 font-semibold text-gray-700">
                  No recent files yet
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Your recent document activity will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {recentFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText size={21} />
                    </div>

                    <div className="min-w-0">
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

          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-400 p-8 text-white shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-100">
              Nova AI
            </p>

            <h2 className="mt-4 text-3xl font-extrabold">
              Understand your PDFs faster
            </h2>

            <p className="mt-4 leading-7 text-blue-50">
              Summarize, translate, explain, and chat with your documents using
              AI-powered tools.
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
      </div>
    </main>
  );
}