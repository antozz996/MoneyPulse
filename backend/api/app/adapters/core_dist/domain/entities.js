import { createCurrency, createModelVersion, createNonNegativeMoney } from "./value-objects.js";
export const DOCUMENTED_INPUTS = [
    "availableBalance",
    "expectedIncomeToday",
    "essentialObligations",
    "committedSpending",
    "safetyBuffer",
    "plannedGoalContribution"
];
function normalizeDescription(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function createNormalizedFinancialInputs(input, currency) {
    return {
        availableBalance: createNonNegativeMoney(input.availableBalance, currency),
        expectedIncomeToday: createNonNegativeMoney(input.expectedIncomeToday, currency),
        essentialObligations: createNonNegativeMoney(input.essentialObligations, currency),
        committedSpending: createNonNegativeMoney(input.committedSpending, currency),
        safetyBuffer: createNonNegativeMoney(input.safetyBuffer, currency),
        plannedGoalContribution: createNonNegativeMoney(input.plannedGoalContribution, currency)
    };
}
export function createFinancialSnapshot(input) {
    const currency = createCurrency(input.currency);
    const normalizedInputs = createNormalizedFinancialInputs(input, currency);
    return {
        ...normalizedInputs,
        modelVersion: createModelVersion(input.modelVersion)
    };
}
export function createPurchaseCandidate(input) {
    const currency = createCurrency(input.currency);
    return {
        amount: createNonNegativeMoney(input.amount, currency),
        description: normalizeDescription(input.description)
    };
}
export function getSnapshotCurrency(snapshot) {
    return snapshot.availableBalance.currency;
}
export function getNormalizedFinancialInputs(snapshot) {
    return {
        availableBalance: snapshot.availableBalance,
        expectedIncomeToday: snapshot.expectedIncomeToday,
        essentialObligations: snapshot.essentialObligations,
        committedSpending: snapshot.committedSpending,
        safetyBuffer: snapshot.safetyBuffer,
        plannedGoalContribution: snapshot.plannedGoalContribution
    };
}
