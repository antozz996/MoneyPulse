import {
  buildDecisionCoachContentFromEngine,
  buildTodayCoachContentFromEngine
} from "../localized-copy";
import { formatCurrency, formatDate, formatDecisionLabel } from "../format";
import { normalizeLanguage, translate, type LanguageCode } from "../i18n";
import { createMoneyAmount } from "../engine";
import { buildCopilotContext } from "./copilotContext";
import { classifyIntent } from "./intents";
import { copilotTools } from "./copilotTools";
import type {
  MockCopilotRequest,
  MockCopilotResponse
} from "./types";

function resolveLanguage(locale: string): LanguageCode {
  return normalizeLanguage(locale) ?? "en";
}

function createCopyHelpers(language: LanguageCode) {
  const t = (key: string, variables?: Record<string, string | number>) =>
    translate(language, key as Parameters<typeof translate>[1], variables);
  const translateAny = (key: string, variables?: Record<string, string | number>) =>
    t(key, variables);

  return {
    t: translateAny,
    formatCurrency: (amount: number, currency: string) =>
      formatCurrency(amount, currency, language),
    formatDate: (date: string) => formatDate(date, language),
    formatDecisionLabel: (value: "safe" | "caution" | "hold") =>
      formatDecisionLabel(value, (key) => translateAny(key))
  };
}

function levelToLegacy(level: "GREEN" | "YELLOW" | "RED" | "BLACK"): "safe" | "caution" | "hold" {
  switch (level) {
    case "GREEN":
      return "safe";
    case "YELLOW":
      return "caution";
    case "RED":
    case "BLACK":
      return "hold";
  }
}

function unknownAnswer(language: LanguageCode): string {
  if (language === "it") {
    return "Posso aiutarti su disponibilita' reale, acquisti, budget, obiettivi, fine ciclo o piano fino allo stipendio.";
  }

  return "I can help with real availability, purchases, budgets, goals, cycle forecast, or a survival plan until payday.";
}

export function generateMockCopilotReply(
  input: MockCopilotRequest
): MockCopilotResponse {
  const language = resolveLanguage(input.locale);
  const helpers = createCopyHelpers(language);
  const classification = classifyIntent(input.message);
  const context = buildCopilotContext(input);

  switch (classification.intent) {
    case "health_check": {
      const snapshotResult = copilotTools.getFinancialSnapshot(input);
      const coach = buildTodayCoachContentFromEngine(snapshotResult.snapshot, helpers);

      return {
        intent: classification.intent,
        classification,
        context,
        answer: `${coach.summary} ${coach.nextSteps[0]}`
      };
    }
    case "affordability_check": {
      if (!classification.entities.amount) {
        return {
          intent: classification.intent,
          classification,
          context,
          answer:
            language === "it"
              ? "Mi manca l'importo da simulare. Dimmi quanto vuoi spendere e ti rispondo in modo prudente."
              : "I'm missing the amount to simulate. Tell me how much you want to spend and I'll answer cautiously."
        };
      }

      const affordability = copilotTools.simulatePurchase({
        ...input,
        purchaseAmount: createMoneyAmount(
          classification.entities.amount,
          classification.entities.currency ?? input.currency
        ),
        description: input.message
      });
      const coach = buildDecisionCoachContentFromEngine(
        affordability.affordability,
        input.message,
        helpers
      );

      return {
        intent: classification.intent,
        classification,
        context,
        answer: `${affordability.affordability.decision.level}: ${coach.summary} ${coach.nextSteps[0]}`
      };
    }
    case "budget_analysis": {
      const result = copilotTools.analyzeBudgets(input);
      const warningCategories = [
        ...result.overLimitCategories,
        ...result.nearLimitCategories
      ];
      const categoryMessage =
        warningCategories.length > 0
          ? warningCategories.join(", ")
          : language === "it"
            ? "nessuna categoria critica"
            : "no critical category";

      return {
        intent: classification.intent,
        classification,
        context,
        answer:
          language === "it"
            ? `Budget ${result.overall}. Stai stressando: ${categoryMessage}.`
            : `Budget ${result.overall}. Pressure areas: ${categoryMessage}.`
      };
    }
    case "goal_analysis": {
      const result = copilotTools.analyzeGoals(input);

      return {
        intent: classification.intent,
        classification,
        context,
        answer:
          language === "it"
            ? `Obiettivi: essenziali ${result.essentialCovered ? "coperti" : "non coperti"}, importanti ${result.importantCovered ? "coperti" : "a rischio"}, flessibili ${result.flexibleDeferred ? "rinviabili" : "in linea"}.`
            : `Goals: essential ${result.essentialCovered ? "covered" : "not covered"}, important ${result.importantCovered ? "covered" : "at risk"}, flexible ${result.flexibleDeferred ? "deferable" : "on track"}.`
      };
    }
    case "forecast_check": {
      const result = copilotTools.forecastCycleEnd(input);
      const checkpoint = result.forecast.nextCheckpoint;

      return {
        intent: classification.intent,
        classification,
        context,
        answer:
          language === "it"
            ? `Se chiudi il ciclo oggi, la disponibilita' proiettata e' ${helpers.formatCurrency(result.forecast.snapshot.projectedAvailability.amount, result.forecast.snapshot.projectedAvailability.currency)}. ${
                checkpoint
                  ? `Prossimo checkpoint: ${checkpoint.label} il ${helpers.formatDate(checkpoint.date)}.`
                  : "Non vedo altri checkpoint documentati."
              }`
            : `Projected availability at cycle end is ${helpers.formatCurrency(result.forecast.snapshot.projectedAvailability.amount, result.forecast.snapshot.projectedAvailability.currency)}. ${
                checkpoint
                  ? `Next checkpoint: ${checkpoint.label} on ${helpers.formatDate(checkpoint.date)}.`
                  : "I do not see other documented checkpoints."
              }`
      };
    }
    case "survival_plan": {
      const result = copilotTools.generateSurvivalPlan(input);

      return {
        intent: classification.intent,
        classification,
        context,
        answer:
          language === "it"
            ? `Piano fino allo stipendio: ${result.steps.join(" ")}`
            : `Plan until payday: ${result.steps.join(" ")}`
      };
    }
    case "unknown":
      return {
        intent: classification.intent,
        classification,
        context,
        answer: unknownAnswer(language)
      };
  }
}
