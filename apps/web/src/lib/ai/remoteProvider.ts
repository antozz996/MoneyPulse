import { api } from "../api";
import { mockCopilotProvider } from "./mockProvider";
import type { CopilotProvider } from "./types";

export const remoteCopilotProvider: CopilotProvider = {
  id: "remote",
  async generateCopilotReply(input) {
    try {
      const response = await api.chatCopilot({
        message: input.message,
        locale: input.locale,
        history: input.history
      });

      return {
        provider: response.provider,
        modelVersion: response.model_version,
        fallbackUsed: response.fallback_used,
        model: response.model ?? undefined,
        intent: response.intent,
        answer: response.answer,
        classification: {
          intent: response.classification.intent,
          confidence: response.classification.confidence,
          entities: {
            amount: response.classification.entities.amount ?? undefined,
            currency: response.classification.entities.currency ?? undefined
          }
        },
        context: {
          locale: response.context.locale,
          currency: response.context.currency,
          riskProfile: response.context.risk_profile,
          snapshotSummary: {
            cycleStart: response.context.snapshot_summary.cycle_start,
            cycleEnd: response.context.snapshot_summary.cycle_end,
            realAvailabilityNow: response.context.snapshot_summary.real_availability_now,
            projectedAvailability: response.context.snapshot_summary.projected_availability,
            safeDailySpend: response.context.snapshot_summary.safe_daily_spend,
            decisionLevel: response.context.snapshot_summary.decision_level
          },
          budgetSummary: {
            overall: response.context.budget_summary.overall,
            overLimitCategories: response.context.budget_summary.over_limit_categories,
            nearLimitCategories: response.context.budget_summary.near_limit_categories
          },
          goalSummary: {
            essentialCovered: response.context.goal_summary.essential_covered,
            importantCovered: response.context.goal_summary.important_covered,
            flexibleDeferred: response.context.goal_summary.flexible_deferred,
            remainingThisCycle: response.context.goal_summary.remaining_this_cycle
          },
          recentDecisionSummary: response.context.recent_decision_summary
            ? {
                level: response.context.recent_decision_summary.level,
                status: response.context.recent_decision_summary.status,
                purchaseAmount: response.context.recent_decision_summary.purchase_amount,
                remainingAfterPurchase:
                  response.context.recent_decision_summary.remaining_after_purchase
              }
            : undefined
        }
      };
    } catch {
      return mockCopilotProvider.generateCopilotReply(input);
    }
  }
};
