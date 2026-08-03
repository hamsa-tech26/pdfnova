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

export const metadata: Metadata = {
  title: "PDFNova",
  description: "Modern AI-powered PDF workspace",
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