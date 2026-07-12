import type {
  Category,
  Budget as ApiBudget,
  FinancialProfile,
  Goal as ApiGoal,
  RecurringEvent as ApiRecurringEvent,
  Transaction as ApiTransaction
} from "../api";
import {
  createMoneyAmount,
  type Budget,
  type FinancialProfile as EngineFinancialProfile,
  type Goal as EngineGoal,
  type RecurringItem as EngineRecurringItem,
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

export function mapRecurringEventToEngineRecurringItem(
  recurringEvent: ApiRecurringEvent
): EngineRecurringItem {
  return {
    id: recurringEvent.id,
    name: recurringEvent.name,
    amount: createMoneyAmount(recurringEvent.amount, recurringEvent.currency),
    type:
      recurringEvent.direction === "income"
        ? "INCOME"
        : recurringEvent.category === "essential"
          ? "FIXED_EXPENSE"
          : "DISCRETIONARY_EXPENSE",
    cadence: recurringEvent.frequency.toUpperCase() as EngineRecurringItem["cadence"],
    startDate: recurringEvent.next_due_date ?? recurringEvent.start_date,
    active: recurringEvent.status === "active" && recurringEvent.active,
    category: recurringEvent.category ?? undefined,
    confirmed: true,
    source: "manual"
  };
}

export function mapGoalToEngineGoal(goal: ApiGoal): EngineGoal {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: createMoneyAmount(goal.target_amount, goal.currency),
    plannedContribution: createMoneyAmount(goal.monthly_contribution, goal.currency),
    reservedAmount: createMoneyAmount(goal.current_amount, goal.currency),
    priority: goal.priority,
    active: goal.status === "active",
    kind: goal.kind === "safety_buffer" ? "SAFETY_BUFFER" : "GOAL"
  };
}
