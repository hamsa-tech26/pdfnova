import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Magic Drop",
  description:
    "Drop a PDF into Kukureku for local deterministic inspection and fact-derived next-step recommendations without automatic edits.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MagicDropLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
