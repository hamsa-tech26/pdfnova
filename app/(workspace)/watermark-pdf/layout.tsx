import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watermark PDF Online - Add Text Watermarks",
  description: "Add custom text watermarks to PDF pages directly in your browser with Peakatee.",
  alternates: {
    canonical: "/watermark-pdf",
  },
  openGraph: {
    title: "Watermark PDF Online - Add Text Watermarks",
    description: "Add custom text watermarks to PDF pages directly in your browser with Peakatee.",
    url: "/watermark-pdf",
    type: "website",
  },
  twitter: {
    title: "Watermark PDF Online - Add Text Watermarks",
    description: "Add custom text watermarks to PDF pages directly in your browser with Peakatee.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
