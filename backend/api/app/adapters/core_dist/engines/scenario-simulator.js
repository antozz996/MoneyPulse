import { assessConfidence } from "./confidence-engine.js";
import { explain } from "./explain-engine.js";
import { future } from "./future-engine.js";
import { assessGoalImpact } from "./goal-impact-engine.js";
import { recommend } from "./recommendation-engine.js";
import { assessRisk } from "./risk-engine.js";
import { buildTimeline } from "./timeline-engine.js";
export function simulateScenario(snapshot, purchase) {
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
