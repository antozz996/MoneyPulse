import { buildCopilotPrompt } from "./copilotPrompt";
import { mockCopilotProvider } from "./mockProvider";
import type { CopilotProvider, CopilotProviderRequest, CopilotReply } from "./types";

export interface OpenAiCopilotProviderConfig {
  enabled: boolean;
  backendPath?: string | null;
}

function createOpenAiFallback(
  input: CopilotProviderRequest,
  fallbackReason: string
): Promise<CopilotReply> {
  void buildCopilotPrompt(input.context);
  void fallbackReason;

  return mockCopilotProvider.generateCopilotReply(input);
}

export function createOpenAiCopilotProvider(
  config: OpenAiCopilotProviderConfig
): CopilotProvider {
  return {
    id: "openai",
    async generateCopilotReply(input) {
      if (!config.enabled) {
        return createOpenAiFallback(input, "live_provider_disabled");
      }

      if (!config.backendPath?.trim()) {
        return createOpenAiFallback(input, "missing_secure_backend_path");
      }

      // TODO: Replace this fallback with a secure backend proxy call that keeps secrets
      // off the client and sends only the minimal safe copilot context plus prompt.
      return createOpenAiFallback(input, "secure_backend_proxy_not_implemented");
    }
  };
}
