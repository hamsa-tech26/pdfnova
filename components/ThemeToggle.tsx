"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <Sun size={18} />
      </button>
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" && resolvedTheme === "dark");

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white transition hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}