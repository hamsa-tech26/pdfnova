import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Workspace Copilot",
  description:
    "Browser-local cross-document evidence search, cited answers, page-level differences, structured facts, contradiction detection, workspace briefs, and approval-only action planning.",
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
