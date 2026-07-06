import type {
  DocumentedInput,
  FinancialSnapshot,
  FinancialSnapshotInput,
  NormalizedFinancialInputs,
  PurchaseCandidate,
  PurchaseCandidateInput
} from "./domain/entities";
import type { Currency, ModelVersion, Money } from "./domain/value-objects";

export type RiskLevel = "safe" | "caution" | "hold";

export type PurchaseDecision = RiskLevel;

export interface DailyDecisionInput extends FinancialSnapshotInput {}

export interface DailyDecisionOutput {
  readonly safeToSpendToday: number;
  readonly riskLevel: RiskLevel;
  readonly explanations: readonly string[];
  readonly currency: string;
  readonly modelVersion: string;
}

export interface AvailableToSpendResult {
  readonly amount: Money;
  readonly rawAmount: Money;
  readonly modelVersion: ModelVersion;
  readonly normalizedInputs: NormalizedFinancialInputs;
  readonly documentedInputs: readonly DocumentedInput[];
  readonly explanations: readonly string[];
}

export interface PurchaseEvaluation {
  readonly currentAvailableToSpend: Money;
  readonly purchaseAmount: Money;
  readonly availableToSpendAfterPurchase: Money;
  readonly rawAvailableToSpendAfterPurchase: Money;
  readonly delta: Money;
  readonly canAfford: boolean;
  readonly decision: PurchaseDecision;
  readonly modelVersion: ModelVersion;
  readonly explanations: readonly string[];
}

export interface ForecastResult {
  readonly currentAvailableToSpend: Money;
  readonly projectedAvailableToSpend: Money;
  readonly delta: Money;
  readonly purchaseDecision?: PurchaseDecision;
  readonly modelVersion: ModelVersion;
  readonly explanations: readonly string[];
}

export interface DecisionConfidence {
  readonly mode: "deterministic";
  readonly inputCompleteness: "complete";
  readonly usesDocumentedInputsOnly: true;
  readonly purchaseContext: "not-provided" | "matched-currency";
  readonly supportedInputs: readonly DocumentedInput[];
  readonly modelVersion: ModelVersion;
}

export interface DecisionEngine {
  readonly calculateAvailableToSpend: (
    snapshot: FinancialSnapshot
  ) => AvailableToSpendResult;
  readonly evaluatePurchase: (
    snapshot: FinancialSnapshot,
    purchase: PurchaseCandidate
  ) => PurchaseEvaluation;
  readonly forecast: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => ForecastResult;
  readonly confidence: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => DecisionConfidence;
}

export type {
  Currency,
  FinancialSnapshot,
  FinancialSnapshotInput,
  ModelVersion,
  Money,
  NormalizedFinancialInputs,
  PurchaseCandidate,
  PurchaseCandidateInput
};
