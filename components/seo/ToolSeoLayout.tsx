import {
  buildToolStructuredData,
  type ToolSlug,
} from "@/lib/seo/tools";
import type { ReactNode } from "react";

type ToolSeoLayoutProps = {
  slug: ToolSlug;
  children: ReactNode;
};

export default function ToolSeoLayout({
  slug,
  children,
}: ToolSeoLayoutProps) {
  const structuredData = buildToolStructuredData(slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      {children}
    </>
  );
}
