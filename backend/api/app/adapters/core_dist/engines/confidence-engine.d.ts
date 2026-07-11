import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { ConfidenceAssessment, DecisionConfidence } from "../types";
export declare function assessConfidence(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): ConfidenceAssessment;
export declare function toLegacyConfidence(assessment: ConfidenceAssessment): DecisionConfidence;
