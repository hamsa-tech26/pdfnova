import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kukureku PDF - Free Private PDF Tools",
    short_name: "Kukureku",
    description:
      "Free, fast, private browser-based PDF tools for everyday document work.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",

    icons: [
      {
        src: "/brand/kukureku-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/brand/kukureku-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
