import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to Word Converter - Convert PDF to DOCX",
  description: "Convert selectable-text PDF documents into editable Word files directly in your browser with PDFNova.",
  alternates: {
    canonical: "/pdf-to-word",
  },
  openGraph: {
    title: "PDF to Word Converter - Convert PDF to DOCX",
    description: "Convert selectable-text PDF documents into editable Word files directly in your browser with PDFNova.",
    url: "/pdf-to-word",
    type: "website",
  },
  twitter: {
    title: "PDF to Word Converter - Convert PDF to DOCX",
    description: "Convert selectable-text PDF documents into editable Word files directly in your browser with PDFNova.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
