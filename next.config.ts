import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-Chromium packages out of the server bundle so the large
  // @sparticuz/chromium binary is loaded at runtime (required for Netlify/OpenNext
  // /Lambda PDF export) instead of being bundled by the compiler.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
