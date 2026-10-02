import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split PDF Online - Extract PDF Pages",
  description: "Split a PDF and extract selected pages into a new document directly in your browser with Kukureku.",
  alternates: {
    canonical: "/split-pdf",
  },
  openGraph: {
    title: "Split PDF Online - Extract PDF Pages",
    description: "Split a PDF and extract selected pages into a new document directly in your browser with Kukureku.",
    url: "/split-pdf",
    type: "website",
  },
  twitter: {
    title: "Split PDF Online - Extract PDF Pages",
    description: "Split a PDF and extract selected pages into a new document directly in your browser with Kukureku.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
