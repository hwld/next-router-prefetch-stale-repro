import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "next-router-prefetch-stale-repro",
  description: "Minimal create-next-app repro for a suspected Router Cache bug",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
