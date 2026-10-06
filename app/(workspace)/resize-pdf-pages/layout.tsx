import ToolSeoLayout from "@/components/seo/ToolSeoLayout";
import { buildToolMetadata } from "@/lib/seo/tools";
import type { ReactNode } from "react";

export const metadata = buildToolMetadata("resize-pdf-pages");

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <ToolSeoLayout slug="resize-pdf-pages">
      {children}
    </ToolSeoLayout>
  );
}
