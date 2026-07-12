import type {
  Account,
  BankConnection,
  Budget,
  Category,
  FinancialDataResponse,
  FinancialProfile,
  Goal,
  RecurringEvent,
  Transaction
} from "../api";

export interface FinancialDataBundle {
  mode: "api" | "demo";
  financialProfile: FinancialProfile;
  categories: Category[];
  budgets: Budget[];
  accounts: Account[];
  transactions: Transaction[];
  recurringEvents: RecurringEvent[];
  goals: Goal[];
  bankConnections: BankConnection[];
}

export interface FinancialDataSource {
  load(): Promise<FinancialDataBundle>;
}

export interface FinancialDataSourceOptions {
  authenticated: boolean;
}

export function fromFinancialDataResponse(
  payload: FinancialDataResponse
): FinancialDataBundle {
  return {
    mode: payload.mode,
    financialProfile: payload.financial_profile,
    categories: payload.categories,
    budgets: payload.budgets,
    accounts: payload.accounts,
    transactions: payload.transactions,
    recurringEvents: payload.recurring_events,
    goals: payload.goals,
    bankConnections: payload.bank_connections
  };
}
