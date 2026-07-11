import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { ScenarioSimulation } from "../types";
export declare function simulateScenario(snapshot: FinancialSnapshot, purchase?: PurchaseCandidate): ScenarioSimulation;
