import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { GoalImpactResult } from "../types";
export declare function assessGoalImpact(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): GoalImpactResult;
