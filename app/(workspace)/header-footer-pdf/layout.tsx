import ToolSeoLayout from "@/components/seo/ToolSeoLayout";
import { buildToolMetadata } from "@/lib/seo/tools";
import type { ReactNode } from "react";

export const metadata =
  buildToolMetadata(
    "header-footer-pdf",
  );

export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ToolSeoLayout slug="header-footer-pdf">
      {children}
    </ToolSeoLayout>
  );
}
