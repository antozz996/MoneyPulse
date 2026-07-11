import { DOCUMENTED_INPUTS, createFinancialSnapshot, getNormalizedFinancialInputs } from "./domain/entities.js";
import { clampMoneyToZero, isZeroMoney, negateMoney, subtractMoney } from "./domain/value-objects.js";
import { assessConfidence, toLegacyConfidence } from "./engines/confidence-engine.js";
import { explain } from "./engines/explain-engine.js";
import { future } from "./engines/future-engine.js";
import { assessGoalImpact } from "./engines/goal-impact-engine.js";
import { recommend } from "./engines/recommendation-engine.js";
import { assessRisk } from "./engines/risk-engine.js";
import { simulateScenario } from "./engines/scenario-simulator.js";
import { buildTimeline } from "./engines/timeline-engine.js";
function createLegacyDailyExplainabilityLines(snapshot) {
    return [
        `Started from ${snapshot.availableBalance.currency} ${snapshot.availableBalance.amount.toFixed(2)} available today.`,
        `Added ${snapshot.expectedIncomeToday.currency} ${snapshot.expectedIncomeToday.amount.toFixed(2)} of expected income today.`,
        `Reserved ${snapshot.essentialObligations.currency} ${snapshot.essentialObligations.amount.toFixed(2)} for essentials and ${snapshot.safetyBuffer.currency} ${snapshot.safetyBuffer.amount.toFixed(2)} as a safety buffer.`,
        `Protected ${snapshot.plannedGoalContribution.currency} ${snapshot.plannedGoalContribution.amount.toFixed(2)} for goals and ${snapshot.committedSpending.currency} ${snapshot.committedSpending.amount.toFixed(2)} already committed to discretionary spending.`
    ];
}
export function calculateAvailableToSpend(snapshot) {
    const timeline = buildTimeline(snapshot);
    return {
        amount: timeline.availableToSpend,
        rawAmount: timeline.rawAvailableToSpend,
        modelVersion: snapshot.modelVersion,
        normalizedInputs: getNormalizedFinancialInputs(snapshot),
        documentedInputs: DOCUMENTED_INPUTS,
        explanations: createLegacyDailyExplainabilityLines(snapshot)
    };
}
export function evaluatePurchase(snapshot, purchase) {
    const current = calculateAvailableToSpend(snapshot);
    const risk = assessRisk(snapshot, purchase);
    const rawAvailableToSpendAfterPurchase = subtractMoney(current.amount, purchase.amount);
    const availableToSpendAfterPurchase = clampMoneyToZero(rawAvailableToSpendAfterPurchase);
    return {
        currentAvailableToSpend: current.amount,
        purchaseAmount: purchase.amount,
        availableToSpendAfterPurchase,
        rawAvailableToSpendAfterPurchase,
        delta: negateMoney(purchase.amount),
        canAfford: risk.canAfford,
        decision: risk.purchaseDecision ?? "safe",
        modelVersion: snapshot.modelVersion,
        explanations: [
            `Current available to spend is ${current.amount.currency} ${current.amount.amount.toFixed(2)}.`,
            `Evaluated a purchase of ${purchase.amount.currency} ${purchase.amount.amount.toFixed(2)}.`,
            `Projected remaining discretionary headroom is ${availableToSpendAfterPurchase.currency} ${availableToSpendAfterPurchase.amount.toFixed(2)}.`
        ]
    };
}
export function forecast(snapshot, purchase) {
    const projected = future(snapshot, purchase);
    return {
        currentAvailableToSpend: projected.currentAvailableToSpend,
        projectedAvailableToSpend: projected.projectedAvailableToSpend,
        delta: projected.delta,
        purchaseDecision: projected.purchaseDecision,
        modelVersion: projected.modelVersion,
        explanations: projected.explanations
    };
}
export function confidence(snapshot, purchase) {
    return toLegacyConfidence(assessConfidence(snapshot, purchase));
}
export function createDecisionEngine() {
    return {
        calculateAvailableToSpend,
        buildTimeline,
        simulateScenario,
        assessRisk,
        assessGoalImpact,
        assessConfidence,
        recommend,
        explain,
        future,
        evaluatePurchase,
        forecast,
        confidence
    };
}
export function calculateDailySafeToSpend(input) {
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
export { assessConfidence, assessGoalImpact, assessRisk, buildTimeline, explain, future, recommend, simulateScenario };
