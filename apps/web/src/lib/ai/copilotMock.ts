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
  MissingDataWarning,
  MockCopilotRequest,
  MockCopilotResponse
} from "./types";

export const DETERMINISTIC_COPILOT_MODEL_VERSION = "deterministic-mock-v1";

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

function isItalian(language: LanguageCode): boolean {
  return language === "it";
}

function levelTone(
  language: LanguageCode,
  level: "GREEN" | "YELLOW" | "RED" | "BLACK"
): string {
  if (isItalian(language)) {
    switch (level) {
      case "GREEN":
        return "verde";
      case "YELLOW":
        return "giallo";
      case "RED":
        return "rosso";
      case "BLACK":
        return "nero";
    }
  }

  switch (level) {
    case "GREEN":
      return "green";
    case "YELLOW":
      return "yellow";
    case "RED":
      return "red";
    case "BLACK":
      return "black";
  }
}

function riskSentence(language: LanguageCode, level: "GREEN" | "YELLOW" | "RED" | "BLACK"): string {
  return isItalian(language)
    ? `Semaforo ${levelTone(language, level)} (${level}).`
    : `Risk level: ${levelTone(language, level)} (${level}).`;
}

function warningMessage(language: LanguageCode, warning: MissingDataWarning): string {
  if (isItalian(language)) {
    switch (warning.code) {
      case "missing_salary_day":
        return "Manca il giorno dello stipendio, quindi uso il mese di calendario come fallback.";
      case "missing_protected_balance":
        return "Manca un saldo protetto configurato.";
      case "no_goals_configured":
        return "Non vedo obiettivi configurati.";
      case "no_budgets_configured":
        return "Non vedo budget per categoria configurati.";
      case "no_transaction_history":
        return "Non vedo ancora storico movimenti.";
    }
  }

  return warning.message;
}

function warningsSentence(language: LanguageCode, warnings: MissingDataWarning[]): string | null {
  if (warnings.length === 0) {
    return null;
  }

  const joined = warnings.map((warning) => warningMessage(language, warning)).join(" ");
  return isItalian(language)
    ? `Dati mancanti: ${joined}`
    : `Missing data: ${joined}`;
}

function joinSentences(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" ");
}

