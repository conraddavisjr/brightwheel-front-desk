import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "brightwheel Front Desk",
    short_name: "Front Desk",
    description: "Ask your school anything. Instant answers from the school's own handbook.",
    start_url: "/ask",
    scope: "/",
    display: "standalone",
    background_color: "#F7F9FF",
    theme_color: "#5463D6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
