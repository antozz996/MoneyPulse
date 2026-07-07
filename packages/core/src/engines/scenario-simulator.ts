import type { FinancialSnapshot, PurchaseCandidate } from "../domain/entities";
import type { ScenarioSimulation } from "../types";
import { assessConfidence } from "./confidence-engine";
import { explain } from "./explain-engine";
import { future } from "./future-engine";
import { assessGoalImpact } from "./goal-impact-engine";
import { recommend } from "./recommendation-engine";
import { assessRisk } from "./risk-engine";
import { buildTimeline } from "./timeline-engine";

export function simulateScenario(
  snapshot: FinancialSnapshot,
  purchase?: PurchaseCandidate
): ScenarioSimulation {
  return {
    timeline: buildTimeline(snapshot, purchase),
    risk: assessRisk(snapshot, purchase),
    goalImpact: assessGoalImpact(snapshot, purchase),
    confidence: assessConfidence(snapshot, purchase),
    recommendation: recommend(snapshot, purchase),
    explanation: explain(snapshot, purchase),
    future: future(snapshot, purchase)
  };
}
