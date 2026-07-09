import { describe, expect, it } from "vitest";

import { simulatePurchase } from "./affordabilityEngine";
import { createMoneyAmount } from "./money";
import { assessRisk } from "./riskEngine";
import { calculateGoalStatus } from "./goalEngine";
import { buildFinancialSnapshot } from "./snapshotEngine";
import type {
  Account,
  AffordabilityInput,
  Budget,
  FinancialProfile,
  Goal,
  RecurringItem,
  Transaction
} from "./types";

function money(amount: number, currency = "EUR") {
  return createMoneyAmount(amount, currency);
}

function createProfile(overrides?: Partial<FinancialProfile>): FinancialProfile {
  return {
    salaryDay: null,
    protectedBalance: money(100),
    riskProfile: "BALANCED",
    today: "2026-07-09",
    ...overrides
  };
}

function createAccount(amount: number): Account {
  return {
    name: "Main",
    balance: money(amount)
  };
}

function createTransaction(
  amount: number,
  effectiveDate: string,
  type: Transaction["type"],
  category?: string
): Transaction {
  return {
    name: `${type}-${effectiveDate}`,
    amount: money(amount),
    type,
    effectiveDate,
    category,
    confirmed: true
  };
}

function createGoal(
  name: string,
  priority: Goal["priority"],
  plannedContribution: number,
  reservedAmount = 0
): Goal {
  return {
    name,
    priority,
    targetAmount: money(1000),
    plannedContribution: money(plannedContribution),
    reservedAmount: money(reservedAmount),
    active: true,
    kind: priority === "ESSENTIAL" ? "SAFETY_BUFFER" : "GOAL"
  };
}

function createInput(overrides?: Partial<AffordabilityInput>): AffordabilityInput {
  return {
    profile: createProfile(),
    accounts: [createAccount(1000)],
    transactions: [],
    recurringItems: [],
    budgets: [],
    goals: [],
    purchaseAmount: money(50),
    description: "Test purchase",
    ...overrides
  };
}

describe("financial engine snapshot and affordability", () => {
  it("calculates real availability from balance, protected balance, expenses, and goals", () => {
    const snapshot = buildFinancialSnapshot({
      profile: createProfile(),
      accounts: [createAccount(1000)],
      transactions: [createTransaction(200, "2026-07-12", "FIXED_EXPENSE", "rent")],
      recurringItems: [],
      budgets: [],
      goals: [createGoal("Emergency", "ESSENTIAL", 150, 50)]
    });

    expect(snapshot.realAvailabilityNow).toEqual(money(600));
    expect(snapshot.goalsRemaining).toEqual(money(100));
    expect(snapshot.fixedExpensesRemaining).toEqual(money(200));
  });

  it("detects protected balance breaches as BLACK risk", () => {
    const snapshot = buildFinancialSnapshot({
      profile: createProfile(),
      accounts: [createAccount(50)],
      transactions: [],
      recurringItems: [],
      budgets: [],
      goals: []
    });

    expect(assessRisk(snapshot, createProfile()).level).toBe("BLACK");
  });

  it("returns a GREEN affordability decision when margins stay healthy", () => {
    const result = simulatePurchase(
      createInput({
        accounts: [createAccount(2000)],
        transactions: [createTransaction(300, "2026-07-14", "FIXED_EXPENSE", "rent")],
        purchaseAmount: money(100)
      })
    );

    expect(result.decision.level).toBe("GREEN");
    expect(result.decision.status).toBe("ALLOW");
  });

  it("returns a YELLOW affordability decision when flexible goals are delayed", () => {
    const result = simulatePurchase(
      createInput({
        accounts: [createAccount(900)],
        transactions: [createTransaction(250, "2026-07-14", "FIXED_EXPENSE", "rent")],
        goals: [createGoal("Holiday", "FLEXIBLE", 120, 0)],
        purchaseAmount: money(50)
      })
    );

    expect(result.decision.level).toBe("YELLOW");
    expect(result.decision.status).toBe("ALLOW_WITH_CAUTION");
  });

  it("returns a RED affordability decision when real availability turns negative", () => {
    const result = simulatePurchase(
      createInput({
        accounts: [createAccount(500)],
        transactions: [createTransaction(250, "2026-07-12", "FIXED_EXPENSE", "rent")],
        goals: [createGoal("Insurance", "IMPORTANT", 100, 0)],
        purchaseAmount: money(60)
      })
    );

    expect(result.snapshotAfter.realAvailabilityNow.amount).toBeLessThan(0);
    expect(result.decision.level).toBe("RED");
    expect(result.decision.status).toBe("NOT_RECOMMENDED");
  });

  it("returns a BLACK affordability decision when the purchase breaches protected balance", () => {
    const result = simulatePurchase(
      createInput({
        accounts: [createAccount(150)],
        purchaseAmount: money(60)
      })
    );

    expect(result.snapshotAfter.availableBalance.amount).toBeLessThan(0);
    expect(result.decision.level).toBe("BLACK");
    expect(result.decision.status).toBe("BLOCKED");
  });

  it("simulates installment purchases with current-cycle impact and future commitments", () => {
    const result = simulatePurchase(
      createInput({
        accounts: [createAccount(2000)],
        purchaseAmount: money(1200),
        installments: {
          count: 12,
          cadence: "MONTHLY",
          startDate: "2026-07-09"
        }
      })
    );

    expect(result.currentCycleImpact).toEqual(money(100));
    expect(result.futureCommitments).toHaveLength(11);
    expect(result.futureCommitments[0]).toEqual({
      dueDate: "2026-08-09",
      amount: money(100),
      label: "Test purchase installment 2",
      type: "INSTALLMENT"
    });
  });

  it("respects goal priorities when calculating remaining goal pressure", () => {
    const goalStatus = calculateGoalStatus(
      [
        createGoal("Buffer", "ESSENTIAL", 100, 25),
        createGoal("Laptop", "IMPORTANT", 80, 0),
        createGoal("Trip", "FLEXIBLE", 60, 0)
      ],
      "EUR"
    );

    expect(goalStatus.remainingThisCycle).toEqual(money(155));
    expect(goalStatus.totalRequiredThisCycle).toEqual(money(215));
    expect(goalStatus.flexibleDeferred).toBe(true);
  });

  it("calculates safe daily spend from real availability and days left in cycle", () => {
    const snapshot = buildFinancialSnapshot({
      profile: createProfile({
        today: "2026-07-30",
        protectedBalance: money(0)
      }),
      accounts: [createAccount(100)],
      transactions: [],
      recurringItems: [],
      budgets: [],
      goals: []
    });

    expect(snapshot.daysRemainingInCycle).toBe(2);
    expect(snapshot.safeDailySpend).toEqual(money(50));
  });
});
