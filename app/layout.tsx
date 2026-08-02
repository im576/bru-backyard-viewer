import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bru.sonoranhorizon.com"),
  title: "Backyard Renovation Viewer — Sonoran Horizon",
  description:
    "Interactive 3D before-and-after visualization for backyard layout and option comparison.",
  openGraph: {
    title: "Backyard Renovation Viewer — Sonoran Horizon",
    description: "Explore the proposed backyard layout and compare pergola placement options.",
    images: ["/og.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Backyard Renovation Viewer — Sonoran Horizon",
    description: "Explore the proposed backyard layout and compare pergola placement options.",
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111416",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
