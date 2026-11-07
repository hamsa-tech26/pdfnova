import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCategorizedToolRoutes } from "../toolFinder";
import { PUBLIC_TOOL_COUNT, PUBLIC_TOOL_LIST, TOOL_SEO } from "../tools";

const source = (file: string) =>
  readFileSync(resolve(process.cwd(), file), "utf8");

describe("public content accuracy - release 214", () => {
  it("derives all public tool names, counts, and live links from the canonical registry", () => {
    expect(PUBLIC_TOOL_COUNT).toBe(31);
    expect(PUBLIC_TOOL_LIST).toHaveLength(Object.keys(TOOL_SEO).length);
    expect(new Set(PUBLIC_TOOL_LIST.map((tool) => tool.href)).size).toBe(PUBLIC_TOOL_COUNT);
    expect(new Set(PUBLIC_TOOL_LIST.map((tool) => tool.name)).size).toBe(PUBLIC_TOOL_COUNT);
    expect(PUBLIC_TOOL_LIST).toContainEqual({
      href: "/pdf-to-excel",
      name: "PDF to Excel",
    });

    for (const tool of PUBLIC_TOOL_LIST) {
      expect(existsSync(resolve(process.cwd(), "app/(workspace)", tool.href.slice(1), "page.tsx"))).toBe(true);
    }
    expect(getCategorizedToolRoutes().sort()).toEqual(
      PUBLIC_TOOL_LIST.map((tool) => tool.href).sort(),
    );
  });

  it("uses dynamic registry counts on public informational and social-preview pages", () => {
    const files = [
      "app/page.tsx",
      "app/about/page.tsx",
      "app/press/page.tsx",
      "app/guides/private-pdf-tools/page.tsx",
      "app/opengraph-image.tsx",
    ];

    for (const file of files) {
      const contents = source(file);
      expect(contents).toContain("PUBLIC_TOOL_COUNT");
      expect(contents).not.toMatch(/\b(?:ten|10|thirty|30|31)\s+(?:working\s+|focused\s+|browser-based\s+|PDF\s+)?tools?\b/i);
    }

    const about = source("app/about/page.tsx");
    expect(about).toContain("PUBLIC_TOOL_LIST.map");
    expect(about).toContain("href={tool.href}");
    expect(about).toContain("min-h-11");

    const guide = source("app/guides/private-pdf-tools/page.tsx");
    expect(guide).toContain('href="/#tools"');
  });

  it("describes priority search pages without promising unsupported outcomes", () => {
    const merge = TOOL_SEO["merge-pdf"];
    const compress = TOOL_SEO["compress-pdf"];
    const word = TOOL_SEO["pdf-to-word"];

    expect(merge.title).toContain("Merge PDF Online");
    expect(merge.description).toContain("25 MB per file");
    expect(merge.description).toContain("No uploads");
    expect(compress.title).toContain("Compress PDF Online");
    expect(compress.description).toContain("when possible");
    expect(compress.description).toContain("25 MB limit");
    expect(word.title).toContain("PDF to Word Converter Online");
    expect(word.description).toContain("text-based PDFs");
    expect(word.description).toContain("scanned PDFs need OCR");
  });
});
