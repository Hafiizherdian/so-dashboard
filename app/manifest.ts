import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard SSS",
    short_name: "SSS",
    description: "Dashboard untuk monitoring penjualan, outstanding, dan LH-KP SSS",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#1c9706",
    icons: [
      {
        src: "/public/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/public/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}