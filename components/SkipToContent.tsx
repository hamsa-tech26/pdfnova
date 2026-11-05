"use client";

import type { MouseEvent } from "react";

export default function SkipToContent() {
  function focusMain(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.querySelector("main");
    if (!main) return;
    event.preventDefault();
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
  }

  return (
    <a
      href="#main-content"
      onClick={focusMain}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-blue-700 focus:px-4 focus:py-3 focus:font-bold focus:text-white focus:outline-2 focus:outline-offset-2 focus:outline-white"
    >
      Skip to main content
    </a>
  );
}
