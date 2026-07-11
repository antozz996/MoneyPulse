import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { TimelineResult } from "../types";
export declare function buildTimeline(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): TimelineResult;
