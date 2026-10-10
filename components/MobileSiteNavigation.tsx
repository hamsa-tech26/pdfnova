"use client";

import { Menu, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/#tools", label: "Tools" },
  { href: "/#ai", label: "AI PDF", icon: Sparkles },
  { href: "/trust", label: "Trust" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
];

export default function MobileSiteNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-label={isOpen ? "Close site menu" : "Open site menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-site-navigation"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-800 transition hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
      >
        {isOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>
      {isOpen && (
        <nav
          id="mobile-site-navigation"
          aria-label="Mobile primary navigation"
          className="absolute inset-x-0 top-full z-50 border-b border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-950"
        >
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={label}
              onClick={() => setIsOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-gray-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {Icon && <Icon size={18} aria-hidden="true" />}
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Open workspace
          </Link>
        </nav>
      )}
    </div>
  );
}
