import { clampMoneyToZero, compareMoney, createMoneyAmount, subtractMoney, sumMoney, zeroMoney } from "./money";
import { isDateWithinRange } from "./dateCycle";
import type { Budget, BudgetHealth, BudgetStatus, FinancialCycle, Transaction } from "./types";

function resolveBudgetHealth(utilization: number): BudgetHealth {
  if (utilization > 1) {
    return "OVER_LIMIT";
  }

  if (utilization >= 0.85) {
    return "NEAR_LIMIT";
  }

  return "HEALTHY";
}

export function calculateBudgetStatus(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
  cycle: FinancialCycle,
  currency: string
): BudgetStatus {
  const items = budgets.map((budget) => {
    const trackedTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "DISCRETIONARY_EXPENSE" &&
        transaction.category === budget.category &&
        isDateWithinRange(transaction.effectiveDate, cycle.cycleStart, cycle.cycleEnd)
    );
    const derivedSpent = sumMoney(
      trackedTransactions.map((transaction) => transaction.amount),
      budget.limit.currency
    );
    const spent = budget.spent ? createMoneyAmount(budget.spent.amount, budget.spent.currency) : derivedSpent;
    const remaining = clampMoneyToZero(subtractMoney(budget.limit, spent));
    const utilization = budget.limit.amount === 0 ? 0 : spent.amount / budget.limit.amount;

    return {
      category: budget.category,
      limit: budget.limit,
      spent,
      remaining,
      utilization,
      health: resolveBudgetHealth(utilization)
    };
  });
  const overLimitCount = items.filter((item) => item.health === "OVER_LIMIT").length;
  const nearLimitCount = items.filter((item) => item.health === "NEAR_LIMIT").length;
  const overall =
    overLimitCount > 0 ? "OVER_LIMIT" : nearLimitCount > 0 ? "NEAR_LIMIT" : "HEALTHY";

  return {
    overall,
    items,
    nearLimitCount,
    overLimitCount
  };
}

export function emptyBudgetStatus(currency: string): BudgetStatus {
  return {
    overall: "HEALTHY",
    items: [],
    nearLimitCount: 0,
    overLimitCount: 0
  };
}
