import type { LanguageCode } from "./i18n";

const localeMap: Record<LanguageCode, string> = {
  en: "en-GB",
  it: "it-IT",
  fr: "fr-FR",
  es: "es-ES"
};

export function getLocale(language: LanguageCode): string {
  return localeMap[language];
}

export function formatCurrency(
  amount: number,
  currency: string,
  language: LanguageCode
): string {
  return new Intl.NumberFormat(getLocale(language), {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date: string, language: LanguageCode): string {
  return new Intl.DateTimeFormat(getLocale(language), {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function formatDecisionLabel(
  value: "safe" | "caution" | "hold",
  t: (key: string) => string
): string {
  return t(`decision.${value}`);
}

export function formatTransactionDirection(
  value: "income" | "expense" | "transfer",
  t: (key: string) => string
): string {
  return t(`common.direction.${value}`);
}

export function formatTransactionCategory(
  value: "essential" | "committed",
  t: (key: string) => string
): string {
  return t(`money.category.${value}`);
}

export function formatRecurringCadence(
  value: "daily" | "weekly" | "monthly",
  t: (key: string) => string
): string {
  return t(`money.cadence.${value}`);
}

export function formatGoalKind(
  value: "goal" | "safety_buffer",
  t: (key: string) => string
): string {
  return t(`goals.kind.${value}`);
}

export function formatGoalPriority(
  value: "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE",
  t: (key: string) => string
): string {
  return t(`goals.priority.${value}`);
}

export function formatBudgetPeriod(
  value: "MONTHLY" | "SALARY_CYCLE",
  t: (key: string) => string
): string {
  return t(`budgets.period.${value}`);
}

export function formatConnectionStatus(value: string, t: (key: string) => string): string {
  const knownKey = `settings.connectionStatus.${value}` as const;
  const translated = t(knownKey);
  return translated === knownKey ? value : translated;
}

export function formatSourceLabel(value: string, t: (key: string) => string): string {
  return value === "bank_import"
    ? t("common.source.bankSync")
    : t("common.source.manual");
}
