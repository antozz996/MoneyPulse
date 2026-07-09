import { normalizeLanguage } from "../i18n";
import { analyzeBudgets, analyzeGoals, getFinancialSnapshot } from "./copilotTools";
import type { CopilotContext, CopilotContextInput } from "./types";

export function buildCopilotContext(input: CopilotContextInput): CopilotContext {
  const snapshotResult = getFinancialSnapshot(input);
  const budgetAnalysis = analyzeBudgets(input);
  const goalAnalysis = analyzeGoals(input);
  const language = normalizeLanguage(input.locale) ?? "en";

  return {
    locale: language,
    currency: input.currency,
    riskProfile: input.profile.riskProfile,
    snapshotSummary: {
      cycleStart: snapshotResult.snapshot.cycleStart,
      cycleEnd: snapshotResult.snapshot.cycleEnd,
      realAvailabilityNow: snapshotResult.snapshot.realAvailabilityNow,
      projectedAvailability: snapshotResult.snapshot.projectedAvailability,
      safeDailySpend: snapshotResult.snapshot.safeDailySpend,
      decisionLevel: snapshotResult.decision.level
    },
    budgetSummary: {
      overall: budgetAnalysis.overall,
      overLimitCategories: budgetAnalysis.overLimitCategories,
      nearLimitCategories: budgetAnalysis.nearLimitCategories
    },
    goalSummary: {
      essentialCovered: goalAnalysis.essentialCovered,
      importantCovered: goalAnalysis.importantCovered,
      flexibleDeferred: goalAnalysis.flexibleDeferred,
      remainingThisCycle: goalAnalysis.goalStatus.remainingThisCycle
    },
    recentDecisionSummary: input.recentDecision
      ? {
          level: input.recentDecision.decision.level,
          status: input.recentDecision.decision.status,
          purchaseAmount: input.recentDecision.purchaseAmount,
          remainingAfterPurchase:
            input.recentDecision.snapshotAfter.realAvailabilityNow
        }
      : undefined
  };
}
