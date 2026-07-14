import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";
const apiProxyRoutes = [
  "/health",
  "/ready",
  "/auth",
  "/me",
  "/api",
  "/coach",
  "/bank",
  "/financial-data",
  "/financial-profile",
  "/onboarding",
  "/categories",
  "/budgets",
  "/accounts",
  "/transactions",
  "/goals",
  "/recurring-items",
  "/recurring-events",
  "/checkpoints",
  "/today",
  "/before-you-buy"
];

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020"
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: Object.fromEntries(
      apiProxyRoutes.map((route) => [
        route,
        {
          target: apiProxyTarget
        }
      ])
    )
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
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
