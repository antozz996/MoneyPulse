import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { FutureResult } from "../types";
export declare function future(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): FutureResult;
