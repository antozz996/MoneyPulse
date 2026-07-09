import { compareDateStrings, todayDateString } from "./dateCycle";
import { buildFinancialSnapshot } from "./snapshotEngine";
import { expandRecurringItemsForCycle } from "./recurringEngine";
import type {
  Account,
  Budget,
  FinancialProfile,
  ForecastCheckpoint,
  ForecastResult,
  FutureCommitment,
  Goal,
  RecurringItem,
  Transaction
} from "./types";

export function buildForecast(input: {
  profile: FinancialProfile;
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  recurringItems: readonly RecurringItem[];
  budgets: readonly Budget[];
  goals: readonly Goal[];
  futureCommitments?: readonly FutureCommitment[];
}): ForecastResult {
  const snapshot = buildFinancialSnapshot(input);
  const referenceDate = input.profile.today ?? todayDateString();
  const recurringCheckpoints = expandRecurringItemsForCycle(input.recurringItems, snapshot.cycle)
    .filter((occurrence) => compareDateStrings(occurrence.date, referenceDate) >= 0)
    .map<ForecastCheckpoint>((occurrence) => ({
      date: occurrence.date,
      label: occurrence.label,
      amount: occurrence.amount,
      kind: "RECURRING",
      type: occurrence.type
    }));
  const transactionCheckpoints = input.transactions
    .filter((transaction) => compareDateStrings(transaction.effectiveDate, referenceDate) >= 0)
    .map<ForecastCheckpoint>((transaction) => ({
      date: transaction.effectiveDate,
      label: transaction.name,
      amount: transaction.amount,
      kind: "TRANSACTION",
      type: transaction.type
    }));
  const installmentCheckpoints = (input.futureCommitments ?? []).map<ForecastCheckpoint>(
    (commitment) => ({
      date: commitment.dueDate,
      label: commitment.label,
      amount: commitment.amount,
      kind: "INSTALLMENT",
      type: "DISCRETIONARY_EXPENSE"
    })
  );
  const checkpoints = [...transactionCheckpoints, ...recurringCheckpoints, ...installmentCheckpoints].sort(
    (left, right) => compareDateStrings(left.date, right.date)
  );

  return {
    cycle: snapshot.cycle,
    snapshot,
    nextCheckpoint: checkpoints[0] ?? null,
    checkpoints,
    futureCommitments: [...(input.futureCommitments ?? [])]
  };
}
