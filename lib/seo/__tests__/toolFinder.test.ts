import { describe, expect, it } from "vitest";
import {
  filterToolCatalog,
  getCategorizedToolRoutes,
  getToolFinderCategory,
} from "../toolFinder";

const sampleTools = [
  { href: "/merge-pdf", title: "Merge PDF", description: "Combine multiple PDF files" },
  { href: "/compress-pdf", title: "Compress PDF", description: "Reduce PDF file size" },
  { href: "/sign-pdf", title: "Sign PDF", description: "Add a visible signature" },
  { href: "/ocr-pdf", title: "OCR PDF", description: "Recognize English text locally" },
  { href: "/pdf-to-excel", title: "PDF to Excel", description: "Export selectable text tables" },
  { href: "/redact-pdf", title: "Redact PDF", description: "Remove sensitive page content" },
];

describe("public PDF tool finder", () => {
  it("defines exactly 31 distinct categorized public routes", () => {
    const routes = getCategorizedToolRoutes();
    expect(routes).toHaveLength(31);
    expect(new Set(routes).size).toBe(31);
    expect(routes.every(route => route.startsWith("/"))).toBe(true);
  });

  it("shows all tools with an empty search and no category", () => {
    expect(filterToolCatalog(sampleTools, "", "all")).toEqual(sampleTools);
  });

  it("finds tool names and task-based synonyms case-insensitively", () => {
    expect(filterToolCatalog(sampleTools, "JOIN", "all").map(x => x.href)).toEqual(["/merge-pdf"]);
    expect(filterToolCatalog(sampleTools, "smaller size", "all").map(x => x.href)).toEqual(["/compress-pdf"]);
    expect(filterToolCatalog(sampleTools, "scanned text", "all").map(x => x.href)).toEqual(["/ocr-pdf"]);
  });

  it("applies category and text filters together", () => {
    expect(filterToolCatalog(sampleTools, "pdf", "secure").map(x => x.href)).toEqual(["/redact-pdf"]);
    expect(filterToolCatalog(sampleTools, "sign", "convert")).toEqual([]);
    expect(getToolFinderCategory("/sign-pdf")).toBe("edit");
  });

  it("does not imply PDF-to-Excel supports scanned documents", () => {
    expect(filterToolCatalog(sampleTools, "scanned excel", "all")).toEqual([]);
  });

  it("is safe with whitespace, punctuation, and unknown searches", () => {
    expect(filterToolCatalog(sampleTools, "  SIGN!  ", "all").map(x => x.href)).toEqual(["/sign-pdf"]);
    expect(filterToolCatalog(sampleTools, "unavailable task", "all")).toEqual([]);
  });

  it("does not alter its source array while filtering", () => {
    const before = [...sampleTools];
    filterToolCatalog(sampleTools, "", "pages");
    expect(sampleTools).toEqual(before);
  });
});
