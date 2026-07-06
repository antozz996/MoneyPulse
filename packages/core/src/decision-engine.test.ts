import { describe, expect, it } from "vitest";

import {
  DOCUMENTED_INPUTS,
  addMoney,
  assertSameCurrency,
  calculateAvailableToSpend,
  calculateDailySafeToSpend,
  clampMoneyToZero,
  confidence,
  createCurrency,
  createDecisionEngine,
  createFinancialSnapshot,
  createModelVersion,
  createMoney,
  createNonNegativeMoney,
  createPurchaseCandidate,
  evaluatePurchase,
  forecast,
  getNormalizedFinancialInputs,
  getSnapshotCurrency,
  isGreaterThanMoney,
  isZeroMoney,
  negateMoney,
  subtractMoney,
  sumMoney
} from "./index";

describe("value objects", () => {
  it("normalizes and validates currency and version values", () => {
    expect(createCurrency(" eur ")).toBe("EUR");
    expect(createModelVersion(" 1.0.0 ")).toBe("1.0.0");
    expect(() => createCurrency("   ")).toThrow("Currency must not be empty.");
    expect(() => createModelVersion("")).toThrow(
      "Model version must not be empty."
    );
  });

  it("creates, combines, clamps, and compares money values", () => {
    const currency = createCurrency("eur");
    const ten = createMoney(10.004, currency);
    const five = createNonNegativeMoney(5, currency);

    expect(ten.amount).toBe(10);
    expect(addMoney(ten, five).amount).toBe(15);
    expect(subtractMoney(ten, five).amount).toBe(5);
    expect(sumMoney([ten, five]).amount).toBe(15);
    expect(negateMoney(five).amount).toBe(-5);
    expect(clampMoneyToZero(createMoney(-3, currency)).amount).toBe(0);
    expect(isGreaterThanMoney(ten, five)).toBe(true);
    expect(isZeroMoney(createMoney(0, currency))).toBe(true);
  });

  it("rejects invalid money states", () => {
    const eur = createCurrency("EUR");
    const usd = createCurrency("USD");

    expect(() => createMoney(Number.NaN, eur)).toThrow(
      "Money amount must be a finite number."
    );
    expect(() => createNonNegativeMoney(-1, eur)).toThrow(
      "Money amount must be non-negative."
    );
    expect(() => sumMoney([])).toThrow(
      "sumMoney requires at least one money value."
    );
    expect(() => assertSameCurrency(createMoney(1, eur), createMoney(1, usd))).toThrow(
      "Money values must use the same currency."
    );
  });
});

describe("domain entities", () => {
  it("creates normalized financial snapshots and purchase candidates", () => {
    const snapshot = createFinancialSnapshot({
      availableBalance: 1650,
      expectedIncomeToday: 0,
      essentialObligations: 420,
      committedSpending: 75,
      safetyBuffer: 300,
      plannedGoalContribution: 150,
      currency: " eur ",
      modelVersion: " 1.0.0 "
    });

    const purchase = createPurchaseCandidate({
      amount: 25,
      currency: "eur",
      description: "  Groceries "
    });

    expect(getSnapshotCurrency(snapshot)).toBe("EUR");
    expect(getNormalizedFinancialInputs(snapshot)).toEqual({
      availableBalance: { amount: 1650, currency: "EUR" },
      expectedIncomeToday: { amount: 0, currency: "EUR" },
      essentialObligations: { amount: 420, currency: "EUR" },
      committedSpending: { amount: 75, currency: "EUR" },
      safetyBuffer: { amount: 300, currency: "EUR" },
      plannedGoalContribution: { amount: 150, currency: "EUR" }
    });
    expect(purchase.description).toBe("Groceries");
  });

  it("drops empty optional purchase descriptions", () => {
    const purchase = createPurchaseCandidate({
      amount: 15,
      currency: "EUR",
      description: "   "
    });

    expect(purchase.description).toBeUndefined();
  });
});