function levelAction(language: LanguageCode, level: "GREEN" | "YELLOW" | "RED" | "BLACK"): string {
  if (isItalian(language)) {
    switch (level) {
      case "GREEN":
        return "Io continuerei cosi', controllando il prossimo checkpoint.";
      case "YELLOW":
        return "Io lo farei solo bloccando gli extra fino al prossimo checkpoint.";
      case "RED":
        return "Io aspetterei o taglierei prima una categoria discrezionale.";
      case "BLACK":
        return "Io non lo farei: prima va ripristinato il saldo protetto.";
    }
  }

  switch (level) {
    case "GREEN":
      return "I would proceed and keep tracking the next checkpoint.";
    case "YELLOW":
      return "I would only proceed if you cut extras until the next checkpoint.";
    case "RED":
      return "I would wait or trim one discretionary category first.";
    case "BLACK":
      return "I would not do it: restore protected balance first.";
  }
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
      const warnings = warningsSentence(language, snapshotResult.grounding.missingDataWarnings);
      const directAnswer =
        snapshotResult.decision.level === "GREEN"
          ? isItalian(language)
            ? "Stai andando bene."
            : "You are on track."
          : snapshotResult.decision.level === "YELLOW"
            ? isItalian(language)
              ? "Stai andando bene, ma con meno margine."
              : "You are okay, but with less margin."
            : isItalian(language)
              ? "Sei sotto pressione in questo ciclo."
              : "This cycle is under pressure.";

      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          directAnswer,
          coach.summary,
          isItalian(language)
            ? `Numeri chiave: disponibilita' reale ${helpers.formatCurrency(
                snapshotResult.grounding.keyNumbers.realAvailabilityNow.amount,
                snapshotResult.grounding.keyNumbers.realAvailabilityNow.currency
              )}, safe daily spend ${helpers.formatCurrency(
                snapshotResult.grounding.keyNumbers.safeDailySpend.amount,
                snapshotResult.grounding.keyNumbers.safeDailySpend.currency
              )}.`
            : `Key numbers: real availability ${helpers.formatCurrency(
                snapshotResult.grounding.keyNumbers.realAvailabilityNow.amount,
                snapshotResult.grounding.keyNumbers.realAvailabilityNow.currency
              )}, safe daily spend ${helpers.formatCurrency(
                snapshotResult.grounding.keyNumbers.safeDailySpend.amount,
                snapshotResult.grounding.keyNumbers.safeDailySpend.currency
              )}.`,
          riskSentence(language, snapshotResult.grounding.riskLevel),
          coach.why[0],
          warnings,
          levelAction(language, snapshotResult.grounding.riskLevel)
        ])
      };
    }
    case "affordability_check": {
      if (!classification.entities.amount) {
        return {
          provider: "mock",
          modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
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
      const warnings = warningsSentence(language, affordability.grounding.missingDataWarnings);
      const directAnswer =
        affordability.affordability.decision.level === "GREEN"
          ? isItalian(language)
            ? "Puoi farlo."
            : "You can do it."
          : affordability.affordability.decision.level === "YELLOW"
            ? isItalian(language)
              ? "Puoi farlo, ma con cautela."
              : "You can do it, but be careful."
            : affordability.affordability.decision.level === "RED"
              ? isItalian(language)
                ? "Non lo consiglierei."
                : "I would not recommend it."
              : isItalian(language)
                ? "No, questa spesa va bloccata."
                : "No, this spend should be blocked.";
      const futureCommitmentsSentence =
        affordability.affordability.futureCommitments.length > 0
          ? isItalian(language)
            ? `Impegni futuri delle rate: ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.futureCommitmentTotal.amount,
                affordability.grounding.keyNumbers.futureCommitmentTotal.currency
              )} su ${affordability.affordability.futureCommitments.length} scadenze.`
            : `Future installment commitments: ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.futureCommitmentTotal.amount,
                affordability.grounding.keyNumbers.futureCommitmentTotal.currency
              )} across ${affordability.affordability.futureCommitments.length} payments.`
          : null;
      const protectedBalanceSentence = affordability.grounding.keyNumbers.protectedBalanceBreached
        ? isItalian(language)
          ? "Questa simulazione toccherebbe il saldo protetto."
          : "This simulation would breach the protected balance."
        : null;
      const alternativeSentence =
        affordability.grounding.suggestedAlternative &&
        (isItalian(language)
          ? affordability.affordability.decision.level === "BLACK"
            ? "Alternativa: sposta l'acquisto al prossimo ciclo o dividilo solo quando il saldo protetto e' salvo."
            : "Alternativa: rimanda l'acquisto oppure taglia prima una categoria discrezionale."
          : affordability.grounding.suggestedAlternative);

      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          directAnswer,
          coach.summary,
          isItalian(language)
            ? `Disponibilita' reale: da ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.availabilityBefore.amount,
                affordability.grounding.keyNumbers.availabilityBefore.currency
              )} a ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.availabilityAfter.amount,
                affordability.grounding.keyNumbers.availabilityAfter.currency
              )}.`
            : `Real availability: from ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.availabilityBefore.amount,
                affordability.grounding.keyNumbers.availabilityBefore.currency
              )} to ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.availabilityAfter.amount,
                affordability.grounding.keyNumbers.availabilityAfter.currency
              )}.`,
          isItalian(language)
            ? `Safe daily spend: da ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.safeDailySpendBefore.amount,
                affordability.grounding.keyNumbers.safeDailySpendBefore.currency
              )} a ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.safeDailySpendAfter.amount,
                affordability.grounding.keyNumbers.safeDailySpendAfter.currency
              )}.`
            : `Safe daily spend: from ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.safeDailySpendBefore.amount,
                affordability.grounding.keyNumbers.safeDailySpendBefore.currency
              )} to ${helpers.formatCurrency(
                affordability.grounding.keyNumbers.safeDailySpendAfter.amount,
                affordability.grounding.keyNumbers.safeDailySpendAfter.currency
              )}.`,
          riskSentence(language, affordability.grounding.riskLevel),
          coach.why[2],
          futureCommitmentsSentence,
          protectedBalanceSentence,
          warnings,
          alternativeSentence,
          levelAction(language, affordability.grounding.riskLevel)
        ])
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
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          helpers.t("copilot.reply.budget", {
            overall: formatBudgetOverall(language, result.overall),
            categories: categoryMessage
          }),
          isItalian(language)
            ? `Numeri chiave: disponibilita' reale ${helpers.formatCurrency(
                result.grounding.keyNumbers.realAvailabilityNow.amount,
                result.grounding.keyNumbers.realAvailabilityNow.currency
              )}, safe daily spend ${helpers.formatCurrency(
                result.grounding.keyNumbers.safeDailySpend.amount,
                result.grounding.keyNumbers.safeDailySpend.currency
              )}.`
            : `Key numbers: real availability ${helpers.formatCurrency(
                result.grounding.keyNumbers.realAvailabilityNow.amount,
                result.grounding.keyNumbers.realAvailabilityNow.currency
              )}, safe daily spend ${helpers.formatCurrency(
                result.grounding.keyNumbers.safeDailySpend.amount,
                result.grounding.keyNumbers.safeDailySpend.currency
              )}.`,
          riskSentence(language, result.grounding.riskLevel),
          warningsSentence(language, result.grounding.missingDataWarnings),
          result.grounding.categoriesToReduce.length > 0
            ? isItalian(language)
              ? `Io ridurrei prima: ${result.grounding.categoriesToReduce.join(", ")}.`
              : `I would reduce these categories first: ${result.grounding.categoriesToReduce.join(", ")}.`
            : levelAction(language, result.grounding.riskLevel)
        ])
      };
    }
    case "goal_analysis": {
      const result = copilotTools.analyzeGoals(input);

      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          helpers.t("copilot.reply.goals", {
            essential: result.essentialCovered
              ? helpers.t("copilot.goalStatus.essentialCovered")
              : helpers.t("copilot.goalStatus.essentialMissing"),
            important: result.importantCovered
              ? helpers.t("copilot.goalStatus.importantCovered")
              : helpers.t("copilot.goalStatus.importantRisk"),
            flexible: result.flexibleDeferred
              ? helpers.t("copilot.goalStatus.flexibleDeferred")
              : helpers.t("copilot.goalStatus.flexibleOnTrack")
          }),
          isItalian(language)
            ? `Da coprire in questo ciclo: ${helpers.formatCurrency(
                result.grounding.keyNumbers.remainingThisCycle.amount,
                result.grounding.keyNumbers.remainingThisCycle.currency
              )}.`
            : `Still to cover this cycle: ${helpers.formatCurrency(
                result.grounding.keyNumbers.remainingThisCycle.amount,
                result.grounding.keyNumbers.remainingThisCycle.currency
              )}.`,
          riskSentence(language, result.grounding.riskLevel),
          warningsSentence(language, result.grounding.missingDataWarnings),
          result.grounding.goalsToProtect.length > 0
            ? isItalian(language)
              ? `Io proteggerei prima: ${result.grounding.goalsToProtect.join(", ")}.`
              : `I would protect these goals first: ${result.grounding.goalsToProtect.join(", ")}.`
            : levelAction(language, result.grounding.riskLevel)
        ])
      };
    }
    case "forecast_check": {
      const result = copilotTools.forecastCycleEnd(input);
      const checkpoint = result.forecast.nextCheckpoint;

      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          helpers.t("copilot.reply.projectedAvailability", {
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
          }),
          isItalian(language)
            ? `Oggi parti da ${helpers.formatCurrency(
                result.grounding.keyNumbers.realAvailabilityNow.amount,
                result.grounding.keyNumbers.realAvailabilityNow.currency
              )} e un safe daily spend di ${helpers.formatCurrency(
                result.grounding.keyNumbers.safeDailySpend.amount,
                result.grounding.keyNumbers.safeDailySpend.currency
              )}.`
            : `You are starting from ${helpers.formatCurrency(
                result.grounding.keyNumbers.realAvailabilityNow.amount,
                result.grounding.keyNumbers.realAvailabilityNow.currency
              )} with a safe daily spend of ${helpers.formatCurrency(
                result.grounding.keyNumbers.safeDailySpend.amount,
                result.grounding.keyNumbers.safeDailySpend.currency
              )}.`,
          riskSentence(language, result.grounding.riskLevel),
          warningsSentence(language, result.grounding.missingDataWarnings),
          levelAction(language, result.grounding.riskLevel)
        ])
      };
    }
    case "survival_plan": {
      const result = copilotTools.generateSurvivalPlan(input);

      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: joinSentences([
          helpers.t("copilot.reply.survivalPlan", {
            steps: result.steps.join(" ")
          }),
          isItalian(language)
            ? `Safe daily spend: ${helpers.formatCurrency(
                result.safeDailySpend.amount,
                result.safeDailySpend.currency
              )} per ${result.daysRemainingInCycle} giorni.`
            : `Safe daily spend: ${helpers.formatCurrency(
                result.safeDailySpend.amount,
                result.safeDailySpend.currency
              )} for ${result.daysRemainingInCycle} days.`,
          result.fixedExpensesStillComing.length > 0
            ? isItalian(language)
              ? `Spese fisse in arrivo: ${result.fixedExpensesStillComing
                  .map(
                    (item) =>
                      `${item.label} ${helpers.formatCurrency(item.amount.amount, item.amount.currency)}`
                  )
                  .join(", ")}.`
              : `Fixed expenses still coming: ${result.fixedExpensesStillComing
                  .map(
                    (item) =>
                      `${item.label} ${helpers.formatCurrency(item.amount.amount, item.amount.currency)}`
                  )
                  .join(", ")}.`
            : null,
          result.goalsToProtect.length > 0
            ? isItalian(language)
              ? `Obiettivi da proteggere: ${result.goalsToProtect.join(", ")}.`
              : `Goals to protect: ${result.goalsToProtect.join(", ")}.`
            : null,
          isItalian(language)
            ? `Non toccare: ${result.whatNotToTouch.join(", ")}.`
            : `Do not touch: ${result.whatNotToTouch.join(", ")}.`,
          result.nextCheckpoint
            ? isItalian(language)
              ? `Prossimo checkpoint: ${result.nextCheckpoint.label} il ${helpers.formatDate(
                  result.nextCheckpoint.date
                )}.`
              : `Next checkpoint: ${result.nextCheckpoint.label} on ${helpers.formatDate(
                  result.nextCheckpoint.date
                )}.`
            : null,
          riskSentence(language, result.grounding.riskLevel),
          warningsSentence(language, result.grounding.missingDataWarnings),
          levelAction(language, result.grounding.riskLevel)
        ])
      };
    }
    case "unknown":
      return {
        provider: "mock",
        modelVersion: DETERMINISTIC_COPILOT_MODEL_VERSION,
        intent: classification.intent,
        classification,
        context,
        answer: unknownAnswer(language)
      };
  }
}
