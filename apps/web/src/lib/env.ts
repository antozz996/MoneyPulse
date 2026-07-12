export interface MoneyPulseEnv {
  apiBaseUrl: string;
  defaultCurrency: string;
  appEnv: string;
  authMode: "app" | "demo";
  copilotProvider: "mock" | "remote" | "openai";
  copilotLiveEnabled: boolean;
  copilotBackendPath: string | null;
}

export const env: MoneyPulseEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() ?? "",
  defaultCurrency: (import.meta.env.VITE_DEFAULT_CURRENCY ?? "EUR").trim().toUpperCase(),
  appEnv: (import.meta.env.VITE_APP_ENV ?? "development").trim(),
  authMode: import.meta.env.VITE_AUTH_MODE === "demo" ? "demo" : "app",
  copilotProvider:
    import.meta.env.VITE_COPILOT_PROVIDER === "remote"
      ? "remote"
      : import.meta.env.VITE_COPILOT_PROVIDER === "openai"
        ? "openai"
        : "mock",
  copilotLiveEnabled: import.meta.env.VITE_COPILOT_ENABLE_LIVE === "true",
  copilotBackendPath: import.meta.env.VITE_COPILOT_BACKEND_PATH?.trim() || null
};
