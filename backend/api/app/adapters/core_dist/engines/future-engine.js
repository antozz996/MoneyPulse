import { createMoney, negateMoney, subtractMoney } from "../domain/value-objects.js";
import { assessRisk } from "./risk-engine.js";
import { buildTimeline } from "./timeline-engine.js";
export function future(snapshot, purchase) {
    const timeline = buildTimeline(snapshot, purchase);
    if (!purchase) {
        return {
            currentAvailableToSpend: timeline.availableToSpend,
            projectedAvailableToSpend: timeline.availableToSpend,
            delta: createMoney(0, timeline.availableToSpend.currency),
            modelVersion: snapshot.modelVersion,
            explanations: [
                "Future view reflects the current deterministic baseline with no hypothetical purchase.",
                `Projected available to spend remains ${timeline.availableToSpend.currency} ${timeline.availableToSpend.amount.toFixed(2)}.`
            ],
            scenarioLabel: "baseline",
            endingBalance: timeline.availableToSpend
        };
    }
    const risk = assessRisk(snapshot, purchase);
    return {
        currentAvailableToSpend: timeline.availableToSpend,
        projectedAvailableToSpend: risk.remainingHeadroom,
        delta: negateMoney(purchase.amount),
        purchaseDecision: risk.purchaseDecision,
        modelVersion: snapshot.modelVersion,
        explanations: [
            "Future view reflects the deterministic impact of a single hypothetical purchase.",
            `Projected available to spend changes by ${purchase.amount.currency} ${negateMoney(purchase.amount).amount.toFixed(2)}.`
        ],
        scenarioLabel: "purchase",
        endingBalance: subtractMoney(timeline.availableToSpend, purchase.amount)
    };
}
