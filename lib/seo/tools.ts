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
  "extract-pdf-pages": { name: "Extract PDF Pages", title: "Extract PDF Pages Online - Private, No Upload", description: "Extract selected PDF pages or ranges into a new PDF privately in your browser without uploading your document." },
  "delete-pdf-pages": { name: "Delete PDF Pages", title: "Delete PDF Pages Online - Private, No Upload", description: "Remove unwanted pages from a PDF and download a new copy privately in your browser with no upload." },
  "pdf-to-excel": { name: "PDF to Excel", title: "PDF to Excel XLSX - Private Table Conversion", description: "Convert confidently detected selectable-text PDF tables to genuine Excel XLSX locally in your browser. Scanned PDFs are not supported." },
  "pdf-to-text": { name: "PDF to Text", title: "PDF to Text Online - Private Text Extraction", description: "Extract selectable PDF text into a TXT file directly in your browser. No upload or account required." },
  "flatten-pdf": { name: "Flatten PDF", title: "Flatten PDF Forms Online - Private, No Upload", description: "Flatten supported interactive PDF form fields into page content privately in your browser without uploading the PDF." },
  "ocr-pdf": { name: "OCR PDF", title: "OCR PDF Online - Private Scanned PDF to Text", description: "Recognize English text in scanned PDF pages locally in your browser and download the result as TXT without uploading the document." },
  "reorder-pdf-pages": { name: "Reorder PDF Pages", title: "Reorder PDF Pages Online - Private, No Upload", description: "Rearrange PDF pages into a new order directly in your browser without uploading your document." },
  "reverse-pdf": { name: "Reverse PDF Pages", title: "Reverse PDF Pages Online - Private, No Upload", description: "Reverse the complete page order of a PDF locally in your browser and download a new copy." },
  "remove-pdf-metadata": { name: "Remove PDF Metadata", title: "Remove PDF Metadata Online - Private", description: "Clear common PDF document metadata locally in your browser without uploading your file." },
  "add-page-numbers": { name: "Add Page Numbers", title: "Add Page Numbers to PDF Online - Private", description: "Add simple page numbers to every PDF page locally in your browser without uploading the document." },
  "crop-pdf": {
    name: "Crop PDF",
    title: "Crop PDF Online - Private, No Upload",
    description:
      "Crop visible PDF page margins online in your browser. Trim top, right, bottom, and left edges without uploading your document.",
  },
  "resize-pdf-pages": {
    name: "Resize PDF Pages",
    title: "Resize PDF Pages Online - A4, Letter, Legal & A5",
    description:
      "Resize PDF pages to A4, Letter, Legal, or A5 in your browser. Fit content proportionally, preserve page orientation, and keep your document on your device.",
  },
  "header-footer-pdf": {
    name: "Header & Footer PDF",
    title: "Add Header, Footer & Page Numbers to PDF Online",
    description:
      "Add custom headers, footers, and automatic page numbers to PDF files directly in your browser. No upload or account required.",
  },
  "sign-pdf": {
    name: "Sign PDF",
    title: "Sign PDF Online - Add a Signature Privately",
    description:
      "Draw, type, or upload a visual signature, place it on a PDF page preview, and download the signed copy without uploading your document.",
  },
  "pdf-form-filler": {
    name: "PDF Form Filler",
    title: "Fill PDF Forms Online - Private AcroForm Filler",
    description:
      "Fill standard interactive PDF form fields in your browser, keep them editable or flatten the completed copy, and avoid uploading your form data.",
  },
  "redact-pdf": {
    name: "Redact PDF",
    title: "Redact PDF Online - Permanent Private Redaction",
    description:
      "Mark sensitive PDF content and create a privacy-safe rasterized copy where the original page content is not hidden underneath black boxes.",
  },
  "edit-pdf-metadata": {
    name: "Edit PDF Metadata",
    title: "Edit PDF Metadata Online - Private Document Properties",
    description:
      "Inspect and edit common PDF title, author, subject, keywords, creator, and producer metadata locally in your browser.",
  },
  "add-image-stamp-pdf": {
    name: "Add Image / Stamp PDF",
    title: "Add Image or Stamp to PDF Online - Private",
    description:
      "Create a text stamp or upload a PNG/JPG, then drag, resize, and place it on one PDF page or every page without uploading your files.",
  },
  "create-fillable-pdf": {
    name: "Create Fillable PDF",
    title: "Create Fillable PDF Forms Online - Private",
    description:
      "Draw interactive text fields, checkboxes, and dropdowns on PDF page previews and download a standard fillable AcroForm PDF locally.",
  },
  "watermark-pdf": {
    name: "Watermark PDF",
    title: "Watermark PDF - Add Text or Image Privately",
    description:
      "Add text or image watermarks to PDF pages directly in your browser. Customize placement, opacity, and rotation without uploading your files.",
  },
  "protect-pdf": {
    name: "Protect PDF",
    title: "Protect PDF Online - AES-256 Password Protection",
    description:
      "Password protect a PDF with AES-256 encryption directly in your browser. No upload or account required; your file and password stay on your device.",
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
