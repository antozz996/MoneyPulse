import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/health": apiProxyTarget,
      "/accounts": apiProxyTarget,
      "/transactions": apiProxyTarget,
      "/goals": apiProxyTarget,
      "/today": apiProxyTarget,
      "/before-you-buy": apiProxyTarget
    }
  },
  resolve: {
    alias: [
      {
        find: "@moneypulse/ui/styles.css",
        replacement: path.resolve(__dirname, "../../packages/ui/src/styles.css")
      },
      {
        find: "@moneypulse/core",
        replacement: path.resolve(__dirname, "../../packages/core/src/index.ts")
      },
      {
        find: "@moneypulse/ui",
        replacement: path.resolve(__dirname, "../../packages/ui/src/index.ts")
      }
    ]
  }
});
