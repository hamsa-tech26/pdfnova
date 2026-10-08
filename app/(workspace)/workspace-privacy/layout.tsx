import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title:
    "Workspace Privacy Control Center",
  description:
    "Review and control browser-local Workspace Intelligence storage, OCR settings, and cloud-processing boundaries.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspacePrivacyLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
