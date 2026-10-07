import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title:
    "Safe Share Preparation",
  description:
    "Review metadata, forms, selectable-text sensitive patterns, and explicit inspection coverage before sharing a browser-local PDF.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SafeShareLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
