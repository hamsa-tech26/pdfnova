import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title:
    "Workspace Findings Center",
  description:
    "Review browser-local document relationships, provenance findings, verification checks, and recommended actions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceFindingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
