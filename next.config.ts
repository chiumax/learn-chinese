import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// Validate environment variables at config load (build + dev start) so a
// missing/malformed var fails fast rather than at runtime. See ARCHITECTURE.md §10.
import "./src/lib/env";

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
