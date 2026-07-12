import {
  assessRisk,
  type AffordabilityInput,
  buildFinancialSnapshot,
  buildForecast,
  createEngineDecision,
  explainAffordability,
  explainSnapshot,
  simulatePurchase as simulateEnginePurchase,
  sumMoney
} from "../engine";
import type {
  AffordabilityToolResult,
  BudgetAnalysisResult,
  CopilotEngineInput,
  CopilotToolbox,
  ForecastCheckResult,
  GoalAnalysisResult,
  MissingDataWarning,
  SnapshotToolResult,
  SurvivalPlanResult
} from "./types";

function collectMissingDataWarnings(input: CopilotEngineInput): MissingDataWarning[] {
  const warnings: MissingDataWarning[] = [];

  if (input.profile.salaryDay === null) {
    warnings.push({
      code: "missing_salary_day",
      message: "Salary day is missing, so the cycle falls back to a calendar month."
    });
  }

  if (input.profile.protectedBalance.amount <= 0) {
    warnings.push({
      code: "missing_protected_balance",
      message: "Protected balance is not configured yet."
    });
  }

  if (input.goals.filter((goal) => goal.active !== false).length === 0) {
    warnings.push({
      code: "no_goals_configured",
      message: "No goals are configured yet."
    });
  }

  if (input.budgets.length === 0) {
    warnings.push({
      code: "no_budgets_configured",
      message: "No category budgets are configured yet."
    });
  }

  if (input.transactions.length === 0 && input.recurringItems.length === 0) {
    warnings.push({
      code: "no_transaction_history",
      message: "There is no transaction history yet."
    });
  }

  return warnings;
}

function categoriesToReduceFromInput(input: CopilotEngineInput, warningCategories: string[]): string[] {
  if (warningCategories.length > 0) {
    return Array.from(new Set(warningCategories));
  }

  const discretionaryCategories = new Set(
    input.transactions
      .filter((transaction) => transaction.type === "DISCRETIONARY_EXPENSE" && transaction.category)
      .map((transaction) => transaction.category as string)
  );

  return Array.from(discretionaryCategories).slice(0, 3);
}

function buildAlternativeSuggestion(level: "GREEN" | "YELLOW" | "RED" | "BLACK"): string | undefined {
  if (level === "RED") {
    return "Delay the purchase or shrink one discretionary category before trying again.";
  }

  if (level === "BLACK") {
    return "Do not proceed. Restore protected balance first or split the purchase into a later cycle.";
  }

  return undefined;
}

export function getFinancialSnapshot(input: CopilotEngineInput): SnapshotToolResult {
  const snapshot = buildFinancialSnapshot(input);
  const risk = assessRisk(snapshot, input.profile);
  const decision = createEngineDecision(risk);
  const missingDataWarnings = collectMissingDataWarnings(input);

  return {
    snapshot,
    risk,
    decision,
    summary: explainSnapshot(snapshot),
    grounding: {
      keyNumbers: {
        realAvailabilityNow: snapshot.realAvailabilityNow,
        projectedAvailability: snapshot.projectedAvailability,
        safeDailySpend: snapshot.safeDailySpend,
        protectedBalance: snapshot.protectedBalance,
        fixedExpensesRemaining: snapshot.fixedExpensesRemaining,
        goalsRemaining: snapshot.goalsRemaining,
        daysRemainingInCycle: snapshot.daysRemainingInCycle
      },
      riskLevel: decision.level,
      reasons: decision.reasons,
      suggestedAction: decision.suggestedAction,
      missingDataWarnings
    }
  };
}

