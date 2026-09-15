import type { Metadata, Viewport } from "next";
import { publicAsset } from "@/lib/publicAsset";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMA — Tactile Break Space",
  description: "三种材质，一点留给自己的时间。梳理细沙，按下软膜，拨动磁珠。",
  icons: { icon: publicAsset("/favicon.svg") },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111820",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" translate="no">
      <body>{children}</body>
    </html>
  );
}
