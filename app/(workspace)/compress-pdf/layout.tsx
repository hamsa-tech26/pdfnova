import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compress PDF Online - Reduce PDF File Size",
  description: "Compress PDF files and reduce file size while preserving readable quality with Peakatee's browser-based PDF tool.",
  alternates: {
    canonical: "/compress-pdf",
  },
  openGraph: {
    title: "Compress PDF Online - Reduce PDF File Size",
    description: "Compress PDF files and reduce file size while preserving readable quality with Peakatee's browser-based PDF tool.",
    url: "/compress-pdf",
    type: "website",
  },
  twitter: {
    title: "Compress PDF Online - Reduce PDF File Size",
    description: "Compress PDF files and reduce file size while preserving readable quality with Peakatee's browser-based PDF tool.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
