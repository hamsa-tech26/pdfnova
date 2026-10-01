import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organize PDF Online - Reorder, Rotate and Remove Pages",
  description: "Reorder, rotate, move, and remove PDF pages visually in your browser with Peakatee.",
  alternates: {
    canonical: "/organize-pdf",
  },
  openGraph: {
    title: "Organize PDF Online - Reorder, Rotate and Remove Pages",
    description: "Reorder, rotate, move, and remove PDF pages visually in your browser with Peakatee.",
    url: "/organize-pdf",
    type: "website",
  },
  twitter: {
    title: "Organize PDF Online - Reorder, Rotate and Remove Pages",
    description: "Reorder, rotate, move, and remove PDF pages visually in your browser with Peakatee.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
