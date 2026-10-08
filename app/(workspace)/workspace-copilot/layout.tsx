import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workspace Copilot",
  description:
    "Private browser-local OCR intelligence, persistent incremental indexing, smart page alignment, normalized facts, section and table analysis, evidence viewing, and cross-document guidance.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceCopilotLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
