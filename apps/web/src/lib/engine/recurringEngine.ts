import { addDays, addMonths, compareDateStrings, isDateWithinRange } from "./dateCycle";
import type {
  FinancialCycle,
  ForecastCheckpoint,
  RecurringItem,
  Transaction,
  TransactionType
} from "./types";

export interface ExpandedRecurringOccurrence {
  date: string;
  label: string;
  amount: ForecastCheckpoint["amount"];
  type: TransactionType;
  category?: string;
  source?: string;
}

function nextRecurringDate(currentDate: string, cadence: RecurringItem["cadence"]): string {
  switch (cadence) {
    case "DAILY":
      return addDays(currentDate, 1);
    case "WEEKLY":
      return addDays(currentDate, 7);
    case "MONTHLY":
      return addMonths(currentDate, 1);
  }
}

export function expandRecurringItemsInRange(
  recurringItems: readonly RecurringItem[],
  startDate: string,
  endDate: string
): ExpandedRecurringOccurrence[] {
  const occurrences: ExpandedRecurringOccurrence[] = [];

  for (const item of recurringItems) {
    if (!item.active) {
      continue;
    }

    let currentDate = item.startDate;

    while (compareDateStrings(currentDate, endDate) <= 0) {
      if (isDateWithinRange(currentDate, startDate, endDate)) {
        occurrences.push({
          date: currentDate,
          label: item.name,
          amount: item.amount,
          type: item.type,
          category: item.category,
          source: item.source
        });
      }

      currentDate = nextRecurringDate(currentDate, item.cadence);
    }
  }

  return occurrences.sort((left, right) => compareDateStrings(left.date, right.date));
}

export function expandRecurringItemsForCycle(
  recurringItems: readonly RecurringItem[],
  cycle: FinancialCycle
): ExpandedRecurringOccurrence[] {
  return expandRecurringItemsInRange(recurringItems, cycle.cycleStart, cycle.cycleEnd);
}

export function recurringOccurrencesToTransactions(
  recurringItems: readonly RecurringItem[],
  cycle: FinancialCycle
): Transaction[] {
  return expandRecurringItemsForCycle(recurringItems, cycle).map((occurrence, index) => ({
    id: `recurring-${index}-${occurrence.date}-${occurrence.label}`,
    name: occurrence.label,
    amount: occurrence.amount,
    type: occurrence.type,
    effectiveDate: occurrence.date,
    category: occurrence.category,
    confirmed: true,
    source: occurrence.source
  }));
}
