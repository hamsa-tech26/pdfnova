import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Inspector | Kukureku PDF",
  description:
    "Inspect PDF page geometry, common metadata, form fields, XFA presence, and clearly declared coverage limits locally in your browser.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocumentInspectorLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
