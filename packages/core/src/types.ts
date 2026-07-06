export type RiskLevel = "safe" | "caution" | "hold";

export interface DailyDecisionInput {
  availableBalance: number;
  expectedIncomeToday: number;
  essentialObligations: number;
  committedSpending: number;
  safetyBuffer: number;
  plannedGoalContribution: number;
  currency: string;
  modelVersion: string;
}

export interface DailyDecisionOutput {
  safeToSpendToday: number;
  riskLevel: RiskLevel;
  explanations: string[];
  currency: string;
  modelVersion: string;
}

