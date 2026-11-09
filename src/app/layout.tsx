import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "הזמנה לשישי",
  description: "חלת שניצל, חלות לשבת — והכול טרי, בהזמנה מראש.",
  robots: { index: false, follow: false },
};


export const viewport: Viewport = {
  themeColor: "#2E4A2B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className="antialiased">
      <head>
        <link rel="preload" href="/fonts/heebo-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh bg-bg text-ink">{children}</body>
    </html>
  );
}
