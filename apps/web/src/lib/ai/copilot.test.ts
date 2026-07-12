import { describe, expect, it } from "vitest";

import { classifyIntent } from "./intents";
import {
  analyzeBudgets,
  analyzeGoals,
  forecastCycleEnd,
  generateSurvivalPlan,
  getFinancialSnapshot,
  simulatePurchase
} from "./copilotTools";
import { buildCopilotPrompt, MONEY_PULSE_COPILOT_SYSTEM_PROMPT } from "./copilotPrompt";
import { generateMockCopilotReply } from "./copilotMock";
import type { CopilotEngineInput } from "./types";
import { createMoneyAmount } from "../engine";
import { formatCurrency } from "../format";

function money(amount: number, currency = "EUR") {
  return createMoneyAmount(amount, currency);
}

function createFixture(): CopilotEngineInput {
  return {
    profile: {
      salaryDay: 27,
      protectedBalance: money(200),
      riskProfile: "BALANCED",
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
        type: "INCOME",
        effectiveDate: "2026-07-27",
        confirmed: true
      },
      {
        id: 2,
        name: "Rent",
        amount: money(650),
        type: "FIXED_EXPENSE",
        effectiveDate: "2026-07-15",
        category: "housing",
        confirmed: true
      },
      {
        id: 3,
        name: "Dining",
        amount: money(140),
        type: "DISCRETIONARY_EXPENSE",
        effectiveDate: "2026-07-10",
        category: "fun",
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
        priority: "ESSENTIAL",
        active: true,
        kind: "SAFETY_BUFFER"
      },
      {
        id: 2,
        name: "Trip",
        targetAmount: money(1500),
        plannedContribution: money(90),
        reservedAmount: money(0),
        priority: "FLEXIBLE",
        active: true,
        kind: "GOAL"
      }
    ]
  };
}

function createMissingDataFixture(): CopilotEngineInput {
  return {
    profile: {
      salaryDay: null,
      protectedBalance: money(0),
      riskProfile: "BALANCED",
      today: "2026-07-09"
    },
    accounts: [
      {
        id: 1,
        name: "Main",
        balance: money(250)
      }
    ],
    transactions: [],
    recurringItems: [],
    budgets: [],
    goals: []
  };
}

