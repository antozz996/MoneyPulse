import { DOCUMENTED_INPUTS } from "../domain/entities.js";
import { assertSameCurrency } from "../domain/value-objects.js";
export function assessConfidence(snapshot, purchase) {
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
export function toLegacyConfidence(assessment) {
    return {
        mode: assessment.mode,
        inputCompleteness: assessment.inputCompleteness,
        usesDocumentedInputsOnly: assessment.usesDocumentedInputsOnly,
        purchaseContext: assessment.purchaseContext,
        supportedInputs: assessment.supportedInputs,
        modelVersion: assessment.modelVersion
    };
}
