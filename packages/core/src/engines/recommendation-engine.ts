import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { RecommendationResult } from "../types";
import { buildTimeline } from "./timeline-engine";
import { assessGoalImpact } from "./goal-impact-engine";
import { assessRisk } from "./risk-engine";

function formatMoneyLabel(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function getPurchaseLabel(purchase: PurchaseCandidate): string {
  return purchase.description ? `"${purchase.description}"` : "This purchase";
}

export function recommend(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): RecommendationResult {
  const timeline = buildTimeline(snapshot, purchase);
  const risk = assessRisk(snapshot, purchase);
  const goalImpact = assessGoalImpact(snapshot, purchase);

  if (!purchase) {
    if (risk.projectedRiskLevel === "hold") {
      return {
        kind: "daily-safe-to-spend",
        headline: "Hold discretionary spending today.",
        action: "Wait for more documented headroom before adding new discretionary spending.",
        riskLevel: risk.projectedRiskLevel,
        primaryAmount: timeline.availableToSpend,
        reasons: [
          `Current safe-to-spend headroom is ${formatMoneyLabel(
            timeline.availableToSpend.amount,
            timeline.availableToSpend.currency
          )}.`,
          "Documented obligations and protections already absorb today's discretionary room.",
          goalImpact.summary
        ]
      };
    }

    return {
      kind: "daily-safe-to-spend",
      headline: `You can safely spend up to ${formatMoneyLabel(
        timeline.availableToSpend.amount,
        timeline.availableToSpend.currency
      )} today.`,
      action: "Stay within today's protected headroom to preserve the documented buffer and goals.",
      riskLevel: risk.projectedRiskLevel,
      primaryAmount: timeline.availableToSpend,
      reasons: [
        `The deterministic baseline leaves ${formatMoneyLabel(
          timeline.availableToSpend.amount,
          timeline.availableToSpend.currency
        )} for discretionary spending today.`,
        "The figure already accounts for essentials, committed spending, the safety buffer, and planned goal contributions.",
        goalImpact.summary
      ]
    };
  }

  const purchaseLabel = getPurchaseLabel(purchase);

  if (risk.projectedRiskLevel === "safe") {
    return {
      kind: "purchase-check",
      headline: `${purchaseLabel} fits today's protected headroom.`,
      action: "You can proceed and still stay within the documented spending envelope.",
      riskLevel: risk.projectedRiskLevel,
      primaryAmount: risk.remainingHeadroom,
      reasons: [
        `Remaining headroom after the scenario is ${formatMoneyLabel(
          risk.remainingHeadroom.amount,
          risk.remainingHeadroom.currency
        )}.`,
        goalImpact.summary,
        "The scenario does not consume more than today's available discretionary amount."
      ]
    };
  }

  if (risk.projectedRiskLevel === "caution") {
    return {
      kind: "purchase-check",
      headline: `${purchaseLabel} uses the last of today's protected headroom.`,
      action: "Proceed only if spending all remaining discretionary room still feels acceptable.",
      riskLevel: risk.projectedRiskLevel,
      primaryAmount: risk.remainingHeadroom,
      reasons: [
        `Remaining headroom after the scenario falls to ${formatMoneyLabel(
          risk.remainingHeadroom.amount,
          risk.remainingHeadroom.currency
        )}.`,
        goalImpact.summary,
        "The purchase is still affordable, but it leaves no discretionary room afterward."
      ]
    };
  }

  return {
    kind: "purchase-check",
    headline: `${purchaseLabel} exceeds today's protected headroom.`,
    action: "Hold this purchase or reduce it until the scenario fits the documented spending envelope.",
    riskLevel: risk.projectedRiskLevel,
    primaryAmount: risk.shortfall,
    reasons: [
      `The scenario overshoots current discretionary headroom by ${formatMoneyLabel(
        risk.shortfall.amount,
        risk.shortfall.currency
      )}.`,
      goalImpact.summary,
      "Buying now would push spending beyond today's documented safe-to-spend amount."
    ]
  };
}
