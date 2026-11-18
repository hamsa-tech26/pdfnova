import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Smart Scanner (Preview) | Kukureku PDF",
  description:
    "Preview JPG and PNG images privately, check supported formats, and send an image to Kukureku PDF's image-to-PDF converter.",
  robots: { index: false, follow: false },
};

export default function SmartScanLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
