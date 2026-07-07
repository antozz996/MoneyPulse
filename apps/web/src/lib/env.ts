export interface MoneyPulseEnv {
  apiBaseUrl: string;
  defaultCurrency: string;
  appEnv: string;
}

export const env: MoneyPulseEnv = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() ?? "",
  defaultCurrency: (import.meta.env.VITE_DEFAULT_CURRENCY ?? "EUR").trim().toUpperCase(),
  appEnv: (import.meta.env.VITE_APP_ENV ?? "development").trim()
};
