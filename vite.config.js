import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Controlled Drug Digital Logbook",
        short_name: "Drug Logbook",

        description:
          "Prototype controlled drug digital logbook application",

        theme_color: "#006de5",
        background_color: "#f8fbfd",

        display: "standalone",

        start_url: "/",

        icons: [
          {
            src: "/favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },

          {
            src: "/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
});