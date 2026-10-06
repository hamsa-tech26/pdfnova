import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const TOOL_SEO = {
  "merge-pdf": {
    name: "Merge PDF",
    title: "Merge PDF Online Free - Private, No Upload",
    description:
      "Merge PDF files online for free with no upload. Reorder multiple PDFs and combine them in your browser so your files stay on your device.",
  },
  "split-pdf": {
    name: "Split PDF",
    title: "Split PDF Online - Private Page Extraction",
    description:
      "Split PDF files and extract selected pages privately in your browser. No upload or account required; your PDF stays on your device.",
  },
  "compress-pdf": {
    name: "Compress PDF",
    title: "Compress PDF Online - Private PDF Compressor",
    description:
      "Compress PDF files online in your browser with no upload. Choose an optimization level, reduce file size when possible, and keep files on your device.",
  },
  "pdf-to-word": {
    name: "PDF to Word",
    title: "PDF to Word - Private Browser Converter",
    description:
      "Convert selectable-text PDF files to editable DOCX documents in your browser. No upload or account required; your PDF stays on your device.",
  },
  "word-to-pdf": {
    name: "Word to PDF",
    title: "Word to PDF - Private Browser Converter",
    description:
      "Convert DOCX files to PDF privately in your browser. Preserve readable text, headings, lists, and basic tables without uploading your document.",
  },
  "jpg-to-pdf": {
    name: "JPG to PDF",
    title: "JPG to PDF - Private Image Converter",
    description:
      "Convert JPG and PNG images to one PDF directly in your browser. Arrange image order, create the PDF locally, and keep files on your device.",
  },
  "pdf-to-jpg": {
    name: "PDF to JPG",
    title: "PDF to JPG - Private Browser Converter",
    description:
      "Convert PDF pages to JPG images directly in your browser. Select pages and download images individually or as a ZIP without uploading the PDF.",
  },
  "organize-pdf": {
    name: "Organize PDF",
    title: "Organize PDF - Reorder, Rotate & Delete Pages",
    description:
      "Organize PDF pages privately in your browser. Reorder, rotate, move, or delete pages and download a new PDF without uploading the original.",
  },
  "rotate-pdf": {
    name: "Rotate PDF",
    title: "Rotate PDF Online Free - Private, No Upload",
    description:
      "Rotate PDF pages online for free in your browser. Turn every page clockwise, counter-clockwise, or 180 degrees without uploading your PDF.",
  },
  "watermark-pdf": {
    name: "Watermark PDF",
    title: "Watermark PDF - Add Text or Image Privately",
    description:
      "Add text or image watermarks to PDF pages directly in your browser. Customize placement, opacity, and rotation without uploading your files.",
  },
  "unlock-pdf": {
    name: "Unlock PDF",
    title: "Unlock PDF - Remove Password Protection Privately",
    description:
      "Unlock a PDF you own or are authorized to modify using the correct password. Processing happens locally in your browser and the file is not uploaded.",
  },
} as const;

export type ToolSlug = keyof typeof TOOL_SEO;

export function buildToolMetadata(slug: ToolSlug): Metadata {
  const tool = TOOL_SEO[slug];
  const path = `/${slug}`;

  return {
    title: tool.title,
    description: tool.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tool.title,
      description: tool.description,
    },
  };
}

export function buildToolStructuredData(slug: ToolSlug) {
  const tool = TOOL_SEO[slug];
  const url = `${SITE_URL}/${slug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: `Kukureku PDF - ${tool.name}`,
        url,
        description: tool.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements:
          "Requires a modern web browser with JavaScript enabled.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Kukureku PDF",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: tool.name,
            item: url,
          },
        ],
      },
    ],
  };
}
