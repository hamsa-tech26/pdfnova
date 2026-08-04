"use client";

import ThemeToggle from "@/components/ThemeToggle";
import {
  Archive,
  Bot,
  Clock3,
  FileImage,
  FileText,
  Gauge,
  Heart,
  Images,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  UnlockKeyhole,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarLink = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  available?: boolean;
};

type SidebarGroup = {
  label: string;
  links: SidebarLink[];
};

const navigationGroups: SidebarGroup[] = [
  {
    label: "Workspace",
    links: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Favorites",
        href: "#",
        icon: Heart,
        badge: "Soon",
        available: false,
      },
      {
        label: "Recent",
        href: "#",
        icon: Clock3,
        badge: "Soon",
        available: false,
      },
    ],
  },
  {
    label: "PDF Tools",
    links: [
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
        label: "Protect PDF",
        href: "/protect-pdf",
        icon: LockKeyhole,
      },
      {
        label: "Unlock PDF",
        href: "/unlock-pdf",
        icon: UnlockKeyhole,
      },
    ],
  },
  {
    label: "Office",
    links: [
      {
        label: "Word to PDF",
        href: "/word-to-pdf",
        icon: FileText,
      },
      {
        label: "PDF to Word",
        href: "#",
        icon: FileText,
        badge: "Soon",
        available: false,
      },
    ],
  },
  {
    label: "Images",
    links: [
      {
        label: "JPG to PDF",
        href: "/jpg-to-pdf",
        icon: Images,
      },
      {
        label: "PDF to JPG",
        href: "/pdf-to-jpg",
        icon: FileImage,
      },
    ],
  },
  {
    label: "Nova AI",
    links: [
      {
        label: "AI Workspace",
        href: "#",
        icon: Bot,
        badge: "Soon",
        available: false,
      },
      {
        label: "Chat with PDF",
        href: "#",
        icon: MessageSquareText,
        badge: "Soon",
        available: false,
      },
    ],
  },
];

function SidebarNavigationLink({
  link,
  pathname,
}: {
  link: SidebarLink;
  pathname: string;
}) {
  const Icon = link.icon;
  const isAvailable = link.available !== false;
  const isActive =
    isAvailable &&
    (pathname === link.href ||
      (link.href !== "/dashboard" &&
        pathname.startsWith(`${link.href}/`)));

  if (!isAvailable) {
    return (
      <div
        className="flex cursor-not-allowed items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-400 opacity-70 dark:text-slate-500"
        title={`${link.label} is coming soon`}
      >
        <Icon size={19} className="shrink-0" />

        <span className="min-w-0 flex-1 truncate">
          {link.label}
        </span>

        {link.badge && (
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
            {link.badge}
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={link.href}
      className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        isActive
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none"
          : "text-gray-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }`}
    >
      <Icon
        size={19}
        className={`shrink-0 transition ${
          isActive
            ? "text-white"
            : "group-hover:scale-105"
        }`}
      />

      <span className="min-w-0 flex-1 truncate">
        {link.label}
      </span>

      {link.badge && (
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
            isActive
              ? "bg-white/20 text-white"
              : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {link.badge}
        </span>
      )}
    </Link>
  );
}

export default function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-80 shrink-0 border-r border-gray-200 bg-white px-5 py-6 transition-colors dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col">
      <div className="flex items-center justify-between gap-3 px-2">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-lg shadow-blue-200 dark:shadow-none">
            <Gauge size={24} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-extrabold text-gray-950 dark:text-white">
                PDFNova
              </p>

              <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Beta
              </span>
            </div>

            <p className="truncate text-xs font-medium text-gray-500 dark:text-slate-400">
              AI document workspace
            </p>
          </div>
        </Link>

        <ThemeToggle />
      </div>

      <div className="mt-7 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Sparkles size={20} />
          </div>

          <div className="min-w-0">
            <p className="font-bold text-gray-950 dark:text-white">
              PDFNova 3.0
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Beautiful, fast and intelligent.
            </p>
          </div>
        </div>
      </div>

      <nav className="mt-7 flex-1 space-y-7 overflow-y-auto pr-1">
        {navigationGroups.map((group) => (
          <section key={group.label}>
            <p className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">
              {group.label}
            </p>

            <div className="mt-2 space-y-1">
              {group.links.map((link) => (
                <SidebarNavigationLink
                  key={link.label}
                  link={link}
                  pathname={pathname}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-6 space-y-3">
        <Link
          href="#"
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Settings size={19} />
          Settings
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500 dark:bg-slate-800 dark:text-slate-400">
            Soon
          </span>
        </Link>

        <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={18}
                className="text-cyan-300"
              />

              <p className="text-sm font-bold text-cyan-200">
                PDFNova Pro
              </p>
            </div>

            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-100">
              Future
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-200">
            Unlock larger files, batch tools, cloud storage and Nova AI.
          </p>

          <button
            type="button"
            disabled
            className="mt-5 w-full cursor-not-allowed rounded-xl bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-800 opacity-80"
          >
            Upgrade Coming Soon
          </button>
        </div>
      </div>
    </aside>
  );
}