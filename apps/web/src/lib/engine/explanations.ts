import type { AffordabilityResult, EngineDecision, FinancialSnapshot } from "./types";

export function explainDecision(decision: EngineDecision): string {
  switch (decision.level) {
    case "GREEN":
      return "Puoi farlo. Non tocchi il saldo protetto e resti dentro i tuoi margini.";
    case "YELLOW":
      return "Puoi farlo, ma ti lascia meno margine fino al prossimo stipendio.";
    case "RED":
      return "Non è consigliato. La spesa compromette la disponibilità reale del ciclo.";
    case "BLACK":
      return "No. Questa spesa toccherebbe il saldo minimo protetto.";
  }
}

export function explainSnapshot(snapshot: FinancialSnapshot): string[] {
  return [
    `Saldo totale del ciclo: ${snapshot.totalBalance.amount.toFixed(2)} ${snapshot.totalBalance.currency}.`,
    `Saldo protetto: ${snapshot.protectedBalance.amount.toFixed(2)} ${snapshot.protectedBalance.currency}.`,
    `Spese rimanenti del ciclo: ${snapshot.fixedExpensesRemaining.amount.toFixed(2)} ${snapshot.fixedExpensesRemaining.currency}.`,
    `Disponibilità reale ora: ${snapshot.realAvailabilityNow.amount.toFixed(2)} ${snapshot.realAvailabilityNow.currency}.`
  ];
}

export function explainAffordability(result: AffordabilityResult): string[] {
  return [
    explainDecision(result.decision),
    `Impatto nel ciclo corrente: ${result.currentCycleImpact.amount.toFixed(2)} ${result.currentCycleImpact.currency}.`,
    `Disponibilità reale dopo la simulazione: ${result.snapshotAfter.realAvailabilityNow.amount.toFixed(2)} ${result.snapshotAfter.realAvailabilityNow.currency}.`
  ];
}
