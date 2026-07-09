import { env } from "../env";
import { buildCopilotContext } from "./copilotContext";
import { selectCopilotProvider } from "./copilotProvider";
import { copilotTools } from "./copilotTools";
import { mockCopilotProvider } from "./mockProvider";
import { createOpenAiCopilotProvider } from "./openaiProvider";
import { remoteCopilotProvider } from "./remoteProvider";
import type {
  CopilotProvider,
  CopilotProviderId,
  CopilotReply,
  CopilotServiceConfig,
  CopilotServiceRequest
} from "./types";

export function resolveCopilotServiceConfig(): CopilotServiceConfig {
  return {
    provider: env.copilotProvider,
    enableLiveProvider: env.copilotLiveEnabled,
    backendPath: env.copilotBackendPath
  };
}

export function createCopilotService(options?: {
  config?: CopilotServiceConfig;
  providers?: Partial<Record<CopilotProviderId, CopilotProvider>>;
}) {
  const config = options?.config ?? resolveCopilotServiceConfig();
  const providers: Record<CopilotProviderId, CopilotProvider> = {
    mock: options?.providers?.mock ?? mockCopilotProvider,
    remote: options?.providers?.remote ?? remoteCopilotProvider,
    openai:
      options?.providers?.openai ??
      createOpenAiCopilotProvider({
        enabled: config.enableLiveProvider,
        backendPath: config.backendPath
      })
  };

  return {
    async generateCopilotReply(input: CopilotServiceRequest): Promise<CopilotReply> {
      const provider = selectCopilotProvider(config, providers);
      const context = buildCopilotContext(input);

      return provider.generateCopilotReply({
        profile: input.profile,
        accounts: input.accounts,
        transactions: input.transactions,
        recurringItems: input.recurringItems,
        budgets: input.budgets,
        goals: input.goals,
        locale: input.locale,
        currency: input.currency,
        recentDecision: input.recentDecision,
        message: input.message,
        history: input.history ?? [],
        context,
        tools: copilotTools
      });
    }
  };
}

export const copilotService = createCopilotService();
