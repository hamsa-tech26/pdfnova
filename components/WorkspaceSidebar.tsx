"use client";

import KukurekuBrandMark from "@/components/KukurekuBrandMark";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Archive,
  Database,
  Bot,
  FileImage,
  FileText,
  Images,
  LayoutDashboard,
  Menu,
  X,
  ListChecks,
  GitCompareArrows,
  ShieldCheck,
  ScanSearch,
  Scissors,
  Sparkles,
  UnlockKeyhole,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
        label: "Magic Drop",
        href: "/magic-drop",
        icon: Sparkles,
      },
      {
        label: "Workflow Recipes",
        href: "/workflow-recipes",
        icon: ListChecks,
        badge: "V1",
      },
      {
        label: "Workflow Planner",
        href: "/workflow-planner",
        icon: Sparkles,
        badge: "V1",
      },
      {
        label: "Workspace Health",
        href: "/workspace-health",
        icon: Database,
        badge: "V1",
      },
      {
        label: "Document Inspector",
        href: "/document-inspector",
        icon: ScanSearch,
      },
      {
        label: "Compare Documents",
        href: "/compare-documents",
        icon: GitCompareArrows,
        badge: "V1",
      },
      {
        label: "Findings Center",
        href: "/workspace-findings",
        icon: ListChecks,
        badge: "V1",
      },
      {
        label: "Safe Share",
        href: "/safe-share",
        icon: ShieldCheck,
        badge: "V1",
      },
      {
        label: "Package Guard",
        href: "/package-guard",
        icon: ListChecks,
        badge: "V1",
      },
      {
        label: "Workspace Copilot",
        href: "/workspace-copilot",
        icon: Bot,
        badge: "V3",
      },
      {
        label: "Privacy Controls",
        href: "/workspace-privacy",
        icon: ShieldCheck,
        badge: "V1",
      },
    ],
  },
  {
    label: "PDF Tools",
    links: [
      {
        label: "Browse all 30 tools",
        href: "/dashboard#all-tools",
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
  onNavigate,
}: {
  link: SidebarLink;
  pathname: string;
  onNavigate?: () => void;
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
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const mobileDrawer = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuButton.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      // The navigation is a modal drawer: do not strand keyboard users
      // behind the backdrop while the drawer is open.
      const focusables = Array.from(
        mobileDrawer.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !mobileDrawer.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !mobileDrawer.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <KukurekuBrandMark size={36} />
          <span className="truncate font-extrabold text-gray-950 dark:text-white">Kukureku PDF</span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          aria-label="Open workspace menu"
          aria-controls="mobile-workspace-navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-white"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Close workspace navigation backdrop"
          />
          <aside
            ref={mobileDrawer}
            id="mobile-workspace-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col bg-white shadow-2xl dark:bg-slate-950"
          >
            <div className="flex min-h-16 items-center justify-between gap-2 border-b border-gray-200 px-4 dark:border-slate-800">
              <span className="font-bold text-gray-950 dark:text-white">Workspace navigation</span>
              <button
                ref={closeButton}
                type="button"
                aria-label="Close workspace menu"
                onClick={() => {
                  setMobileOpen(false);
                  menuButton.current?.focus();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-white"
              >
                <X size={21} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile workspace navigation" className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 py-4">
              {navigationGroups.map((group) => (
                <section key={group.label}>
                  <p className="px-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">{group.label}</p>
                  <div className="mt-2 space-y-1">
                    {group.links.map((link) => (
                      <SidebarNavigationLink
                        key={link.href}
                        link={link}
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              ))}
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 items-center rounded-2xl px-4 text-sm font-semibold text-blue-700 dark:text-blue-300"
              >
                Back to website
              </Link>
            </nav>
            <div className="border-t border-gray-200 p-4 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-80 shrink-0 border-r border-gray-200 bg-white px-5 py-6 transition-colors dark:border-slate-800 dark:bg-slate-950 lg:flex lg:flex-col">
      <div className="flex items-center justify-between gap-3 px-2">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3"
        >
          <KukurekuBrandMark
  size={48}
  priority
  className="drop-shadow-lg"
 />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-lg font-extrabold text-gray-950 dark:text-white">
                Kukureku PDF
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
              Kukureku PDF Workspace
            </p>

            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-400">
              Private, focused PDF tools.
            </p>
          </div>
        </div>
      </div>

      <nav aria-label="Desktop workspace navigation" className="mt-7 flex-1 space-y-7 overflow-y-auto pr-1">
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
    </>
  );
}
