/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_DEFAULT_CURRENCY?: string;
  readonly VITE_APP_ENV?: string;
  readonly VITE_COPILOT_PROVIDER?: string;
  readonly VITE_COPILOT_ENABLE_LIVE?: string;
  readonly VITE_COPILOT_BACKEND_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
