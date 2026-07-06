import type { DailyDecisionInput, DailyDecisionOutput, RiskLevel } from "./types";

function resolveRiskLevel(safeToSpendToday: number): RiskLevel {
  if (safeToSpendToday === 0) {
    return "hold";
  }

  if (safeToSpendToday < 150) {
    return "caution";
  }

  return "safe";
}

export function calculateDailySafeToSpend(
  input: DailyDecisionInput
): DailyDecisionOutput {
  const rawAmount =
    input.availableBalance +
    input.expectedIncomeToday -
    input.essentialObligations -
    input.committedSpending -
    input.safetyBuffer -
    input.plannedGoalContribution;

  const safeToSpendToday = Math.max(0, Number(rawAmount.toFixed(2)));
  const riskLevel = resolveRiskLevel(safeToSpendToday);

  return {
    safeToSpendToday,
    riskLevel,
    currency: input.currency,
    modelVersion: input.modelVersion,
    explanations: [
      `Started from ${input.currency} ${input.availableBalance.toFixed(2)} available today.`,
      `Accounted for ${input.currency} ${input.committedSpending.toFixed(2)} already committed to discretionary spending.`,
      `Reserved ${input.currency} ${input.essentialObligations.toFixed(2)} for essentials and ${input.currency} ${input.safetyBuffer.toFixed(2)} as a safety buffer.`,
      `Protected ${input.currency} ${input.plannedGoalContribution.toFixed(2)} for goals before discretionary spending.`
    ]
  };
}
