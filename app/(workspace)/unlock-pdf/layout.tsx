import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unlock PDF Online - Remove PDF Password Protection",
  description: "Unlock password-protected PDF files using the correct password directly in your browser with PDFNova.",
  alternates: {
    canonical: "/unlock-pdf",
  },
  openGraph: {
    title: "Unlock PDF Online - Remove PDF Password Protection",
    description: "Unlock password-protected PDF files using the correct password directly in your browser with PDFNova.",
    url: "/unlock-pdf",
    type: "website",
  },
  twitter: {
    title: "Unlock PDF Online - Remove PDF Password Protection",
    description: "Unlock password-protected PDF files using the correct password directly in your browser with PDFNova.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
