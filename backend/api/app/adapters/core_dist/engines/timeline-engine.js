import { subtractMoney } from "../domain/value-objects.js";
import { addMoney, assertSameCurrency, clampMoneyToZero } from "../domain/value-objects.js";
const TIMELINE_LABELS = {
    expectedIncomeToday: "Expected income today",
    essentialObligations: "Essential obligations",
    committedSpending: "Committed spending",
    safetyBuffer: "Safety buffer",
    plannedGoalContribution: "Planned goal contribution",
    purchase: "Hypothetical purchase"
};
export function buildTimeline(snapshot, purchase) {
    const checkpoints = [];
    const afterIncome = addMoney(snapshot.availableBalance, snapshot.expectedIncomeToday);
    checkpoints.push({
        key: "expectedIncomeToday",
        phase: "baseline",
        direction: "inflow",
        label: TIMELINE_LABELS.expectedIncomeToday,
        amount: snapshot.expectedIncomeToday,
        balanceAfter: afterIncome
    });
    const afterEssentials = subtractMoney(afterIncome, snapshot.essentialObligations);
    checkpoints.push({
        key: "essentialObligations",
        phase: "baseline",
        direction: "outflow",
        label: TIMELINE_LABELS.essentialObligations,
        amount: snapshot.essentialObligations,
        balanceAfter: afterEssentials
    });
    const afterCommitted = subtractMoney(afterEssentials, snapshot.committedSpending);
    checkpoints.push({
        key: "committedSpending",
        phase: "baseline",
        direction: "outflow",
        label: TIMELINE_LABELS.committedSpending,
        amount: snapshot.committedSpending,
        balanceAfter: afterCommitted
    });
    const afterBuffer = subtractMoney(afterCommitted, snapshot.safetyBuffer);
    checkpoints.push({
        key: "safetyBuffer",
        phase: "baseline",
        direction: "outflow",
        label: TIMELINE_LABELS.safetyBuffer,
        amount: snapshot.safetyBuffer,
        balanceAfter: afterBuffer
    });
    const rawAvailableToSpend = subtractMoney(afterBuffer, snapshot.plannedGoalContribution);
    checkpoints.push({
        key: "plannedGoalContribution",
        phase: "baseline",
        direction: "outflow",
        label: TIMELINE_LABELS.plannedGoalContribution,
        amount: snapshot.plannedGoalContribution,
        balanceAfter: rawAvailableToSpend
    });
    const availableToSpend = clampMoneyToZero(rawAvailableToSpend);
    if (purchase) {
        assertSameCurrency(availableToSpend, purchase.amount);
        checkpoints.push({
            key: "purchase",
            phase: "purchase",
            direction: "outflow",
            label: TIMELINE_LABELS.purchase,
            amount: purchase.amount,
            balanceAfter: subtractMoney(availableToSpend, purchase.amount)
        });
    }
    return {
        openingBalance: snapshot.availableBalance,
        checkpoints,
        rawAvailableToSpend,
        availableToSpend,
        modelVersion: snapshot.modelVersion
    };
}
