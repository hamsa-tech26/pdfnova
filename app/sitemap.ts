import type { MetadataRoute } from "next";

const siteUrl = "https://pdfnova-sable.vercel.app";

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
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}