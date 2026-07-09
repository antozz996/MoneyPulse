import { generateMockCopilotReply } from "./copilotMock";
import type { CopilotProvider } from "./types";

export const mockCopilotProvider: CopilotProvider = {
  id: "mock",
  async generateCopilotReply(input) {
    return generateMockCopilotReply({
      profile: input.profile,
      accounts: input.accounts,
      transactions: input.transactions,
      recurringItems: input.recurringItems,
      budgets: input.budgets,
      goals: input.goals,
      locale: input.locale,
      currency: input.currency,
      recentDecision: input.recentDecision,
      message: input.message
    });
  }
};
