import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title:
    "Compare Workspace Documents",
  description:
    "Compare two browser-local PDF workspace documents using SHA-256, page counts, and deterministic selectable-text similarity.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CompareDocumentsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
