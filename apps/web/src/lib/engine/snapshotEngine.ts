import {
  calculateBudgetStatus,
  emptyBudgetStatus
} from "./budgetEngine";
import {
  calculateFinancialCycle,
  compareDateStrings,
  daysBetweenInclusive,
  todayDateString
} from "./dateCycle";
import { calculateGoalStatus, summarizeGoals } from "./goalEngine";
import {
  addMoney,
  clampMoneyToZero,
  createMoneyAmount,
  divideMoney,
  subtractMoney,
  sumMoney,
  zeroMoney
} from "./money";
import {
  expandRecurringItemsForCycle,
  recurringOccurrencesToTransactions
} from "./recurringEngine";
import type {
  Account,
  Budget,
  FinancialProfile,
  FinancialSnapshot,
  Goal,
  MoneySummary,
  RecurringItem,
  Transaction,
  TransactionType
} from "./types";

function getReferenceDate(profile: FinancialProfile): string {
  return profile.today ?? todayDateString();
}

function isExpenseType(type: TransactionType): boolean {
  return type !== "INCOME";
}

function isIncomeType(type: TransactionType): boolean {
  return type === "INCOME";
}

export function summarizeMoney(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  recurringItems: readonly RecurringItem[],
  currency: string
): MoneySummary {
  return {
    currency,
    totalBalance: sumMoney(accounts.map((account) => account.balance), currency),
    totalIncome: sumMoney(
      transactions
        .filter((transaction) => transaction.type === "INCOME")
        .map((transaction) => transaction.amount),
      currency
    ),
    totalExpenses: sumMoney(
      transactions
        .filter((transaction) => transaction.type !== "INCOME")
        .map((transaction) => transaction.amount),
      currency
    ),
    activeRecurring: recurringItems.filter((recurringItem) => recurringItem.active).length
  };
}

export function listTransactionsForDate(
  transactions: readonly Transaction[],
  date: string
): Transaction[] {
  return transactions.filter((transaction) => transaction.effectiveDate === date);
}

export function buildFinancialSnapshot(input: {
  profile: FinancialProfile;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  recurringItems: readonly RecurringItem[];
  budgets: readonly Budget[];
  goals: readonly Goal[];
}): FinancialSnapshot {
  const { accounts, budgets, goals, profile, recurringItems, transactions } = input;
  const referenceDate = getReferenceDate(profile);
  const currency = profile.protectedBalance.currency;
  const cycle = calculateFinancialCycle(referenceDate, profile.salaryDay);
  const recurringTransactions = recurringOccurrencesToTransactions(recurringItems, cycle);
  const cycleTransactions = [...transactions, ...recurringTransactions].filter(
    (transaction) =>
      compareDateStrings(transaction.effectiveDate, cycle.cycleStart) >= 0 &&
      compareDateStrings(transaction.effectiveDate, cycle.cycleEnd) <= 0
  );
  const futureCycleTransactions = cycleTransactions.filter(
    (transaction) => compareDateStrings(transaction.effectiveDate, referenceDate) >= 0
  );
  const totalBalance = sumMoney(accounts.map((account) => account.balance), currency);
  const protectedBalance = createMoneyAmount(
    profile.protectedBalance.amount,
    profile.protectedBalance.currency
  );
  const availableBalance = subtractMoney(totalBalance, protectedBalance);
  const cycleIncome = sumMoney(
    cycleTransactions
      .filter((transaction) => isIncomeType(transaction.type))
      .map((transaction) => transaction.amount),
    currency
  );
  const cycleSpent = sumMoney(
    cycleTransactions
      .filter((transaction) => isExpenseType(transaction.type))
      .map((transaction) => transaction.amount),
    currency
  );
  const fixedExpensesRemaining = sumMoney(
    futureCycleTransactions
      .filter((transaction) => isExpenseType(transaction.type))
      .map((transaction) => transaction.amount),
    currency
  );
  const goalStatus = calculateGoalStatus(goals, currency);
  const goalsRemaining = goalStatus.remainingThisCycle;
  const remainingConfirmedIncome = sumMoney(
    futureCycleTransactions
      .filter((transaction) => isIncomeType(transaction.type))
      .map((transaction) => transaction.amount),
    currency
  );
  const realAvailabilityNow = subtractMoney(
    subtractMoney(availableBalance, fixedExpensesRemaining),
    goalsRemaining
  );
  const projectedAvailability = addMoney(realAvailabilityNow, remainingConfirmedIncome);
  const daysRemainingInCycle = daysBetweenInclusive(referenceDate, cycle.cycleEnd);
  const safeDailySpend = divideMoney(
    clampMoneyToZero(realAvailabilityNow),
    daysRemainingInCycle
  );
  const budgetStatus =
    budgets.length > 0
      ? calculateBudgetStatus(budgets, cycleTransactions, cycle, currency)
      : emptyBudgetStatus(currency);

  return {
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    totalBalance,
    protectedBalance,
    availableBalance,
    cycleIncome,
    cycleSpent,
    fixedExpensesRemaining,
    goalsRemaining,
    realAvailabilityNow,
    projectedAvailability,
    daysRemainingInCycle,
    safeDailySpend,
    budgetStatus,
    goalStatus,
    generatedAt: `${referenceDate}T00:00:00.000Z`,
    cycle
  };
}

export { summarizeGoals };
