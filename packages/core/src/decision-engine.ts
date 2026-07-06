import {
  DOCUMENTED_INPUTS,
  createFinancialSnapshot,
  getNormalizedFinancialInputs
} from "./domain/entities";
import {
  addMoney,
  assertSameCurrency,
  clampMoneyToZero,
  createMoney,
  isGreaterThanMoney,
  isZeroMoney,
  negateMoney,
  subtractMoney,
  sumMoney
} from "./domain/value-objects";
import type {
  AvailableToSpendResult,
  DailyDecisionInput,
  DailyDecisionOutput,
  DecisionConfidence,
  DecisionEngine,
  FinancialSnapshot,
  ForecastResult,
  PurchaseCandidate,
  PurchaseDecision,
  PurchaseEvaluation
} from "./types";

function createExplainabilityLines(snapshot: FinancialSnapshot): readonly string[] {
  return [
    `Started from ${snapshot.availableBalance.currency} ${snapshot.availableBalance.amount.toFixed(2)} available today.`,
    `Added ${snapshot.expectedIncomeToday.currency} ${snapshot.expectedIncomeToday.amount.toFixed(2)} of expected income today.`,
    `Reserved ${snapshot.essentialObligations.currency} ${snapshot.essentialObligations.amount.toFixed(2)} for essentials and ${snapshot.safetyBuffer.currency} ${snapshot.safetyBuffer.amount.toFixed(2)} as a safety buffer.`,
    `Protected ${snapshot.plannedGoalContribution.currency} ${snapshot.plannedGoalContribution.amount.toFixed(2)} for goals and ${snapshot.committedSpending.currency} ${snapshot.committedSpending.amount.toFixed(2)} already committed to discretionary spending.`
  ];
}

function classifyPurchaseDecision(
  currentAvailableToSpendAmount: number,
  purchaseAmount: number,
  rawRemainingAmount: number
): PurchaseDecision {
  if (purchaseAmount === 0) {
    return "safe";
  }

  if (purchaseAmount > currentAvailableToSpendAmount) {
    return "hold";
  }

  if (rawRemainingAmount === 0) {
    return "caution";
  }

  return "safe";
}

export function calculateAvailableToSpend(
  snapshot: FinancialSnapshot
): AvailableToSpendResult {
  const inflows = addMoney(snapshot.availableBalance, snapshot.expectedIncomeToday);
  const outflows = sumMoney([
    snapshot.essentialObligations,
    snapshot.committedSpending,
    snapshot.safetyBuffer,
    snapshot.plannedGoalContribution
  ]);
  const rawAmount = subtractMoney(inflows, outflows);
  const amount = clampMoneyToZero(rawAmount);

  return {
    amount,
    rawAmount,
    modelVersion: snapshot.modelVersion,
    normalizedInputs: getNormalizedFinancialInputs(snapshot),
    documentedInputs: DOCUMENTED_INPUTS,
    explanations: createExplainabilityLines(snapshot)
  };
}

export function evaluatePurchase(
  snapshot: FinancialSnapshot,
  purchase: PurchaseCandidate
): PurchaseEvaluation {
  const current = calculateAvailableToSpend(snapshot);
  assertSameCurrency(current.amount, purchase.amount);

  const rawAvailableToSpendAfterPurchase = subtractMoney(
    current.amount,
    purchase.amount
  );
  const availableToSpendAfterPurchase = clampMoneyToZero(
    rawAvailableToSpendAfterPurchase
  );
  const decision = classifyPurchaseDecision(
    current.amount.amount,
    purchase.amount.amount,
    rawAvailableToSpendAfterPurchase.amount
  );

  return {
    currentAvailableToSpend: current.amount,
    purchaseAmount: purchase.amount,
    availableToSpendAfterPurchase,
    rawAvailableToSpendAfterPurchase,
    delta: negateMoney(purchase.amount),
    canAfford: !isGreaterThanMoney(purchase.amount, current.amount),
    decision,
    modelVersion: snapshot.modelVersion,
    explanations: [
      `Current available to spend is ${current.amount.currency} ${current.amount.amount.toFixed(2)}.`,
      `Evaluated a purchase of ${purchase.amount.currency} ${purchase.amount.amount.toFixed(2)}.`,
      `Projected remaining discretionary headroom is ${availableToSpendAfterPurchase.currency} ${availableToSpendAfterPurchase.amount.toFixed(2)}.`
    ]
  };
}

export function forecast(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): ForecastResult {
  const current = calculateAvailableToSpend(snapshot);

  if (!purchase) {
    return {
      currentAvailableToSpend: current.amount,
      projectedAvailableToSpend: current.amount,
      delta: createMoney(0, current.amount.currency),
      modelVersion: snapshot.modelVersion,
      explanations: [
        "Forecast reflects the current deterministic baseline with no hypothetical purchase.",
        `Projected available to spend remains ${current.amount.currency} ${current.amount.amount.toFixed(2)}.`
      ]
    };
  }

  const evaluation = evaluatePurchase(snapshot, purchase);

  return {
    currentAvailableToSpend: evaluation.currentAvailableToSpend,
    projectedAvailableToSpend: evaluation.availableToSpendAfterPurchase,
    delta: evaluation.delta,
    purchaseDecision: evaluation.decision,
    modelVersion: snapshot.modelVersion,
    explanations: [
      "Forecast reflects the deterministic impact of a single hypothetical purchase.",
      `Projected available to spend changes by ${evaluation.delta.currency} ${evaluation.delta.amount.toFixed(2)}.`
    ]
  };
}

export function confidence(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): DecisionConfidence {
  if (purchase) {
    assertSameCurrency(snapshot.availableBalance, purchase.amount);
  }

  return {
    mode: "deterministic",
    inputCompleteness: "complete",
    usesDocumentedInputsOnly: true,
    purchaseContext: purchase ? "matched-currency" : "not-provided",
    supportedInputs: DOCUMENTED_INPUTS,
    modelVersion: snapshot.modelVersion
  };
}

export function createDecisionEngine(): DecisionEngine {
  return {
    calculateAvailableToSpend,
    evaluatePurchase,
    forecast,
    confidence
  };
}

export function calculateDailySafeToSpend(
  input: DailyDecisionInput
): DailyDecisionOutput {
  const snapshot = createFinancialSnapshot(input);
  const result = calculateAvailableToSpend(snapshot);
  const riskLevel = isZeroMoney(result.amount) ? "hold" : "safe";

  return {
    safeToSpendToday: result.amount.amount,
    riskLevel,
    explanations: result.explanations,
    currency: result.amount.currency,
    modelVersion: result.modelVersion
  };
}
