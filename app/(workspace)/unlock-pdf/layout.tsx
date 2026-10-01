import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unlock PDF Online - Remove PDF Password Protection",
  description: "Unlock password-protected PDF files using the correct password directly in your browser with Peakatee.",
  alternates: {
    canonical: "/unlock-pdf",
  },
  openGraph: {
    title: "Unlock PDF Online - Remove PDF Password Protection",
    description: "Unlock password-protected PDF files using the correct password directly in your browser with Peakatee.",
    url: "/unlock-pdf",
    type: "website",
  },
  twitter: {
    title: "Unlock PDF Online - Remove PDF Password Protection",
    description: "Unlock password-protected PDF files using the correct password directly in your browser with Peakatee.",
  },
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
