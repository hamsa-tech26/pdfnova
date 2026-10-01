import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge PDF Online - Combine PDF Files",
  description: "Merge multiple PDF files into one document directly in your browser with Peakatee. Fast, private, and easy to use.",
  alternates: {
    canonical: "/merge-pdf",
  },
  openGraph: {
    title: "Merge PDF Online - Combine PDF Files",
    description: "Merge multiple PDF files into one document directly in your browser with Peakatee. Fast, private, and easy to use.",
    url: "/merge-pdf",
    type: "website",
  },
  twitter: {
    title: "Merge PDF Online - Combine PDF Files",
    description: "Merge multiple PDF files into one document directly in your browser with Peakatee. Fast, private, and easy to use.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
