import ThemeProvider from "@/components/providers/ThemeProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://pdfnova-sable.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "PDFNova - Private Browser-Based PDF Tools",
    template: "%s | PDFNova",
  },

  description:
    "Merge, split, compress, convert, organize, watermark, and unlock PDFs with fast, private browser-based tools.",

  applicationName: "PDFNova",

  openGraph: {
    type: "website",
    siteName: "PDFNova",
    title: "PDFNova - Private Browser-Based PDF Tools",
    description:
      "Merge, split, compress, convert, organize, watermark, and unlock PDFs with fast, private browser-based tools.",
  },

  twitter: {
    card: "summary_large_image",
    title: "PDFNova - Private Browser-Based PDF Tools",
    description:
      "Merge, split, compress, convert, organize, watermark, and unlock PDFs with fast, private browser-based tools.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-gray-900 dark:bg-slate-950 dark:text-white">
        <ThemeProvider>
          {children}

          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={3000}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}