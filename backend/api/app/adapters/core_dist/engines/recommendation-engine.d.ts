import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { RecommendationResult } from "../types";
export declare function recommend(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): RecommendationResult;
