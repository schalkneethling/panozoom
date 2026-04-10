import { defineConfig } from "vite-plus";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "favicon.svg",
        "favicon-96x96.png",
        "panozoom-social-share.png",
        "web-app-manifest-192x192.png",
        "web-app-manifest-512x512.png",
      ],
    }),
  ],
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
