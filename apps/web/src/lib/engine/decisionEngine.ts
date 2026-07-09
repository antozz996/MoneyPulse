import type { EngineDecision, RiskAssessment } from "./types";

export function createEngineDecision(risk: RiskAssessment): EngineDecision {
  switch (risk.level) {
    case "GREEN":
      return {
        level: "GREEN",
        status: "ALLOW",
        label: "On track",
        reasons: risk.reasons,
        suggestedAction: "Proceed and keep tracking the cycle as planned.",
        confidence: risk.confidence
      };
    case "YELLOW":
      return {
        level: "YELLOW",
        status: "ALLOW_WITH_CAUTION",
        label: "Margin reduced",
        reasons: risk.reasons,
        suggestedAction: "Proceed only if the spend still matters before the next cycle reset.",
        confidence: risk.confidence
      };
    case "RED":
      return {
        level: "RED",
        status: "NOT_RECOMMENDED",
        label: "Too much pressure",
        reasons: risk.reasons,
        suggestedAction: "Delay the spend or rebalance commitments before continuing.",
        confidence: risk.confidence
      };
    case "BLACK":
      return {
        level: "BLACK",
        status: "BLOCKED",
        label: "Protected balance breached",
        reasons: risk.reasons,
        suggestedAction: "Do not proceed. Restore protected balance first.",
        confidence: risk.confidence
      };
  }
}
