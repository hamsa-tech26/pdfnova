"use client";

import ThemeToggle from "@/components/ThemeToggle";
import {
  Archive,
  FileImage,
  FileText,
  Gauge,
  LayoutDashboard,
  MessageSquareText,
  Moon,
  Scissors,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";

const workspaceLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Merge PDF",
    href: "/merge-pdf",
    icon: FileText,
  },
  {
    label: "Split PDF",
    href: "/split-pdf",
    icon: Scissors,
  },
  {
    label: "Compress PDF",
    href: "/compress-pdf",
    icon: Archive,
  },
  {
    label: "JPG to PDF",
    href: "/jpg-to-pdf",
    icon: FileImage,
  },
  {
    label: "PDF to JPG",
    href: "/pdf-to-jpg",
    icon: FileImage,
  },
  {
    label: "Organize PDF",
    href: "/organize-pdf",
    icon: FileText,
  },
  {
    label: "Watermark PDF",
    href: "/watermark-pdf",
    icon: WandSparkles,
  },
  {
    label: "Nova AI",
    href: "#",
    icon: MessageSquareText,
  },
];

export default function WorkspaceSidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-gray-200 bg-white px-5 py-6 transition-colors dark:border-slate-800 dark:bg-slate-950 lg:block">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg">
            <Gauge size={23} />
          </div>

          <div>
            <p className="text-lg font-extrabold text-gray-950 dark:text-white">
              PDFNova
            </p>

            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Workspace
            </p>
          </div>
        </div>

        <ThemeToggle />
      </div>

      <nav className="mt-10 space-y-2">
        {workspaceLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Icon size={19} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
        <div className="flex items-center gap-2">
          <Moon size={18} className="text-cyan-300" />

          <p className="text-sm font-semibold text-cyan-300">
            PDFNova Pro
          </p>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Unlock larger files, premium tools, AI features, and priority
          processing.
        </p>

        <button className="mt-5 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
          Upgrade
        </button>
      </div>
    </aside>
  );
}