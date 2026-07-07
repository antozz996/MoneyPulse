import { describe, expect, it } from "vitest";

import {
  DOCUMENTED_INPUTS,
  addMoney,
  assertSameCurrency,
  assessConfidence,
  assessGoalImpact,
  assessRisk,
  buildTimeline,
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
  explain,
  forecast,
  future,
  getNormalizedFinancialInputs,
  getSnapshotCurrency,
  isGreaterThanMoney,
  isZeroMoney,
  negateMoney,
  recommend,
  simulateScenario,
  subtractMoney,
  sumMoney
} from "./index";

const baseSnapshotInput = {
  availableBalance: 1650,
  expectedIncomeToday: 0,
  essentialObligations: 420,
  committedSpending: 75,
  safetyBuffer: 300,
  plannedGoalContribution: 150,
  currency: "EUR",
  modelVersion: "1.0.0"
} as const;

function createBaseSnapshot() {
  return createFinancialSnapshot(baseSnapshotInput);
}
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
      ...baseSnapshotInput,
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

describe("decision intelligence v2", () => {
  const snapshot = createBaseSnapshot();

  it("builds a deterministic baseline timeline from documented inputs", () => {
    const timeline = buildTimeline(snapshot);

    expect(timeline.openingBalance.amount).toBe(1650);
    expect(timeline.checkpoints.map((checkpoint) => checkpoint.key)).toEqual([
      "expectedIncomeToday",
      "essentialObligations",
      "committedSpending",
      "safetyBuffer",
      "plannedGoalContribution"
    ]);
    expect(timeline.checkpoints.map((checkpoint) => checkpoint.balanceAfter.amount)).toEqual([
      1650,
      1230,
      1155,
      855,
      705
    ]);
    expect(timeline.rawAvailableToSpend.amount).toBe(705);
    expect(timeline.availableToSpend.amount).toBe(705);
  });

  it("adds a purchase phase to the timeline when simulating a scenario", () => {
    const timeline = buildTimeline(
      snapshot,
      createPurchaseCandidate({ amount: 706, currency: "EUR" })
    );

    expect(timeline.checkpoints).toHaveLength(6);
    expect(timeline.checkpoints.at(-1)).toMatchObject({
      key: "purchase",
      phase: "purchase",
      direction: "outflow",
      label: "Hypothetical purchase"
    });
    expect(timeline.checkpoints.at(-1)?.balanceAfter.amount).toBe(-1);
  });

  it("assesses deterministic risk for baseline and purchase scenarios", () => {
    const noPurchase = assessRisk(snapshot);
    const safePurchase = assessRisk(
      snapshot,
      createPurchaseCandidate({ amount: 200, currency: "EUR" })
    );
    const cautionPurchase = assessRisk(
      snapshot,
      createPurchaseCandidate({ amount: 705, currency: "EUR" })
    );
    const holdPurchase = assessRisk(
      snapshot,
      createPurchaseCandidate({ amount: 706, currency: "EUR" })
    );

    expect(noPurchase).toMatchObject({
      currentRiskLevel: "safe",
      projectedRiskLevel: "safe",
      canAfford: true
    });
    expect(safePurchase).toMatchObject({
      projectedRiskLevel: "safe",
      purchaseDecision: "safe",
      canAfford: true
    });
    expect(safePurchase.remainingHeadroom.amount).toBe(505);
    expect(cautionPurchase.purchaseDecision).toBe("caution");
    expect(cautionPurchase.remainingHeadroom.amount).toBe(0);
    expect(holdPurchase.purchaseDecision).toBe("hold");
    expect(holdPurchase.shortfall.amount).toBe(1);
  });

  it("reports goal impact without inventing undocumented goal behavior", () => {
    const baseline = assessGoalImpact(snapshot);
    const protectedPurchase = assessGoalImpact(
      snapshot,
      createPurchaseCandidate({ amount: 200, currency: "EUR" })
    );
    const exposedPurchase = assessGoalImpact(
      snapshot,
      createPurchaseCandidate({ amount: 800, currency: "EUR" })
    );
    const noGoalContribution = assessGoalImpact(
      createFinancialSnapshot({
        ...baseSnapshotInput,
        plannedGoalContribution: 0
      }),
      createPurchaseCandidate({ amount: 50, currency: "EUR" })
    );

    expect(baseline.goalsProtected).toBe(true);
    expect(baseline.currentHeadroomAfterGoals.amount).toBe(705);
    expect(baseline.summary).toContain("already protects EUR 150.00 for goals");

    expect(protectedPurchase.goalsProtected).toBe(true);
    expect(protectedPurchase.remainingHeadroomAfterScenario.amount).toBe(505);

    expect(exposedPurchase.goalsProtected).toBe(false);
    expect(exposedPurchase.remainingHeadroomAfterScenario.amount).toBe(0);
    expect(exposedPurchase.summary).toContain("exceeds the headroom");

    expect(noGoalContribution.summary).toBe(
      "No additional goal contribution is protected in this scenario."
    );
  });

  it("builds deterministic confidence metadata for the scenario engine and legacy adapter", () => {
    const assessment = assessConfidence(snapshot);
    const withPurchase = assessConfidence(
      snapshot,
      createPurchaseCandidate({ amount: 10, currency: "EUR" })
    );
    const legacy = confidence(
      snapshot,
      createPurchaseCandidate({ amount: 10, currency: "EUR" })
    );

    expect(assessment.scenarioMode).toBe("baseline-only");
    expect(assessment.timelineCoverage).toBe("documented-flow");
    expect(withPurchase.purchaseContext).toBe("matched-currency");
    expect(legacy).toEqual({
      mode: "deterministic",
      inputCompleteness: "complete",
      usesDocumentedInputsOnly: true,
      purchaseContext: "matched-currency",
      supportedInputs: DOCUMENTED_INPUTS,
      modelVersion: "1.0.0"
    });
  });

  it("creates recommendations for baseline, caution, and hold scenarios", () => {
    const baseline = recommend(snapshot);
    const caution = recommend(
      snapshot,
      createPurchaseCandidate({ amount: 705, currency: "EUR" })
    );
    const hold = recommend(
      snapshot,
      createPurchaseCandidate({ amount: 800, currency: "EUR", description: "Laptop" })
    );
    const noHeadroom = recommend(
      createFinancialSnapshot({
        ...baseSnapshotInput,
        availableBalance: 100,
        essentialObligations: 90,
        committedSpending: 20,
        safetyBuffer: 10,
        plannedGoalContribution: 5
      })
    );

    expect(baseline.headline).toBe("You can safely spend up to EUR 705.00 today.");
    expect(baseline.riskLevel).toBe("safe");
    expect(caution.headline).toContain("uses the last of today's protected headroom");
    expect(caution.riskLevel).toBe("caution");
    expect(hold.headline).toContain('"Laptop" exceeds today');
    expect(hold.riskLevel).toBe("hold");
    expect(noHeadroom.headline).toBe("Hold discretionary spending today.");
  });

  it("creates explanation bundles and future projections from the scenario engines", () => {
    const purchase = createPurchaseCandidate({
      amount: 100,
      currency: "EUR",
      description: "Shoes"
    });

    const baselineExplanation = explain(snapshot);
    const purchaseExplanation = explain(snapshot, purchase);
    const baselineFuture = future(snapshot);
    const purchaseFuture = future(snapshot, purchase);

    expect(baselineExplanation.summary[0]).toBe(
      "You can safely spend up to EUR 705.00 today."
    );
    expect(baselineExplanation.timelineNarrative).toHaveLength(5);
    expect(purchaseExplanation.summary[0]).toContain('"Shoes" fits today');
    expect(purchaseExplanation.timelineNarrative).toHaveLength(6);

    expect(baselineFuture.scenarioLabel).toBe("baseline");
    expect(baselineFuture.projectedAvailableToSpend.amount).toBe(705);
    expect(purchaseFuture.scenarioLabel).toBe("purchase");
    expect(purchaseFuture.projectedAvailableToSpend.amount).toBe(605);
    expect(purchaseFuture.endingBalance.amount).toBe(605);
    expect(purchaseFuture.purchaseDecision).toBe("safe");
  });

  it("simulates a composed scenario using the v2 engines", () => {
    const scenario = simulateScenario(
      snapshot,
      createPurchaseCandidate({ amount: 100, currency: "EUR" })
    );

    expect(scenario.timeline.availableToSpend.amount).toBe(705);
    expect(scenario.risk.purchaseDecision).toBe("safe");
    expect(scenario.goalImpact.remainingHeadroomAfterScenario.amount).toBe(605);
    expect(scenario.confidence.scenarioMode).toBe("baseline-plus-purchase");
    expect(scenario.recommendation.primaryAmount.amount).toBe(605);
    expect(scenario.explanation.timelineNarrative).toHaveLength(6);
    expect(scenario.future.projectedAvailableToSpend.amount).toBe(605);
  });
});

