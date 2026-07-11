import { type Currency, type ModelVersion, type Money } from "./value-objects";
export declare const DOCUMENTED_INPUTS: readonly ["availableBalance", "expectedIncomeToday", "essentialObligations", "committedSpending", "safetyBuffer", "plannedGoalContribution"];
export type DocumentedInput = (typeof DOCUMENTED_INPUTS)[number];
export interface FinancialSnapshot {
    readonly availableBalance: Money;
    readonly expectedIncomeToday: Money;
    readonly essentialObligations: Money;
    readonly committedSpending: Money;
    readonly safetyBuffer: Money;
    readonly plannedGoalContribution: Money;
    readonly modelVersion: ModelVersion;
}
export interface FinancialSnapshotInput {
    readonly availableBalance: number;
    readonly expectedIncomeToday: number;
    readonly essentialObligations: number;
    readonly committedSpending: number;
    readonly safetyBuffer: number;
    readonly plannedGoalContribution: number;
    readonly currency: string;
    readonly modelVersion: string;
}
export interface PurchaseCandidate {
    readonly amount: Money;
    readonly description?: string;
}
export interface PurchaseCandidateInput {
    readonly amount: number;
    readonly currency: string;
    readonly description?: string;
}
export interface NormalizedFinancialInputs {
    readonly availableBalance: Money;
    readonly expectedIncomeToday: Money;
    readonly essentialObligations: Money;
    readonly committedSpending: Money;
    readonly safetyBuffer: Money;
    readonly plannedGoalContribution: Money;
}
export declare function createFinancialSnapshot(input: FinancialSnapshotInput): FinancialSnapshot;
export declare function createPurchaseCandidate(input: PurchaseCandidateInput): PurchaseCandidate;
export declare function getSnapshotCurrency(snapshot: FinancialSnapshot): Currency;
export declare function getNormalizedFinancialInputs(snapshot: FinancialSnapshot): NormalizedFinancialInputs;
