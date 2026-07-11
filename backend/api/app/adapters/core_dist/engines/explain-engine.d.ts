import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { ExplanationResult } from "../types";
export declare function explain(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): ExplanationResult;
