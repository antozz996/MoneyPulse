import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appendCopilotTurn,
  buildIntroMessage,
  CopilotScreen,
  createCopilotReply,
  getSuggestedCopilotPrompts
} from "./CopilotScreen";
import { createMoneyAmount } from "./lib/engine";
import { I18nProvider, translate, type LanguageCode } from "./lib/i18n";

function money(amount: number, currency = "EUR") {
  return createMoneyAmount(amount, currency);
}

function t(language: LanguageCode) {
  return (key: string) =>
    translate(language, key as Parameters<typeof translate>[1]);
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
    currency: "EUR",
    hasFinancialContext: true
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CopilotScreen", () => {
  it("renders the Copilot screen", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <CopilotScreen {...createFixture()} />
      </I18nProvider>
    );

    expect(markup).toContain("Copilot");
    expect(markup).toContain("Deterministic Copilot");
    expect(markup).toContain("Conversation");
  });

  it("renders the suggested prompt chips", () => {
    const prompts = getSuggestedCopilotPrompts(t("it"));

    expect(prompts).toEqual([
      "Come sto andando?",
      "Posso spendere 300 euro questo weekend?",
      "Dove sto spendendo troppo?",
      "Come vanno i miei obiettivi?",
      "Come chiudo il mese?",
      "Fammi un piano fino allo stipendio"
    ]);
  });

  it("clicking a prompt can create a user message and assistant answer", () => {
    const initialMessages = [buildIntroMessage(t("it"))];
    return appendCopilotTurn(initialMessages, {
      ...createFixture(),
      language: "it",
      message: "Posso spendere 300 euro questo weekend?"
    }).then((messages) => {
      expect(messages).toHaveLength(3);
      expect(messages[1]).toMatchObject({
        role: "user",
        text: "Posso spendere 300 euro questo weekend?"
      });
      expect(messages[2].role).toBe("assistant");
      expect(messages[2].text).toMatch(/GREEN|YELLOW|RED|BLACK/);
    });
  });

  it("typing a supported question returns an answer", async () => {
    const reply = await createCopilotReply({
      ...createFixture(),
      currency: "EUR",
      language: "it",
      message: "Come chiudo il mese?"
    });

    expect(reply.role).toBe("assistant");
    expect(reply.text).toContain("€");
  });

  it("unknown intent returns a deterministic fallback", async () => {
    const reply = await createCopilotReply({
      ...createFixture(),
      currency: "EUR",
      language: "it",
      message: "Raccontami una barzelletta"
    });

    expect(reply.text).toContain("disponibilita'");
  });

  it("does not require any live AI or API dependency", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await createCopilotReply({
      ...createFixture(),
      currency: "EUR",
      language: "it",
      message: "Come sto andando?"
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
