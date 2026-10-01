import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workspace = path.join(root, "app", "(workspace)");

const tools = [
  {
    route: "merge-pdf",
    title: "Merge PDF Online - Combine PDF Files",
    description:
      "Merge multiple PDF files into one document directly in your browser with PDFNova. Fast, private, and easy to use.",
  },
  {
    route: "split-pdf",
    title: "Split PDF Online - Extract PDF Pages",
    description:
      "Split a PDF and extract selected pages into a new document directly in your browser with PDFNova.",
  },
  {
    route: "compress-pdf",
    title: "Compress PDF Online - Reduce PDF File Size",
    description:
      "Compress PDF files and reduce file size while preserving readable quality with PDFNova's browser-based PDF tool.",
  },
  {
    route: "pdf-to-word",
    title: "PDF to Word Converter - Convert PDF to DOCX",
    description:
      "Convert selectable-text PDF documents into editable Word files directly in your browser with PDFNova.",
  },
  {
    route: "word-to-pdf",
    title: "Word to PDF Converter - Convert DOCX to PDF",
    description:
      "Convert Word DOCX documents into PDF files directly in your browser with PDFNova.",
  },
  {
    route: "jpg-to-pdf",
    title: "JPG to PDF Converter - Images to PDF",
    description:
      "Convert JPG and PNG images into a single PDF document directly in your browser with PDFNova.",
  },
  {
    route: "pdf-to-jpg",
    title: "PDF to JPG Converter - Convert PDF Pages to Images",
    description:
      "Convert PDF pages into JPG images and download them individually or as a ZIP with PDFNova.",
  },
  {
    route: "organize-pdf",
    title: "Organize PDF Online - Reorder, Rotate and Remove Pages",
    description:
      "Reorder, rotate, move, and remove PDF pages visually in your browser with PDFNova.",
  },
  {
    route: "watermark-pdf",
    title: "Watermark PDF Online - Add Text Watermarks",
    description:
      "Add custom text watermarks to PDF pages directly in your browser with PDFNova.",
  },
  {
    route: "unlock-pdf",
    title: "Unlock PDF Online - Remove PDF Password Protection",
    description:
      "Unlock password-protected PDF files using the correct password directly in your browser with PDFNova.",
  },
];

function publicLayout({ route, title, description }) {
  const url = `/${route}`;

  return `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
  alternates: {
    canonical: ${JSON.stringify(url)},
  },
  openGraph: {
    title: ${JSON.stringify(title)},
    description: ${JSON.stringify(description)},
    url: ${JSON.stringify(url)},
    type: "website",
  },
  twitter: {
    title: ${JSON.stringify(title)},
    description: ${JSON.stringify(description)},
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
`;
}

for (const tool of tools) {
  const target = path.join(
    workspace,
    tool.route,
    "layout.tsx",
  );

  fs.writeFileSync(
    target,
    publicLayout(tool),
    "utf8",
  );

  console.log(`SEO metadata: /${tool.route}`);
}

const noindexRoutes = [
  "dashboard",
  "protect-pdf",
];

const noindexLayout = `import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
`;

for (const route of noindexRoutes) {
  const target = path.join(
    workspace,
    route,
    "layout.tsx",
  );

  fs.writeFileSync(target, noindexLayout, "utf8");
  console.log(`NOINDEX metadata: /${route}`);
}

console.log("PDFNova route SEO generation complete.");