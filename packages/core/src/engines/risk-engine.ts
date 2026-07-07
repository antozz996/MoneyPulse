import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { PurchaseDecision, RiskAssessment } from "../types";
import {
  assertSameCurrency,
  clampMoneyToZero,
  createMoney,
  isGreaterThanMoney,
  isZeroMoney,
  subtractMoney
} from "../domain/value-objects";
import { buildTimeline } from "./timeline-engine";

function classifyPurchaseDecision(
  currentAvailableToSpend: number,
  purchaseAmount: number,
  rawRemainingAmount: number
): PurchaseDecision {
  if (purchaseAmount === 0) {
    return "safe";
  }

  if (purchaseAmount > currentAvailableToSpend) {
    return "hold";
  }

  if (rawRemainingAmount === 0) {
    return "caution";
  }

  return "safe";
}

export function assessRisk(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): RiskAssessment {
  const timeline = buildTimeline(snapshot, purchase);
  const currentAvailableToSpend = timeline.availableToSpend;

  if (!purchase) {
    return {
      currentRiskLevel: isZeroMoney(currentAvailableToSpend) ? "hold" : "safe",
      projectedRiskLevel: isZeroMoney(currentAvailableToSpend) ? "hold" : "safe",
      canAfford: true,
      remainingHeadroom: currentAvailableToSpend,
      shortfall: createMoney(0, currentAvailableToSpend.currency)
    };
  }

  assertSameCurrency(currentAvailableToSpend, purchase.amount);

  const rawRemainingHeadroom = subtractMoney(currentAvailableToSpend, purchase.amount);
  const remainingHeadroom = clampMoneyToZero(rawRemainingHeadroom);
  const canAfford = !isGreaterThanMoney(purchase.amount, currentAvailableToSpend);
  const purchaseDecision = classifyPurchaseDecision(
    currentAvailableToSpend.amount,
    purchase.amount.amount,
    rawRemainingHeadroom.amount
  );

  return {
    currentRiskLevel: isZeroMoney(currentAvailableToSpend) ? "hold" : "safe",
    projectedRiskLevel: purchaseDecision,
    purchaseDecision,
    canAfford,
    remainingHeadroom,
    shortfall: canAfford
      ? createMoney(0, currentAvailableToSpend.currency)
      : createMoney(
          purchase.amount.amount - currentAvailableToSpend.amount,
          currentAvailableToSpend.currency
        )
  };
}
