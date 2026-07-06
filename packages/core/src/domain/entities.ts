import {
  type Currency,
  type ModelVersion,
  type Money,
  createCurrency,
  createModelVersion,
  createNonNegativeMoney
} from "./value-objects";

export const DOCUMENTED_INPUTS = [
  "availableBalance",
  "expectedIncomeToday",
  "essentialObligations",
  "committedSpending",
  "safetyBuffer",
  "plannedGoalContribution"
] as const;

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

function normalizeDescription(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createNormalizedFinancialInputs(
  input: FinancialSnapshotInput,
  currency: Currency
): NormalizedFinancialInputs {
  return {
    availableBalance: createNonNegativeMoney(input.availableBalance, currency),
    expectedIncomeToday: createNonNegativeMoney(input.expectedIncomeToday, currency),
    essentialObligations: createNonNegativeMoney(input.essentialObligations, currency),
    committedSpending: createNonNegativeMoney(input.committedSpending, currency),
    safetyBuffer: createNonNegativeMoney(input.safetyBuffer, currency),
    plannedGoalContribution: createNonNegativeMoney(
      input.plannedGoalContribution,
      currency
    )
  };
}

export function createFinancialSnapshot(
  input: FinancialSnapshotInput
): FinancialSnapshot {
  const currency = createCurrency(input.currency);
  const normalizedInputs = createNormalizedFinancialInputs(input, currency);

  return {
    ...normalizedInputs,
    modelVersion: createModelVersion(input.modelVersion)
  };
}

export function createPurchaseCandidate(
  input: PurchaseCandidateInput
): PurchaseCandidate {
  const currency = createCurrency(input.currency);

  return {
    amount: createNonNegativeMoney(input.amount, currency),
    description: normalizeDescription(input.description)
  };
}

export function getSnapshotCurrency(snapshot: FinancialSnapshot): Currency {
  return snapshot.availableBalance.currency;
}

export function getNormalizedFinancialInputs(
  snapshot: FinancialSnapshot
): NormalizedFinancialInputs {
  return {
    availableBalance: snapshot.availableBalance,
    expectedIncomeToday: snapshot.expectedIncomeToday,
    essentialObligations: snapshot.essentialObligations,
    committedSpending: snapshot.committedSpending,
    safetyBuffer: snapshot.safetyBuffer,
    plannedGoalContribution: snapshot.plannedGoalContribution
  };
}

