import { describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { createMoneyAmount } from "../engine";
import { apiDataSource } from "./apiDataSource";
import { demoDataSource } from "./demoDataSource";
import {
  mapBudgetsToEngineBudgets,
  mapFinancialProfileToEngineProfile,
  mapTransactionToEngineTransaction
} from "./mappers";
import { resolveFinancialDataSource } from "./index";

describe("financial data layer", () => {
  it("maps persisted profile rows into engine profile inputs", () => {
    const profile = mapFinancialProfileToEngineProfile({
      profile: {
        id: 1,
        user_id: "user-1",
        currency: "EUR",
        locale: "it-IT",
        salary_day: 27,
        protected_balance: 350,
        risk_profile: "CONSERVATIVE",
        default_cycle_mode: "SALARY_CYCLE",
        status: "active",
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-07-12T00:00:00.000Z"
      },
      todayDate: "2026-07-12"
    });

    expect(profile.salaryDay).toBe(27);
    expect(profile.protectedBalance).toEqual(createMoneyAmount(350, "EUR"));
    expect(profile.riskProfile).toBe("CONSERVATIVE");
  });

  it("maps persisted budgets into engine budget inputs", () => {
    const budgets = mapBudgetsToEngineBudgets(
      [
        {
          id: 1,
          user_id: "user-1",
          category_id: 10,
          amount: 150,
          currency: "EUR",
          period: "MONTHLY",
          status: "active",
          created_at: "",
          updated_at: ""
        }
      ],
      [
        {
          id: 10,
          user_id: "user-1",
          name: "Fun",
          key: "fun",
          entry_type: "expense",
          icon_key: "sparkles",
          color_key: "pink",
          is_system: true,
          status: "active",
          created_at: "",
          updated_at: ""
        }
      ]
    );

    expect(budgets).toEqual([
      {
        category: "fun",
        limit: createMoneyAmount(150, "EUR")
      }
    ]);
  });

  it("maps persisted transaction rows into engine transaction inputs", () => {
    const transaction = mapTransactionToEngineTransaction(
      {
        id: 1,
        account_id: 2,
        category_id: 10,
        amount: 42,
        currency: "EUR",
        type: "expense",
        date: "2026-07-12",
        description: "Dinner",
        merchant: "Bistro",
        source: "manual",
        status: "posted",
        created_at: "",
        updated_at: ""
      },
      [
        {
          id: 10,
          user_id: "user-1",
          name: "Fun",
          key: "fun",
          entry_type: "expense",
          icon_key: "sparkles",
          color_key: "pink",
          is_system: true,
          status: "active",
          created_at: "",
          updated_at: ""
        }
      ]
    );

    expect(transaction).toEqual({
      id: 1,
      name: "Dinner",
      amount: createMoneyAmount(42, "EUR"),
      type: "DISCRETIONARY_EXPENSE",
      effectiveDate: "2026-07-12",
      category: "fun",
      confirmed: true,
      source: "manual"
    });
  });

  it("falls back to demo data when the demo source is selected", async () => {
    const source = resolveFinancialDataSource({ authenticated: false });
    const bundle = await source.load();

    expect(source).toBe(demoDataSource);
    expect(bundle.mode).toBe("demo");
    expect(bundle.accounts).toEqual([]);
    expect(bundle.financialProfile.status).toBe("demo");
  });

  it("loads persisted data through the api data source", async () => {
    vi.spyOn(api, "getFinancialData").mockResolvedValue({
      mode: "api",
      financial_profile: {
        id: 1,
        user_id: "user-1",
        currency: "EUR",
        locale: "en",
        salary_day: null,
        protected_balance: 0,
        risk_profile: "BALANCED",
        default_cycle_mode: "CALENDAR_MONTH",
        status: "active",
        created_at: "",
        updated_at: ""
      },
      categories: [],
      budgets: [],
      accounts: [],
      transactions: [],
      recurring_events: [],
      goals: [],
      bank_connections: []
    });

    const bundle = await apiDataSource.load();

    expect(bundle.mode).toBe("api");
    expect(bundle.financialProfile.currency).toBe("EUR");
  });
});
