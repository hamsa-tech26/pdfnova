import type { ToolSlug } from "@/lib/seo/tools";

// Keep the workspace sidebar in sync with the same 31 live tool routes as
// the dashboard. Categories match the dashboard's tool cards. Every slug must
// occur once; scripts/checkToolRegistry.mjs enforces that invariant in CI.
export const SIDEBAR_TOOL_GROUPS = [
  {
    label: "PDF Tools",
    slugs: [
      "merge-pdf",
      "split-pdf",
      "compress-pdf",
      "organize-pdf",
      "rotate-pdf",
      "extract-pdf-pages",
      "delete-pdf-pages",
      "flatten-pdf",
      "reorder-pdf-pages",
      "reverse-pdf",
      "add-page-numbers",
      "crop-pdf",
      "resize-pdf-pages",
      "header-footer-pdf",
      "sign-pdf",
      "add-image-stamp-pdf",
      "watermark-pdf",
    ],
  },
  {
    label: "Office & OCR",
    slugs: [
      "word-to-pdf",
      "pdf-to-word",
      "pdf-to-excel",
      "pdf-to-text",
      "ocr-pdf",
    ],
  },
  {
    label: "Security",
    slugs: [
      "protect-pdf",
      "unlock-pdf",
      "redact-pdf",
      "remove-pdf-metadata",
      "edit-pdf-metadata",
    ],
  },
  {
    label: "Forms",
    slugs: [
      "pdf-form-filler",
      "create-fillable-pdf",
    ],
  },
  {
    label: "Images",
    slugs: [
      "jpg-to-pdf",
      "pdf-to-jpg",
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  slugs: ReadonlyArray<ToolSlug>;
}>;
