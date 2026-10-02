"use client";

import PeakateeBrandMark from "@/components/PeakateeBrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Archive,
  FileImage,
  FileText,
  Images,
  LayoutDashboard,
  Scissors,
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
        href: "/pdf-to-word",
        icon: FileText,
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
          <PeakateeBrandMark
  size={48}
  priority
  className="drop-shadow-lg"
 />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-extrabold text-gray-950 dark:text-white">
                Peakatee PDF
              </p>

            </div>

            <p className="truncate text-xs font-medium text-gray-500 dark:text-slate-400">
              Private PDF workspace
            </p>
          </div>
        </Link>

        <ThemeToggle />
      </div>

      <div className="mt-7 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
  <Sparkles size={20} />
</div>

          <div className="min-w-0">
            <p className="font-bold text-gray-950 dark:text-white">
              Peakatee PDF Workspace
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Private, focused PDF tools.
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

    </aside>
  );
}
