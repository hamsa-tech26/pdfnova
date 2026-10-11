export const ORIGIN = "https://kukureku.com";
export const HOST = "kukureku.com";

export const PUBLIC_ROUTES = [
  "/",
  "/merge-pdf",
  "/split-pdf",
  "/compress-pdf",
  "/pdf-to-word",
  "/pdf-to-excel",
  "/word-to-pdf",
  "/jpg-to-pdf",
  "/pdf-to-jpg",
  "/organize-pdf",
  "/rotate-pdf",
  "/extract-pdf-pages",
  "/delete-pdf-pages",
  "/pdf-to-text",
  "/flatten-pdf",
  "/ocr-pdf",
  "/reorder-pdf-pages",
  "/reverse-pdf",
  "/remove-pdf-metadata",
  "/add-page-numbers",
  "/crop-pdf",
  "/resize-pdf-pages",
  "/header-footer-pdf",
  "/sign-pdf",
  "/pdf-form-filler",
  "/redact-pdf",
  "/edit-pdf-metadata",
  "/add-image-stamp-pdf",
  "/create-fillable-pdf",
  "/watermark-pdf",
  "/protect-pdf",
  "/unlock-pdf",
  "/about",
  "/press",
  "/trust",
  "/trust/verification",
  "/guides",
  "/guides/private-pdf-tools",
  "/guides/compress-pdf-without-uploading",
  "/guides/watermark-pdf-without-uploading",
  "/guides/word-to-pdf-without-uploading",
  "/privacy",
  "/terms",
];

export const TOOL_ROUTES = PUBLIC_ROUTES.filter(
  (route) =>
    route !== "/" &&
    route !== "/about" &&
    route !== "/press" &&
    route !== "/trust" &&
    route !== "/trust/verification" &&
    route !== "/guides" &&
    !route.startsWith("/guides/") &&
    route !== "/privacy" &&
    route !== "/terms",
);
