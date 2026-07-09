import { describe, expect, it, vi } from "vitest";

import { buildCopilotContext } from "./copilotContext";
import { copilotTools } from "./copilotTools";
import { createCopilotService, resolveCopilotServiceConfig } from "./copilotService";
import { env } from "../env";
import { mockCopilotProvider } from "./mockProvider";
import { createOpenAiCopilotProvider } from "./openaiProvider";
import { remoteCopilotProvider } from "./remoteProvider";
import { createMoneyAmount } from "../engine";

function money(amount: number, currency = "EUR") {
  return createMoneyAmount(amount, currency);
}

function createFixture() {
  return {
    profile: {
      salaryDay: 27,
      protectedBalance: money(200),
      riskProfile: "BALANCED" as const,
      today: "2026-07-09"
    },
    accounts: [
      {
        id: 1,
        name: "Main",
        balance: money(1800)
      }
    ],
    transactions: [
      {
        id: 1,
        name: "Salary",
        amount: money(1200),
        type: "INCOME" as const,
        effectiveDate: "2026-07-27",
        confirmed: true
      },
      {
        id: 2,
        name: "Rent",
        amount: money(650),
        type: "FIXED_EXPENSE" as const,
        effectiveDate: "2026-07-15",
        category: "housing",
        confirmed: true
      }
    ],
    recurringItems: [],
    budgets: [
      {
        category: "fun",
        limit: money(150)
      }
    ],
    goals: [
      {
        id: 1,
        name: "Emergency buffer",
        targetAmount: money(3000),
        plannedContribution: money(120),
        reservedAmount: money(60),
        priority: "ESSENTIAL" as const,
        active: true,
        kind: "SAFETY_BUFFER" as const
      }
    ],
    locale: "it-IT",
    currency: "EUR"
  };
}

describe("copilot provider architecture", () => {
  it("mock provider returns a deterministic reply", async () => {
    const input = createFixture();
    const context = buildCopilotContext(input);
    const reply = await mockCopilotProvider.generateCopilotReply({
      ...input,
      message: "Come sto andando?",
      context,
      history: [],
      tools: copilotTools
    });

    expect(reply.provider).toBe("mock");
    expect(reply.answer.length).toBeGreaterThan(0);
    expect(reply.context.snapshotSummary.realAvailabilityNow.currency).toBe("EUR");
  });

  it("copilot service uses mock provider by default", async () => {
    const service = createCopilotService({
      config: {
        provider: "mock",
        enableLiveProvider: false,
        backendPath: null
      }
    });

    const reply = await service.generateCopilotReply({
      ...createFixture(),
      message: "Come chiudo il mese?"
    });

    expect(reply.provider).toBe("mock");
    expect(reply.answer).toContain("€");
  });

  it("frontend can opt into the remote provider explicitly", async () => {
    const provider = {
      ...remoteCopilotProvider,
      generateCopilotReply: vi.fn().mockResolvedValue({
        provider: "mock",
        modelVersion: "server-mock-v1",
        intent: "health_check",
        answer: "server fallback",
        classification: {
          intent: "health_check",
          confidence: 0.84,
          entities: {}
        },
        context: buildCopilotContext(createFixture())
      })
    };
    const service = createCopilotService({
      config: {
        provider: "remote",
        enableLiveProvider: false,
        backendPath: null
      },
      providers: {
        remote: provider
      }
    });

    const reply = await service.generateCopilotReply({
      ...createFixture(),
      message: "Come sto andando?"
    });

    expect(provider.generateCopilotReply).toHaveBeenCalledOnce();
    expect(reply.answer).toBe("server fallback");
  });

  it("missing live AI config does not break the service", async () => {
    const service = createCopilotService({
      config: {
        provider: "openai",
        enableLiveProvider: true,
        backendPath: null
      }
    });

    const reply = await service.generateCopilotReply({
      ...createFixture(),
      message: "Posso spendere 300 euro questo weekend?"
    });

    expect(reply.provider).toBe("mock");
    expect(reply.answer).toMatch(/GREEN|YELLOW|RED|BLACK/);
  });

  it("OpenAI provider is gated and does not run by default", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const provider = createOpenAiCopilotProvider({
      enabled: false,
      backendPath: "/copilot/openai"
    });
    const input = createFixture();
    const context = buildCopilotContext(input);

    const reply = await provider.generateCopilotReply({
      ...input,
      message: "Come sto andando?",
      context,
      history: [],
      tools: copilotTools
    });

    expect(reply.provider).toBe("mock");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("default config stays safe without live AI requirements", () => {
    expect(resolveCopilotServiceConfig()).toMatchObject({
      provider: "mock",
      enableLiveProvider: false,
      backendPath: null
    });
  });

  it("does not expose any client-side API key field", () => {
    expect(Object.keys(env)).not.toContain("copilotOpenAiApiKey");
    expect(Object.keys(env)).not.toContain("openAiApiKey");
  });
});