export function simulatePurchase(input: AffordabilityInput): AffordabilityToolResult {
  const affordability = simulateEnginePurchase(input);
  const futureCommitmentTotal = sumMoney(
    affordability.futureCommitments.map((commitment) => commitment.amount),
    affordability.purchaseAmount.currency
  );
  const suggestedAlternative = buildAlternativeSuggestion(affordability.decision.level);

  return {
    affordability,
    summary: explainAffordability(affordability),
    grounding: {
      keyNumbers: {
        availabilityBefore: affordability.snapshotBefore.realAvailabilityNow,
        availabilityAfter: affordability.snapshotAfter.realAvailabilityNow,
        safeDailySpendBefore: affordability.snapshotBefore.safeDailySpend,
        safeDailySpendAfter: affordability.snapshotAfter.safeDailySpend,
        currentCycleImpact: affordability.currentCycleImpact,
        futureCommitmentTotal,
        protectedBalance: affordability.snapshotAfter.protectedBalance,
        protectedBalanceBreached: affordability.riskAfter.protectedBalanceBreached
      },
      riskLevel: affordability.decision.level,
      reasons: affordability.decision.reasons,
      suggestedAction: affordability.decision.suggestedAction,
      missingDataWarnings: collectMissingDataWarnings(input),
      suggestedAlternative
    }
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
  const decision = createEngineDecision(assessRisk(snapshot, input.profile));
  const categoriesToReduce = categoriesToReduceFromInput(input, [
    ...overLimitCategories,
    ...nearLimitCategories
  ]);

  return {
    snapshot,
    overall: snapshot.budgetStatus.overall,
    nearLimitCategories,
    overLimitCategories,
    remainingByCategory: snapshot.budgetStatus.items.map((item) => ({
      category: item.category,
      remaining: item.remaining
    })),
    grounding: {
      keyNumbers: {
        realAvailabilityNow: snapshot.realAvailabilityNow,
        safeDailySpend: snapshot.safeDailySpend,
        budgetCount: snapshot.budgetStatus.items.length,
        nearLimitCount: snapshot.budgetStatus.nearLimitCount,
        overLimitCount: snapshot.budgetStatus.overLimitCount
      },
      riskLevel: decision.level,
      reasons: decision.reasons,
      suggestedAction:
        categoriesToReduce.length > 0
          ? `Reduce discretionary pressure first in: ${categoriesToReduce.join(", ")}.`
          : decision.suggestedAction,
      missingDataWarnings: collectMissingDataWarnings(input),
      categoriesToReduce
    }
  };
}

export function analyzeGoals(input: CopilotEngineInput): GoalAnalysisResult {
  const snapshot = buildFinancialSnapshot(input);
  const decision = createEngineDecision(assessRisk(snapshot, input.profile));
  const activeGoals = input.goals.filter((goal) => goal.active !== false);
  const goalsToProtect = activeGoals
    .filter((goal) => goal.priority === "ESSENTIAL" || goal.priority === "IMPORTANT")
    .map((goal) => goal.name);

  return {
    snapshot,
    goalStatus: snapshot.goalStatus,
    essentialCovered: snapshot.goalStatus.essentialCovered,
    importantCovered: snapshot.goalStatus.importantCovered,
    flexibleDeferred: snapshot.goalStatus.flexibleDeferred,
    grounding: {
      keyNumbers: {
        remainingThisCycle: snapshot.goalStatus.remainingThisCycle,
        essentialGoalCount: activeGoals.filter((goal) => goal.priority === "ESSENTIAL").length,
        importantGoalCount: activeGoals.filter((goal) => goal.priority === "IMPORTANT").length,
        flexibleGoalCount: activeGoals.filter((goal) => goal.priority === "FLEXIBLE").length
      },
      riskLevel: decision.level,
      reasons: decision.reasons,
      suggestedAction:
        goalsToProtect.length > 0
          ? `Protect these goals first this cycle: ${goalsToProtect.join(", ")}.`
          : decision.suggestedAction,
      missingDataWarnings: collectMissingDataWarnings(input),
      goalsToProtect
    }
  };
}

export function forecastCycleEnd(input: CopilotEngineInput): ForecastCheckResult {
  const forecast = buildForecast(input);
  const risk = assessRisk(forecast.snapshot, input.profile);
  const decision = createEngineDecision(risk);

  return {
    forecast,
    decision,
    grounding: {
      keyNumbers: {
        realAvailabilityNow: forecast.snapshot.realAvailabilityNow,
        projectedAvailability: forecast.snapshot.projectedAvailability,
        safeDailySpend: forecast.snapshot.safeDailySpend,
        fixedExpensesRemaining: forecast.snapshot.fixedExpensesRemaining,
        nextCheckpointDate: forecast.nextCheckpoint?.date ?? null
      },
      riskLevel: decision.level,
      reasons: decision.reasons,
      suggestedAction: decision.suggestedAction,
      missingDataWarnings: collectMissingDataWarnings(input)
    }
  };
}

export function generateSurvivalPlan(input: CopilotEngineInput): SurvivalPlanResult {
  const { decision, forecast, grounding } = forecastCycleEnd(input);
  const snapshot = forecast.snapshot;
  const budgetAnalysis = analyzeBudgets(input);
  const goalAnalysis = analyzeGoals(input);
  const categoriesToReduce = budgetAnalysis.grounding.categoriesToReduce;
  const fixedExpensesStillComing = forecast.checkpoints
    .filter(
      (checkpoint) =>
        checkpoint.type === "FIXED_EXPENSE" ||
        checkpoint.kind === "INSTALLMENT"
    )
    .slice(0, 5)
    .map((checkpoint) => ({
      label: checkpoint.label,
      date: checkpoint.date,
      amount: checkpoint.amount
    }));
  const goalsToProtect = goalAnalysis.grounding.goalsToProtect;
  const whatNotToTouch = [
    "Protected balance",
    ...(goalsToProtect.length > 0 ? goalsToProtect : [])
  ];
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

  if (categoriesToReduce.length > 0) {
    steps.push(`Riduci per primi questi extra: ${categoriesToReduce.join(", ")}.`);
  }

  return {
    snapshot,
    decision,
    safeDailySpend: snapshot.safeDailySpend,
    daysRemainingInCycle: snapshot.daysRemainingInCycle,
    steps,
    categoriesToReduce,
    fixedExpensesStillComing,
    goalsToProtect,
    whatNotToTouch,
    nextCheckpoint: forecast.nextCheckpoint
      ? {
          date: forecast.nextCheckpoint.date,
          label: forecast.nextCheckpoint.label,
          amount: forecast.nextCheckpoint.amount
        }
      : null,
    grounding: {
      keyNumbers: {
        realAvailabilityNow: snapshot.realAvailabilityNow,
        safeDailySpend: snapshot.safeDailySpend,
        fixedExpensesRemaining: snapshot.fixedExpensesRemaining,
        goalsRemaining: snapshot.goalsRemaining,
        nextCheckpointDate: forecast.nextCheckpoint?.date ?? null
      },
      riskLevel: grounding.riskLevel,
      reasons: grounding.reasons,
      suggestedAction: grounding.suggestedAction,
      missingDataWarnings: grounding.missingDataWarnings
    }
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