describe("decision engine v1 compatibility", () => {
  const snapshot = createBaseSnapshot();

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
      ...baseSnapshotInput,
      availableBalance: 100,
      essentialObligations: 90,
      committedSpending: 20,
      safetyBuffer: 10,
      plannedGoalContribution: 5
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

  it("provides a reusable decision engine skeleton and compatibility wrapper", () => {
    const engine = createDecisionEngine();
    const purchase = createPurchaseCandidate({ amount: 100, currency: "EUR" });

    expect(engine.calculateAvailableToSpend(snapshot).amount.amount).toBe(705);
    expect(engine.buildTimeline(snapshot).availableToSpend.amount).toBe(705);
    expect(engine.simulateScenario(snapshot, purchase).future.delta.amount).toBe(-100);
    expect(engine.assessRisk(snapshot, purchase).purchaseDecision).toBe("safe");
    expect(engine.assessGoalImpact(snapshot, purchase).goalsProtected).toBe(true);
    expect(engine.assessConfidence(snapshot).mode).toBe("deterministic");
    expect(engine.recommend(snapshot).riskLevel).toBe("safe");
    expect(engine.explain(snapshot).summary[0]).toBe(
      "You can safely spend up to EUR 705.00 today."
    );
    expect(engine.future(snapshot, purchase).delta.amount).toBe(-100);
    expect(engine.evaluatePurchase(snapshot, purchase).availableToSpendAfterPurchase.amount).toBe(
      605
    );
    expect(engine.forecast(snapshot, purchase).delta.amount).toBe(-100);
    expect(engine.confidence(snapshot).mode).toBe("deterministic");

    expect(calculateDailySafeToSpend(baseSnapshotInput)).toEqual({
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
        ...baseSnapshotInput,
        availableBalance: 100,
        essentialObligations: 90,
        committedSpending: 20,
        safetyBuffer: 10,
        plannedGoalContribution: 5
      }).riskLevel
    ).toBe("hold");
  });
});
