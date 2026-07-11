import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { RiskAssessment } from "../types";
export declare function assessRisk(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): RiskAssessment;
