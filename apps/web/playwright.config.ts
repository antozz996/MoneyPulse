import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, "../..");
const backendDir = path.resolve(repoRoot, "backend/api");
const pythonBin =
  process.env.MONEYPULSE_PYTHON_BIN ??
  path.resolve(repoRoot, ".venv/bin/python");
const apiPort = Number(process.env.MONEYPULSE_PLAYWRIGHT_API_PORT ?? "8012");
const webPort = Number(process.env.MONEYPULSE_PLAYWRIGHT_WEB_PORT ?? "4175");
const databasePath = path.join(os.tmpdir(), `moneypulse-playwright-${process.pid}.db`);
const databaseUrl = `sqlite+pysqlite:///${databasePath}`;
const localChromePath = "/usr/bin/google-chrome";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/tmp-*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: `MONEYPULSE_DATABASE_URL=${databaseUrl} MONEYPULSE_CORS_ALLOW_ORIGINS=http://127.0.0.1:${webPort} MONEYPULSE_AUTH_RATE_LIMIT_MAX_REQUESTS=200 "${pythonBin}" -m uvicorn app.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: backendDir,
      port: apiPort,
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: `VITE_APP_ENV=e2e VITE_DEFAULT_CURRENCY=EUR VITE_API_BASE_URL=http://127.0.0.1:${apiPort} VITE_API_PROXY_TARGET=http://127.0.0.1:${apiPort} corepack pnpm@10.22.0 --filter @moneypulse/web exec vite --host 127.0.0.1 --port ${webPort}`,
      cwd: repoRoot,
      port: webPort,
      reuseExistingServer: false,
      timeout: 30_000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions:
          !process.env.CI && existsSync(localChromePath)
            ? { executablePath: localChromePath }
            : undefined
      }
    }
  ]
});
