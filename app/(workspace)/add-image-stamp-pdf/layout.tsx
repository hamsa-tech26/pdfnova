import ToolSeoLayout from "@/components/seo/ToolSeoLayout";
import { buildToolMetadata } from "@/lib/seo/tools";
import type { ReactNode } from "react";

export const metadata = buildToolMetadata("add-image-stamp-pdf");

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return <ToolSeoLayout slug="add-image-stamp-pdf">{children}</ToolSeoLayout>;
}
