import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

/**
 * Temporary *unmerged* mobile-test branch ONLY.
 * Never enable the internal Inspector on a production deployment.
 * For previews, enable only this exact one-off testing branch.
 * Vercel deployment authentication stays enabled.
 */
export default function EngineInspectorGuard({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const localDevelopment = process.env.NODE_ENV !== "production";
  const controlledPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "test/v4-fingerprint-mobile-inspector";

  if (!localDevelopment && !controlledPreview) {
    notFound();
  }

  return children;
}