describe("decision engine", () => {
  const snapshot = createFinancialSnapshot({
    availableBalance: 1650,
    expectedIncomeToday: 0,
    essentialObligations: 420,
    committedSpending: 75,
    safetyBuffer: 300,
    plannedGoalContribution: 150,
    currency: "EUR",
    modelVersion: "1.0.0"
  });

  it("calculates available to spend from documented inputs only", () => {
    const result = calculateAvailableToSpend(snapshot);

    expect(result.amount).toEqual({ amount: 705, currency: "EUR" });
    expect(result.rawAmount).toEqual({ amount: 705, currency: "EUR" });
    expect(result.modelVersion).toBe("1.0.0");
    expect(result.documentedInputs).toEqual(DOCUMENTED_INPUTS);
    expect(result.normalizedInputs.availableBalance.amount).toBe(1650);
    expect(result.explanations).toHaveLength(4);
  });

  it("clamps negative available to spend to zero", () => {
    const constrained = createFinancialSnapshot({
      availableBalance: 100,
      expectedIncomeToday: 0,
      essentialObligations: 90,
      committedSpending: 20,
      safetyBuffer: 10,
      plannedGoalContribution: 5,
      currency: "EUR",
      modelVersion: "1.0.0"
    });

    const result = calculateAvailableToSpend(constrained);

    expect(result.rawAmount.amount).toBe(-25);
    expect(result.amount.amount).toBe(0);
  });

  it("evaluates purchases as safe, caution, or hold without undocumented thresholds", () => {
    const safePurchase = evaluatePurchase(
      snapshot,
      createPurchaseCandidate({ amount: 200, currency: "EUR" })
    );
    const cautionPurchase = evaluatePurchase(
      snapshot,
      createPurchaseCandidate({ amount: 705, currency: "EUR" })
    );
    const holdPurchase = evaluatePurchase(
      snapshot,
      createPurchaseCandidate({ amount: 706, currency: "EUR" })
    );
    const freePurchase = evaluatePurchase(
      snapshot,
      createPurchaseCandidate({ amount: 0, currency: "EUR" })
    );

    expect(safePurchase.decision).toBe("safe");
    expect(safePurchase.canAfford).toBe(true);
    expect(safePurchase.availableToSpendAfterPurchase.amount).toBe(505);

    expect(cautionPurchase.decision).toBe("caution");
    expect(cautionPurchase.canAfford).toBe(true);
    expect(cautionPurchase.availableToSpendAfterPurchase.amount).toBe(0);

    expect(holdPurchase.decision).toBe("hold");
    expect(holdPurchase.canAfford).toBe(false);
    expect(holdPurchase.rawAvailableToSpendAfterPurchase.amount).toBe(-1);
    expect(holdPurchase.availableToSpendAfterPurchase.amount).toBe(0);

    expect(freePurchase.decision).toBe("safe");
    expect(freePurchase.delta.amount).toBe(0);
  });

  it("rejects purchase evaluation when currencies do not match", () => {
    expect(() =>
      evaluatePurchase(
        snapshot,
        createPurchaseCandidate({ amount: 5, currency: "USD" })
      )
    ).toThrow("Money values must use the same currency.");
  });

  it("forecasts baseline and purchase impact deterministically", () => {
    const baseline = forecast(snapshot);
    const withPurchase = forecast(
      snapshot,
      createPurchaseCandidate({ amount: 50, currency: "EUR" })
    );

    expect(baseline.currentAvailableToSpend.amount).toBe(705);
    expect(baseline.projectedAvailableToSpend.amount).toBe(705);
    expect(baseline.delta.amount).toBe(0);
    expect(baseline.purchaseDecision).toBeUndefined();

    expect(withPurchase.projectedAvailableToSpend.amount).toBe(655);
    expect(withPurchase.delta.amount).toBe(-50);
    expect(withPurchase.purchaseDecision).toBe("safe");
  });

  it("reports deterministic confidence metadata", () => {
    const withoutPurchase = confidence(snapshot);
    const withPurchase = confidence(
      snapshot,
      createPurchaseCandidate({ amount: 10, currency: "EUR" })
    );

    expect(withoutPurchase).toEqual({
      mode: "deterministic",
      inputCompleteness: "complete",
      usesDocumentedInputsOnly: true,
      purchaseContext: "not-provided",
      supportedInputs: DOCUMENTED_INPUTS,
      modelVersion: "1.0.0"
    });
    expect(withPurchase.purchaseContext).toBe("matched-currency");
  });

  it("provides a reusable decision engine skeleton and compatibility wrapper", () => {
    const engine = createDecisionEngine();
    const purchase = createPurchaseCandidate({ amount: 100, currency: "EUR" });

    expect(engine.calculateAvailableToSpend(snapshot).amount.amount).toBe(705);
    expect(engine.evaluatePurchase(snapshot, purchase).availableToSpendAfterPurchase.amount).toBe(
      605
    );
    expect(engine.forecast(snapshot, purchase).delta.amount).toBe(-100);
    expect(engine.confidence(snapshot).mode).toBe("deterministic");

    expect(
      calculateDailySafeToSpend({
        availableBalance: 1650,
        expectedIncomeToday: 0,
        essentialObligations: 420,
        committedSpending: 75,
        safetyBuffer: 300,
        plannedGoalContribution: 150,
        currency: "EUR",
        modelVersion: "1.0.0"
      })
    ).toEqual({
      safeToSpendToday: 705,
      riskLevel: "safe",
      explanations: [
        "Started from EUR 1650.00 available today.",
        "Added EUR 0.00 of expected income today.",
        "Reserved EUR 420.00 for essentials and EUR 300.00 as a safety buffer.",
        "Protected EUR 150.00 for goals and EUR 75.00 already committed to discretionary spending."
      ],
      currency: "EUR",
      modelVersion: "1.0.0"
    });
  });

  it("returns hold from the compatibility wrapper when no discretionary headroom exists", () => {
    expect(
      calculateDailySafeToSpend({
        availableBalance: 100,
        expectedIncomeToday: 0,
        essentialObligations: 90,
        committedSpending: 20,
        safetyBuffer: 10,
        plannedGoalContribution: 5,
        currency: "EUR",
        modelVersion: "1.0.0"
      }).riskLevel
    ).toBe("hold");
  });
});
