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
        onboarding_status: "completed",
        onboarding_step: "completed",
        onboarding_completed_at: now,
        setup_quality_score: 100,
        missing_setup_fields: [],
        protected_balance_configured: true,
        zero_balance_declared: true,
        cycle_configured: true,
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
