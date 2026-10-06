import ToolSeoLayout from "@/components/seo/ToolSeoLayout";
import { buildToolMetadata } from "@/lib/seo/tools";
import type { ReactNode } from "react";

export const metadata =
  buildToolMetadata(
    "sign-pdf",
  );

export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <ToolSeoLayout slug="sign-pdf">
      {children}
    </ToolSeoLayout>
  );
}
