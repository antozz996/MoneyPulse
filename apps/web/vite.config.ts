import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@moneypulse/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@moneypulse/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
      "@moneypulse/ui/styles.css": path.resolve(__dirname, "../../packages/ui/src/styles.css")
    }
  }
});

