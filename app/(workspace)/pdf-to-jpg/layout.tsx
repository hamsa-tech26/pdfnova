import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF to JPG Converter - Convert PDF Pages to Images",
  description: "Convert PDF pages into JPG images and download them individually or as a ZIP with PDFNova.",
  alternates: {
    canonical: "/pdf-to-jpg",
  },
  openGraph: {
    title: "PDF to JPG Converter - Convert PDF Pages to Images",
    description: "Convert PDF pages into JPG images and download them individually or as a ZIP with PDFNova.",
    url: "/pdf-to-jpg",
    type: "website",
  },
  twitter: {
    title: "PDF to JPG Converter - Convert PDF Pages to Images",
    description: "Convert PDF pages into JPG images and download them individually or as a ZIP with PDFNova.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
