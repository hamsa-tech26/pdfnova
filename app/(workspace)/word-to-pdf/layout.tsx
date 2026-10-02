import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Word to PDF Converter - Convert DOCX to PDF",
  description: "Convert DOCX text, headings, lists, and basic tables into PDF files directly in your browser with Kukureku.",
  alternates: {
    canonical: "/word-to-pdf",
  },
  openGraph: {
    title: "Word to PDF Converter - Convert DOCX to PDF",
    description: "Convert DOCX text, headings, lists, and basic tables into PDF files directly in your browser with Kukureku.",
    url: "/word-to-pdf",
    type: "website",
  },
  twitter: {
    title: "Word to PDF Converter - Convert DOCX to PDF",
    description: "Convert DOCX text, headings, lists, and basic tables into PDF files directly in your browser with Kukureku.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
