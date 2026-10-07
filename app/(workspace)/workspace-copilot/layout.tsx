import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workspace Copilot",
  description:
    "Evidence-backed browser-local guidance across document versions, relationships, comparisons, verification, and Safe Share findings.",
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
