import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = {
  title: "Workspace Version Health",
  description: "Check local PDF version metadata and export a metadata-only inventory without uploading files.",
  robots: { index: false, follow: false },
};
export default function WorkspaceHealthLayout({ children }: Readonly<{ children: ReactNode }>) { return children; }
