import type { Metadata } from "next";

import { defaultSiteSettings } from "@/lib/mock-data";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wenlan.local"),
  title: {
    default: `${defaultSiteSettings.name} | ${defaultSiteSettings.subtitle}`,
    template: `%s | ${defaultSiteSettings.name}`,
  },
  description: defaultSiteSettings.heroDescription,
  icons: {
    icon: [{ url: "/branding/wenlan-favicon.png", type: "image/png", sizes: "256x256" }],
    shortcut: "/branding/wenlan-favicon.png",
    apple: [{ url: "/branding/wenlan-favicon.png", sizes: "256x256", type: "image/png" }],
  },
  openGraph: {
    title: `${defaultSiteSettings.name} | ${defaultSiteSettings.subtitle}`,
    description: defaultSiteSettings.heroDescription,
    siteName: defaultSiteSettings.name,
    images: [
      {
        url: "/branding/wenlan-logo.png",
        width: 1254,
        height: 1254,
        alt: "文览 · 十七°",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${defaultSiteSettings.name} | ${defaultSiteSettings.subtitle}`,
    description: defaultSiteSettings.heroDescription,
    images: ["/branding/wenlan-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <a href="#main-content" className="skip-link">
          跳到正文
        </a>
        {children}
      </body>
    </html>
  );
}
