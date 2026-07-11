import { assessGoalImpact } from "./goal-impact-engine.js";
import { recommend } from "./recommendation-engine.js";
import { assessRisk } from "./risk-engine.js";
import { buildTimeline } from "./timeline-engine.js";
function formatMoneyLabel(amount, currency) {
    return `${currency} ${amount.toFixed(2)}`;
}
export function explain(snapshot, purchase) {
    const timeline = buildTimeline(snapshot, purchase);
    const risk = assessRisk(snapshot, purchase);
    const goalImpact = assessGoalImpact(snapshot, purchase);
    const recommendation = recommend(snapshot, purchase);
    const drivers = [
        `Starting balance is ${formatMoneyLabel(snapshot.availableBalance.amount, snapshot.availableBalance.currency)}.`,
        `Expected income adds ${formatMoneyLabel(snapshot.expectedIncomeToday.amount, snapshot.expectedIncomeToday.currency)} before protections are applied.`,
        `Essentials, committed spending, the safety buffer, and planned goal contributions reduce discretionary headroom to ${formatMoneyLabel(timeline.availableToSpend.amount, timeline.availableToSpend.currency)}.`
    ];
    const timelineNarrative = timeline.checkpoints.map((checkpoint) => {
        const verb = checkpoint.direction === "inflow" ? "adds" : "removes";
        return `${checkpoint.label} ${verb} ${formatMoneyLabel(checkpoint.amount.amount, checkpoint.amount.currency)}, leaving ${formatMoneyLabel(checkpoint.balanceAfter.amount, checkpoint.balanceAfter.currency)}.`;
    });
    const summary = [
        recommendation.headline,
        recommendation.action,
        goalImpact.summary,
        purchase
            ? `Projected decision is ${risk.projectedRiskLevel} with ${formatMoneyLabel(risk.remainingHeadroom.amount, risk.remainingHeadroom.currency)} left after the scenario.`
            : `Today's deterministic baseline leaves ${formatMoneyLabel(timeline.availableToSpend.amount, timeline.availableToSpend.currency)} available to spend.`
    ];
    return {
        summary,
        drivers,
        timelineNarrative
    };
}
