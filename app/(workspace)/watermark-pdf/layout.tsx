import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watermark PDF Online - Add Text Watermarks",
  description: "Add custom text watermarks to PDF pages directly in your browser with Kukureku.",
  alternates: {
    canonical: "/watermark-pdf",
  },
  openGraph: {
    title: "Watermark PDF Online - Add Text Watermarks",
    description: "Add custom text watermarks to PDF pages directly in your browser with Kukureku.",
    url: "/watermark-pdf",
    type: "website",
  },
  twitter: {
    title: "Watermark PDF Online - Add Text Watermarks",
    description: "Add custom text watermarks to PDF pages directly in your browser with Kukureku.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
