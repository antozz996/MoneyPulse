import { env } from "../env";
import type { FinancialDataBundle, FinancialDataSource } from "./types";

export const demoDataSource: FinancialDataSource = {
  async load(): Promise<FinancialDataBundle> {
    const now = new Date().toISOString();

    return {
      mode: "demo",
      financialProfile: {
        id: 0,
        user_id: "demo",
        currency: env.defaultCurrency,
        locale: "en",
        salary_day: null,
        protected_balance: 0,
        risk_profile: "BALANCED",
        default_cycle_mode: "CALENDAR_MONTH",
        status: "demo",
        created_at: now,
        updated_at: now
      },
      categories: [],
      budgets: [],
      accounts: [],
      transactions: [],
      recurringEvents: [],
      goals: [],
      bankConnections: []
    };
  }
};
