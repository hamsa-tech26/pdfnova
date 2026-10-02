import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JPG to PDF Converter - Images to PDF",
  description: "Convert JPG and PNG images into a single PDF document directly in your browser with Kukureku.",
  alternates: {
    canonical: "/jpg-to-pdf",
  },
  openGraph: {
    title: "JPG to PDF Converter - Images to PDF",
    description: "Convert JPG and PNG images into a single PDF document directly in your browser with Kukureku.",
    url: "/jpg-to-pdf",
    type: "website",
  },
  twitter: {
    title: "JPG to PDF Converter - Images to PDF",
    description: "Convert JPG and PNG images into a single PDF document directly in your browser with Kukureku.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
