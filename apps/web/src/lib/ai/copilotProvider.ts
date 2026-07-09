import type {
  CopilotProvider,
  CopilotProviderId,
  CopilotServiceConfig
} from "./types";

export function resolveCopilotProviderId(config: CopilotServiceConfig): CopilotProviderId {
  if (config.provider === "remote") {
    return "remote";
  }
  return config.provider === "openai" && config.enableLiveProvider ? "openai" : "mock";
}

export function selectCopilotProvider(
  config: CopilotServiceConfig,
  providers: Record<CopilotProviderId, CopilotProvider>
): CopilotProvider {
  return providers[resolveCopilotProviderId(config)];
}
