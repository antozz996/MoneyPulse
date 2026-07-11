import { clampMoneyToZero, subtractMoney } from "../domain/value-objects.js";
import { buildTimeline } from "./timeline-engine.js";
function createGoalImpactSummary(snapshot, goalsProtected, purchase) {
    const amount = `${snapshot.plannedGoalContribution.currency} ${snapshot.plannedGoalContribution.amount.toFixed(2)}`;
    if (snapshot.plannedGoalContribution.amount === 0) {
        return purchase
            ? "No additional goal contribution is protected in this scenario."
            : "No additional goal contribution is protected in today's baseline.";
    }
    if (!purchase) {
        return `Today's baseline already protects ${amount} for goals before discretionary spending.`;
    }
    return goalsProtected
        ? `This scenario stays within the headroom left after protecting ${amount} for goals.`
        : `This scenario exceeds the headroom left after protecting ${amount} for goals.`;
}
export function assessGoalImpact(snapshot, purchase) {
    const timeline = buildTimeline(snapshot, purchase);
    const currentHeadroomAfterGoals = timeline.availableToSpend;
    if (!purchase) {
        return {
            protectedGoalContribution: snapshot.plannedGoalContribution,
            currentHeadroomAfterGoals,
            remainingHeadroomAfterScenario: currentHeadroomAfterGoals,
            goalsProtected: true,
            summary: createGoalImpactSummary(snapshot, true)
        };
    }
    const remainingHeadroomAfterScenario = clampMoneyToZero(subtractMoney(currentHeadroomAfterGoals, purchase.amount));
    const goalsProtected = purchase.amount.amount <= currentHeadroomAfterGoals.amount;
    return {
        protectedGoalContribution: snapshot.plannedGoalContribution,
        currentHeadroomAfterGoals,
        remainingHeadroomAfterScenario,
        goalsProtected,
        summary: createGoalImpactSummary(snapshot, goalsProtected, purchase)
    };
}
