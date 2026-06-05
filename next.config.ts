import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serwist injects a webpack config; the production build runs with `--webpack`.
  // In dev (Serwist disabled) we keep fast Turbopack — this empty config tells
  // Next 16 the webpack key is intentional and silences the mismatch error.
  turbopack: {},
};

// PWA / offline app-shell caching. See ARCHITECTURE.md §4.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
