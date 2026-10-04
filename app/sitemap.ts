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
  "/watermark-pdf",
  "/unlock-pdf",
  "/about",
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
        : route === "/about"
          ? 0.6
          : route === "/privacy" || route === "/terms"
            ? 0.3
            : 0.8,
  }));
}
