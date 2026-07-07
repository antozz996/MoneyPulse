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

export type TimelineCheckpointKey = DocumentedInput | "purchase";

export type TimelineCheckpointPhase = "baseline" | "purchase";

export type TimelineCheckpointDirection = "inflow" | "outflow";

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

export interface TimelineCheckpoint {
  readonly key: TimelineCheckpointKey;
  readonly phase: TimelineCheckpointPhase;
  readonly direction: TimelineCheckpointDirection;
  readonly label: string;
  readonly amount: Money;
  readonly balanceAfter: Money;
}

export interface TimelineResult {
  readonly openingBalance: Money;
  readonly checkpoints: readonly TimelineCheckpoint[];
  readonly rawAvailableToSpend: Money;
  readonly availableToSpend: Money;
  readonly modelVersion: ModelVersion;
}

export interface RiskAssessment {
  readonly currentRiskLevel: RiskLevel;
  readonly projectedRiskLevel: RiskLevel;
  readonly purchaseDecision?: PurchaseDecision;
  readonly canAfford: boolean;
  readonly remainingHeadroom: Money;
  readonly shortfall: Money;
}

export interface GoalImpactResult {
  readonly protectedGoalContribution: Money;
  readonly currentHeadroomAfterGoals: Money;
  readonly remainingHeadroomAfterScenario: Money;
  readonly goalsProtected: boolean;
  readonly summary: string;
}

export interface DecisionConfidence {
  readonly mode: "deterministic";
  readonly inputCompleteness: "complete";
  readonly usesDocumentedInputsOnly: true;
  readonly purchaseContext: "not-provided" | "matched-currency";
  readonly supportedInputs: readonly DocumentedInput[];
  readonly modelVersion: ModelVersion;
}

export interface ConfidenceAssessment extends DecisionConfidence {
  readonly scenarioMode: "baseline-only" | "baseline-plus-purchase";
  readonly timelineCoverage: "documented-flow";
}

export interface RecommendationResult {
  readonly kind: "daily-safe-to-spend" | "purchase-check";
  readonly headline: string;
  readonly action: string;
  readonly riskLevel: RiskLevel;
  readonly primaryAmount: Money;
  readonly reasons: readonly string[];
}

export interface ExplanationResult {
  readonly summary: readonly string[];
  readonly drivers: readonly string[];
  readonly timelineNarrative: readonly string[];
}

export interface FutureResult extends ForecastResult {
  readonly scenarioLabel: "baseline" | "purchase";
  readonly endingBalance: Money;
}

export interface ScenarioSimulation {
  readonly timeline: TimelineResult;
  readonly risk: RiskAssessment;
  readonly goalImpact: GoalImpactResult;
  readonly confidence: ConfidenceAssessment;
  readonly recommendation: RecommendationResult;
  readonly explanation: ExplanationResult;
  readonly future: FutureResult;
}

export interface DecisionEngine {
  readonly calculateAvailableToSpend: (
    snapshot: FinancialSnapshot
  ) => AvailableToSpendResult;
  readonly buildTimeline: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => TimelineResult;
  readonly simulateScenario: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => ScenarioSimulation;
  readonly assessRisk: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => RiskAssessment;
  readonly assessGoalImpact: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => GoalImpactResult;
  readonly assessConfidence: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => ConfidenceAssessment;
  readonly recommend: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => RecommendationResult;
  readonly explain: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => ExplanationResult;
  readonly future: (
    snapshot: FinancialSnapshot,
    purchase?: PurchaseCandidate
  ) => FutureResult;
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
