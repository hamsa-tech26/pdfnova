import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Word to PDF Converter - Convert DOCX to PDF",
  description: "Convert Word DOCX documents into PDF files directly in your browser with PDFNova.",
  alternates: {
    canonical: "/word-to-pdf",
  },
  openGraph: {
    title: "Word to PDF Converter - Convert DOCX to PDF",
    description: "Convert Word DOCX documents into PDF files directly in your browser with PDFNova.",
    url: "/word-to-pdf",
    type: "website",
  },
  twitter: {
    title: "Word to PDF Converter - Convert DOCX to PDF",
    description: "Convert Word DOCX documents into PDF files directly in your browser with PDFNova.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
