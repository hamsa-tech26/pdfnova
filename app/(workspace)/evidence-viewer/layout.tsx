import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Evidence Viewer",
  description:
    "Open an exact browser-local PDF page alongside highlighted evidence text from Workspace Intelligence.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EvidenceViewerLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
