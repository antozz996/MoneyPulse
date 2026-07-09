import {
  assessRisk,
  type AffordabilityInput,
  buildFinancialSnapshot,
  buildForecast,
  createEngineDecision,
  explainAffordability,
  explainSnapshot,
  simulatePurchase as simulateEnginePurchase
} from "../engine";
import type {
  AffordabilityToolResult,
  BudgetAnalysisResult,
  CopilotEngineInput,
  CopilotToolbox,
  ForecastCheckResult,
  GoalAnalysisResult,
  SnapshotToolResult,
  SurvivalPlanResult
} from "./types";

export function getFinancialSnapshot(input: CopilotEngineInput): SnapshotToolResult {
  const snapshot = buildFinancialSnapshot(input);
  const risk = assessRisk(snapshot, input.profile);
  const decision = createEngineDecision(risk);

  return {
    snapshot,
    risk,
    decision,
    summary: explainSnapshot(snapshot)
  };
}

export function simulatePurchase(input: AffordabilityInput): AffordabilityToolResult {
  const affordability = simulateEnginePurchase(input);

  return {
    affordability,
    summary: explainAffordability(affordability)
  };
}

export function analyzeBudgets(input: CopilotEngineInput): BudgetAnalysisResult {
  const snapshot = buildFinancialSnapshot(input);
  const nearLimitCategories = snapshot.budgetStatus.items
    .filter((item) => item.health === "NEAR_LIMIT")
    .map((item) => item.category);
  const overLimitCategories = snapshot.budgetStatus.items
    .filter((item) => item.health === "OVER_LIMIT")
    .map((item) => item.category);

  return {
    snapshot,
    overall: snapshot.budgetStatus.overall,
    nearLimitCategories,
    overLimitCategories,
    remainingByCategory: snapshot.budgetStatus.items.map((item) => ({
      category: item.category,
      remaining: item.remaining
    }))
  };
}

export function analyzeGoals(input: CopilotEngineInput): GoalAnalysisResult {
  const snapshot = buildFinancialSnapshot(input);

  return {
    snapshot,
    goalStatus: snapshot.goalStatus,
    essentialCovered: snapshot.goalStatus.essentialCovered,
    importantCovered: snapshot.goalStatus.importantCovered,
    flexibleDeferred: snapshot.goalStatus.flexibleDeferred
  };
}

export function forecastCycleEnd(input: CopilotEngineInput): ForecastCheckResult {
  const forecast = buildForecast(input);
  const risk = assessRisk(forecast.snapshot, input.profile);
  const decision = createEngineDecision(risk);

  return {
    forecast,
    decision
  };
}

export function generateSurvivalPlan(input: CopilotEngineInput): SurvivalPlanResult {
  const { decision, forecast } = forecastCycleEnd(input);
  const snapshot = forecast.snapshot;
  const steps: string[] = [];

  if (decision.level === "BLACK") {
    steps.push("Ferma ogni spesa non essenziale finché il saldo protetto non torna intatto.");
  } else if (decision.level === "RED") {
    steps.push("Riduci subito la spesa discrezionale e proteggi il resto del ciclo.");
  } else if (decision.level === "YELLOW") {
    steps.push("Conserva margine: limita le spese opzionali fino al prossimo reset del ciclo.");
  } else {
    steps.push("Mantieni il ritmo attuale e continua a verificare le prossime uscite.");
  }

  steps.push(
    `Tetto giornaliero sicuro: ${snapshot.safeDailySpend.amount.toFixed(2)} ${snapshot.safeDailySpend.currency}.`
  );

  if (forecast.nextCheckpoint) {
    steps.push(
      `Prossimo checkpoint: ${forecast.nextCheckpoint.label} il ${forecast.nextCheckpoint.date}.`
    );
  }

  if (!snapshot.goalStatus.essentialCovered || !snapshot.goalStatus.importantCovered) {
    steps.push("Prioritizza prima obiettivi essenziali e importanti, poi quelli flessibili.");
  }

  return {
    snapshot,
    decision,
    safeDailySpend: snapshot.safeDailySpend,
    daysRemainingInCycle: snapshot.daysRemainingInCycle,
    steps,
    nextCheckpoint: forecast.nextCheckpoint
      ? {
          date: forecast.nextCheckpoint.date,
          label: forecast.nextCheckpoint.label,
          amount: forecast.nextCheckpoint.amount
        }
      : null
  };
}

export const copilotTools: CopilotToolbox = {
  getFinancialSnapshot,
  simulatePurchase,
  analyzeBudgets,
  analyzeGoals,
  forecastCycleEnd,
  generateSurvivalPlan
};
