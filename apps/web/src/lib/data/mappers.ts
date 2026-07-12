import type {
  Category,
  Budget as ApiBudget,
  FinancialProfile,
  Transaction as ApiTransaction
} from "../api";
import {
  createMoneyAmount,
  type Budget,
  type FinancialProfile as EngineFinancialProfile,
  type Transaction as EngineTransaction
} from "../engine";

export function mapFinancialProfileToEngineProfile(options: {
  profile: FinancialProfile;
  todayDate: string;
}): EngineFinancialProfile {
  return {
    salaryDay: options.profile.salary_day,
    protectedBalance: createMoneyAmount(
      options.profile.protected_balance,
      options.profile.currency
    ),
    riskProfile: options.profile.risk_profile,
    today: options.todayDate
  };
}

export function mapBudgetsToEngineBudgets(
  budgets: ApiBudget[],
  categories: Category[]
): Budget[] {
  const categoryLookup = new Map(categories.map((category) => [category.id, category]));

  return budgets
    .filter((budget) => budget.status === "active")
    .flatMap((budget) => {
      const category = budget.category_id ? categoryLookup.get(budget.category_id) : null;
      if (!category) {
        return [];
      }

      return [
        {
          category: category.key,
          limit: createMoneyAmount(budget.amount, budget.currency)
        }
      ];
    });
}

export function mapTransactionToEngineTransaction(
  transaction: ApiTransaction,
  categories: Category[]
): EngineTransaction | null {
  if (transaction.type === "transfer") {
    return null;
  }

  const category = transaction.category_id
    ? categories.find((item) => item.id === transaction.category_id)
    : null;

  return {
    id: transaction.id,
    name: transaction.description,
    amount: createMoneyAmount(transaction.amount, transaction.currency),
    type: transaction.type === "income" ? "INCOME" : "DISCRETIONARY_EXPENSE",
    effectiveDate: transaction.date,
    category: category?.key,
    confirmed: transaction.status !== "archived",
    source: transaction.source
  };
}
