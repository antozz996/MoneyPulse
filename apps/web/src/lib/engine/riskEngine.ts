import type { FinancialProfile, FinancialSnapshot, RiskAssessment, RiskLevel, RiskProfile } from "./types";

const SAFE_DAILY_THRESHOLDS: Record<RiskProfile, { yellow: number; red: number }> = {
  CONSERVATIVE: { yellow: 20, red: 8 },
  BALANCED: { yellow: 15, red: 5 },
  AGGRESSIVE: { yellow: 10, red: 3 }
};

function reasoned(level: RiskLevel, reasons: string[], confidence: number, snapshot: FinancialSnapshot): RiskAssessment {
  return {
    level,
    reasons,
    protectedBalanceBreached: snapshot.availableBalance.amount < 0,
    essentialGoalsCovered: snapshot.goalStatus.essentialCovered,
    importantGoalsCovered: snapshot.goalStatus.importantCovered,
    flexibleGoalsDelayed: snapshot.goalStatus.flexibleDeferred,
    safeDailySpendHealthy: snapshot.safeDailySpend.amount > SAFE_DAILY_THRESHOLDS.BALANCED.yellow,
    budgetNearLimit: snapshot.budgetStatus.nearLimitCount > 0,
    budgetOverLimit: snapshot.budgetStatus.overLimitCount > 0,
    confidence
  };
}

export function assessRisk(
  snapshot: FinancialSnapshot,
  profile: FinancialProfile
): RiskAssessment {
  const thresholds = SAFE_DAILY_THRESHOLDS[profile.riskProfile];
  const reasons: string[] = [];

  if (snapshot.availableBalance.amount < 0) {
    reasons.push("Protected balance would be breached.");
    return reasoned("BLACK", reasons, 0.99, snapshot);
  }

  if (!snapshot.goalStatus.essentialCovered) {
    reasons.push("Essential goals are not fully covered for this cycle.");
  }

  if (!snapshot.goalStatus.importantCovered) {
    reasons.push("Important goals are compromised by the remaining cycle room.");
  }

  if (snapshot.realAvailabilityNow.amount <= 0) {
    reasons.push("Real availability is exhausted for the current cycle.");
  }

  if (
    snapshot.daysRemainingInCycle > 7 &&
    snapshot.safeDailySpend.amount <= thresholds.red
  ) {
    reasons.push("Safe daily spend is too low for the days left in the cycle.");
  }

  if (reasons.length > 0) {
    return reasoned("RED", reasons, 0.92, snapshot);
  }

  const cautionReasons: string[] = [];

  if (snapshot.daysRemainingInCycle > 7 && snapshot.safeDailySpend.amount <= thresholds.yellow) {
    cautionReasons.push("Safe daily spend is reduced until the next cycle.");
  }

  if (snapshot.budgetStatus.overLimitCount > 0 || snapshot.budgetStatus.nearLimitCount > 0) {
    cautionReasons.push("One or more category budgets are near or over their limit.");
  }

  if (snapshot.goalStatus.flexibleDeferred) {
    cautionReasons.push("Flexible goals may need to be delayed this cycle.");
  }

  if (cautionReasons.length > 0) {
    return reasoned("YELLOW", cautionReasons, 0.88, snapshot);
  }

  return reasoned(
    "GREEN",
    [
      "Real availability remains positive.",
      "Protected balance stays intact.",
      "Essential goals are covered for the current cycle."
    ],
    0.95,
    snapshot
  );
}
