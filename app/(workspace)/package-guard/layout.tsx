import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Package Guard | Kukureku PDF",
  description: "Run browser-local reusable acceptance gates across the current Kukureku document package with explicit PASS, WARN, FAIL, and NOT_VERIFIED evidence.",
  robots: { index: false, follow: false },
};

export default function PackageGuardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}