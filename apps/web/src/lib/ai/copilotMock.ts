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
  return translate(
    language,
    "copilot.reply.unknown" as Parameters<typeof translate>[1]
  );
}

function formatBudgetOverall(
  language: LanguageCode,
  overall: "HEALTHY" | "NEAR_LIMIT" | "OVER_LIMIT"
): string {
  return translate(
    language,
    `copilot.budgetStatus.${overall}` as Parameters<typeof translate>[1]
  );
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
          answer: helpers.t("copilot.reply.missingAmount")
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
          : helpers.t("copilot.reply.noCriticalCategory");

      return {
        intent: classification.intent,
        classification,
        context,
        answer: helpers.t("copilot.reply.budget", {
          overall: formatBudgetOverall(language, result.overall),
          categories: categoryMessage
        })
      };
    }
    case "goal_analysis": {
      const result = copilotTools.analyzeGoals(input);

      return {
        intent: classification.intent,
        classification,
        context,
        answer: helpers.t("copilot.reply.goals", {
          essential: result.essentialCovered
            ? helpers.t("copilot.goalStatus.essentialCovered")
            : helpers.t("copilot.goalStatus.essentialMissing"),
          important: result.importantCovered
            ? helpers.t("copilot.goalStatus.importantCovered")
            : helpers.t("copilot.goalStatus.importantRisk"),
          flexible: result.flexibleDeferred
            ? helpers.t("copilot.goalStatus.flexibleDeferred")
            : helpers.t("copilot.goalStatus.flexibleOnTrack")
        })
      };
    }
    case "forecast_check": {
      const result = copilotTools.forecastCycleEnd(input);
      const checkpoint = result.forecast.nextCheckpoint;

      return {
        intent: classification.intent,
        classification,
        context,
        answer: helpers.t("copilot.reply.projectedAvailability", {
          amount: helpers.formatCurrency(
            result.forecast.snapshot.projectedAvailability.amount,
            result.forecast.snapshot.projectedAvailability.currency
          ),
          checkpoint: checkpoint
            ? helpers.t("copilot.reply.nextCheckpoint", {
                label: checkpoint.label,
                date: helpers.formatDate(checkpoint.date)
              })
            : helpers.t("copilot.reply.noCheckpoint")
        })
      };
    }
    case "survival_plan": {
      const result = copilotTools.generateSurvivalPlan(input);

      return {
        intent: classification.intent,
        classification,
        context,
        answer: helpers.t("copilot.reply.survivalPlan", {
          steps: result.steps.join(" ")
        })
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
