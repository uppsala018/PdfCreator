import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ebook Studio — AI-Powered Ebook Creator",
    template: "%s | Ebook Studio",
  },
  description:
    "Create professional ebooks and PDFs in minutes with AI-powered tools, a block editor, and beautiful templates.",
  openGraph: {
    type: "website",
    siteName: "Ebook Studio",
    title: "Ebook Studio — AI-Powered Ebook Creator",
    description:
      "Create professional ebooks and PDFs in minutes with AI-powered tools, a block editor, and beautiful templates.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
