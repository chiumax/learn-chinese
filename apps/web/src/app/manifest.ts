import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "learn-chinese",
    short_name: "学中文",
    description: "Offline-first spaced repetition for learning Chinese",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
