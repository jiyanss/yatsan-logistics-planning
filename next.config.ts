import type { NextConfig } from "next";

// Statik export: hem Vercel hem Firebase Hosting (out/) ile uyumlu tek çıktı.
// Uygulama tamamen tarayıcı tarafında çalışır (Firebase Web SDK + IndexedDB).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
