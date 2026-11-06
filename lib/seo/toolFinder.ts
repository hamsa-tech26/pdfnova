export const TOOL_FINDER_CATEGORIES = [
  { id: "all", label: "All tools" },
  { id: "pages", label: "Pages & layout" },
  { id: "convert", label: "Convert & compress" },
  { id: "edit", label: "Edit & sign" },
  { id: "secure", label: "Privacy & security" },
] as const;

export type ToolFinderCategory =
  (typeof TOOL_FINDER_CATEGORIES)[number]["id"];

const groupedRoutes: Record<Exclude<ToolFinderCategory, "all">, readonly string[]> = {
  pages: [
    "/merge-pdf", "/split-pdf", "/organize-pdf", "/rotate-pdf",
    "/extract-pdf-pages", "/delete-pdf-pages", "/reorder-pdf-pages",
    "/reverse-pdf", "/add-page-numbers", "/crop-pdf",
    "/resize-pdf-pages", "/header-footer-pdf",
  ],
  convert: [
    "/compress-pdf", "/pdf-to-word", "/pdf-to-excel", "/word-to-pdf",
    "/jpg-to-pdf", "/pdf-to-jpg", "/pdf-to-text", "/ocr-pdf",
  ],
  edit: [
    "/flatten-pdf", "/sign-pdf", "/pdf-form-filler",
    "/edit-pdf-metadata", "/add-image-stamp-pdf", "/create-fillable-pdf",
    "/watermark-pdf",
  ],
  secure: [
    "/remove-pdf-metadata", "/redact-pdf", "/protect-pdf",
    "/unlock-pdf",
  ],
};

const categoryByRoute = new Map<string, Exclude<ToolFinderCategory, "all">>(
  Object.entries(groupedRoutes).flatMap(([category, routes]) =>
    routes.map(route => [route, category as Exclude<ToolFinderCategory, "all">]),
  ),
);

// Search-only terms. They do not imply support for conversions beyond each tool's description.
const searchTerms: Record<string, string> = {
  "/merge-pdf": "join combine documents together",
  "/split-pdf": "separate pages divide",
  "/compress-pdf": "shrink smaller size reduce optimize email",
  "/pdf-to-word": "docx editable document",
  "/pdf-to-excel": "xlsx spreadsheet workbook selectable text tables",
  "/word-to-pdf": "docx office document",
  "/jpg-to-pdf": "jpeg png photo picture images",
  "/pdf-to-jpg": "jpeg picture photo images",
  "/organize-pdf": "arrange change order move pages",
  "/ocr-pdf": "scan scanned image recognise recognize text english",
  "/pdf-form-filler": "fill application form fields type",
  "/sign-pdf": "signature handwriting draw",
  "/redact-pdf": "remove hide sensitive confidential information",
  "/protect-pdf": "encrypt password lock",
  "/unlock-pdf": "remove password decrypt",
  "/watermark-pdf": "draft confidential overlay",
  "/add-image-stamp-pdf": "logo seal overlay image",
};

export type SearchableTool = {
  href: string;
  title: string;
  description: string;
};

export function getToolFinderCategory(href: string) {
  return categoryByRoute.get(href);
}

export function getCategorizedToolRoutes() {
  return [...categoryByRoute.keys()];
}

function normalize(value: string) {
  return value.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function filterToolCatalog<T extends SearchableTool>(
  catalog: readonly T[],
  query: string,
  category: ToolFinderCategory,
): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return catalog.filter(tool => {
    if (category !== "all" && getToolFinderCategory(tool.href) !== category) {
      return false;
    }
    const searchable = normalize([
      tool.title, tool.description, searchTerms[tool.href] ?? "",
    ].join(" "));
    return terms.every(term => searchable.includes(term));
  });
}
