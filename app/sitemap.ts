import { SITE_URL } from "@/lib/site";
import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/merge-pdf",
  "/split-pdf",
  "/compress-pdf",
  "/pdf-to-word",
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

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority:
      route === ""
        ? 1
        : route === "/guides" ||
            route.startsWith("/guides/") ||
            route === "/trust" ||
            route === "/trust/verification"
          ? 0.7
          : route === "/about" || route === "/press"
            ? 0.6
            : route === "/privacy" || route === "/terms"
            ? 0.3
            : 0.8,
  }));
}