describe("copilot AI foundation", () => {
  it("classifies supported intents deterministically", () => {
    expect(classifyIntent("Come sto andando?").intent).toBe("health_check");
    expect(classifyIntent("Posso spendere 300 euro questo weekend?")).toEqual({
      intent: "affordability_check",
      confidence: 0.94,
      entities: {
        amount: 300,
        currency: "EUR"
      }
    });
    expect(classifyIntent("Dove sto spendendo troppo?").intent).toBe("budget_analysis");
    expect(classifyIntent("Come vanno i miei obiettivi?").intent).toBe("goal_analysis");
    expect(classifyIntent("Come chiudo il mese?").intent).toBe("forecast_check");
    expect(classifyIntent("Fammi un piano fino allo stipendio").intent).toBe("survival_plan");
  });

  it("wraps financial snapshot outputs in the copilot tool layer", () => {
    const result = getFinancialSnapshot(createFixture());

    expect(result.snapshot.realAvailabilityNow.currency).toBe("EUR");
    expect(result.decision.level).toBeDefined();
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.grounding.keyNumbers.safeDailySpend.currency).toBe("EUR");
  });

  it("wraps affordability simulation through the tool layer", () => {
    const result = simulatePurchase({
      ...createFixture(),
      purchaseAmount: money(120),
      description: "Weekend trip"
    });

    expect(result.affordability.decision.level).toBeDefined();
    expect(result.summary[0].length).toBeGreaterThan(0);
    expect(result.grounding.keyNumbers.availabilityBefore.currency).toBe("EUR");
  });

  it("analyzes budgets through engine outputs", () => {
    const result = analyzeBudgets(createFixture());

    expect(result.overall).toBe("NEAR_LIMIT");
    expect(result.nearLimitCategories).toContain("fun");
  });

  it("analyzes goals through engine outputs", () => {
    const result = analyzeGoals(createFixture());

    expect(result.essentialCovered).toBe(false);
    expect(result.flexibleDeferred).toBe(true);
  });

  it("builds a forecast tool result", () => {
    const result = forecastCycleEnd(createFixture());

    expect(result.forecast.snapshot.projectedAvailability.currency).toBe("EUR");
    expect(result.decision.level).toBeDefined();
  });

  it("contains the non-invention rule in the system prompt", () => {
    expect(MONEY_PULSE_COPILOT_SYSTEM_PROMPT).toContain("never invent numbers");
    expect(
      buildCopilotPrompt({
        locale: "it",
        currency: "EUR",
        riskProfile: "BALANCED",
        snapshotSummary: {
          cycleStart: "2026-06-27",
          cycleEnd: "2026-07-26",
          realAvailabilityNow: money(400),
          projectedAvailability: money(900),
          safeDailySpend: money(22),
          decisionLevel: "GREEN"
        },
        budgetSummary: {
          overall: "HEALTHY",
          overLimitCategories: [],
          nearLimitCategories: []
        },
        goalSummary: {
          essentialCovered: true,
          importantCovered: true,
          flexibleDeferred: false,
          remainingThisCycle: money(0)
        }
      }).systemPrompt
    ).toContain("Protected balance is a hard constraint");
  });

  it("uses engine outputs in the mock affordability answer", () => {
    const affordability = simulatePurchase({
      ...createFixture(),
      purchaseAmount: money(300),
      description: "Weekend"
    });
    const response = generateMockCopilotReply({
      ...createFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Posso spendere 300 euro questo weekend?"
    });

    expect(response.intent).toBe("affordability_check");
    expect(response.answer).toContain(
      formatCurrency(
        affordability.grounding.keyNumbers.availabilityBefore.amount,
        affordability.grounding.keyNumbers.availabilityBefore.currency,
        "it"
      )
    );
    expect(response.answer).toContain(
      formatCurrency(
        affordability.grounding.keyNumbers.availabilityAfter.amount,
        affordability.grounding.keyNumbers.availabilityAfter.currency,
        "it"
      )
    );
  });

  it("falls back safely for unknown intents", () => {
    const response = generateMockCopilotReply({
      ...createFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Raccontami una barzelletta"
    });

    expect(response.intent).toBe("unknown");
    expect(response.answer).toContain("disponibilita'");
  });

  it("generates a deterministic survival plan", () => {
    const result = generateSurvivalPlan(createFixture());

    expect(result.steps.length).toBeGreaterThan(1);
    expect(result.safeDailySpend.currency).toBe("EUR");
    expect(result.grounding.keyNumbers.safeDailySpend.amount).toBe(result.safeDailySpend.amount);
  });

  it("handles missing data honestly instead of pretending certainty", () => {
    const response = generateMockCopilotReply({
      ...createMissingDataFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Come sto andando?"
    });

    expect(response.answer).toContain("Dati mancanti");
    expect(response.answer).toContain("giorno dello stipendio");
    expect(response.answer).toContain("saldo protetto");
  });

  it("mentions protected balance on BLACK affordability decisions", () => {
    const response = generateMockCopilotReply({
      ...createMissingDataFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Posso spendere 400 euro oggi?"
    });

    expect(response.answer).toContain("saldo protetto");
    expect(response.answer).toContain("BLACK");
  });

  it("survival plan answer uses safe daily spend", () => {
    const result = generateSurvivalPlan(createFixture());
    const response = generateMockCopilotReply({
      ...createFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Fammi un piano fino allo stipendio"
    });

    expect(response.answer).toContain(
      formatCurrency(result.safeDailySpend.amount, result.safeDailySpend.currency, "it")
    );
  });

  it("mock copilot remains deterministic for the same input", () => {
    const input = {
      ...createFixture(),
      locale: "it-IT",
      currency: "EUR",
      message: "Come chiudo il mese?"
    } as const;

    const first = generateMockCopilotReply(input);
    const second = generateMockCopilotReply(input);

    expect(second.answer).toBe(first.answer);
  });
});
