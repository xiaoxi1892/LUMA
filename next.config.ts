import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, ""),
  output: "export",
  trailingSlash: true,
  devIndicators: false,
  images: { unoptimized: true },
};

export default nextConfig;
