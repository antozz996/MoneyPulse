import { DOCUMENTED_INPUTS } from "../domain/entities";
import { assertSameCurrency } from "../domain/value-objects";
import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { ConfidenceAssessment, DecisionConfidence } from "../types";

export function assessConfidence(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): ConfidenceAssessment {
  if (purchase) {
    assertSameCurrency(snapshot.availableBalance, purchase.amount);
  }

  return {
    mode: "deterministic",
    inputCompleteness: "complete",
    usesDocumentedInputsOnly: true,
    purchaseContext: purchase ? "matched-currency" : "not-provided",
    supportedInputs: DOCUMENTED_INPUTS,
    modelVersion: snapshot.modelVersion,
    scenarioMode: purchase ? "baseline-plus-purchase" : "baseline-only",
    timelineCoverage: "documented-flow"
  };
}

export function toLegacyConfidence(
  assessment: ConfidenceAssessment
): DecisionConfidence {
  return {
    mode: assessment.mode,
    inputCompleteness: assessment.inputCompleteness,
    usesDocumentedInputsOnly: assessment.usesDocumentedInputsOnly,
    purchaseContext: assessment.purchaseContext,
    supportedInputs: assessment.supportedInputs,
    modelVersion: assessment.modelVersion
  };
}
