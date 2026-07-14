import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  isAuthenticationError,
  isNetworkUnavailableError,
  MoneyPulseApiError,
  setApiAccessToken
} from "./api";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces an offline-friendly error when the network is unavailable", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(api.listAccounts()).rejects.toMatchObject({
      code: "network_unavailable",
      message: "Your device appears to be offline. Reconnect to keep MoneyPulse in sync."
    });
  });

  it("preserves authentication errors with status and code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "authentication_error",
            message: "Authentication required."
          }
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    ));

    await expect(api.listAccounts()).rejects.toSatisfy((error: unknown) => {
      expect(isAuthenticationError(error)).toBe(true);
      expect(error).toBeInstanceOf(MoneyPulseApiError);
      expect((error as MoneyPulseApiError).statusCode).toBe(401);
      expect((error as MoneyPulseApiError).code).toBe("authentication_error");
      return true;
    });
  });

  it("attaches the bearer token when one is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    setApiAccessToken("secure-token");

    await api.listAccounts();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secure-token"
        })
      })
    );
    setApiAccessToken(null);
  });

  it("updates transactions with PATCH and keeps the new response shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          account_id: 2,
          category_id: null,
          amount: 95,
          currency: "EUR",
          type: "expense",
          date: "2026-07-12",
          description: "Dinner",
          merchant: "Bistro",
          source: "manual",
          status: "posted",
          created_at: "",
          updated_at: ""
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.updateTransaction(1, { amount: 95 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/transactions/1"),
      expect.objectContaining({
        method: "PATCH"
      })
    );
  });

  it("uses PATCH for budgets, goals, and recurring items", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.updateBudget(1, { amount: 200 });
    await api.updateGoal(2, { current_amount: 80 });
    await api.updateRecurringEvent(3, { amount: 40 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/budgets/1"),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/goals/2"),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("/recurring-items/3"),
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("sends CSV preview and commit requests to the import endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            batch_identifier: "batch-1",
            filename: "bank.csv",
            detected_delimiter: ",",
            detected_encoding: "utf-8",
            detected_mapping: {},
            available_columns: ["Date", "Description", "Amount"],
            rows: [],
            rejected_rows: [],
            preview_fingerprint: "fingerprint-1",
            warnings: [],
            generated_at: "2026-07-12T00:00:00Z"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            batch_id: 1,
            batch_identifier: "batch-1",
            imported_count: 1,
            skipped_count: 0,
            error_count: 0,
            warnings: []
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.previewTransactionImport({
      filename: "bank.csv",
      content_base64: "YQ==",
      currency: "EUR"
    });
    await api.commitTransactionImport({
      filename: "bank.csv",
      batch_identifier: "batch-1",
      preview_fingerprint: "fingerprint-1",
      mapping: {},
      rows: []
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/transactions/import/preview"),
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/transactions/import/commit"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends onboarding lifecycle requests to the onboarding endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: {
              id: 1,
              user_id: "user-1",
              currency: "EUR",
              locale: "it-IT",
              salary_day: null,
              protected_balance: 0,
              risk_profile: "BALANCED",
              default_cycle_mode: "CALENDAR_MONTH",
              onboarding_status: "in_progress",
              onboarding_step: "basics",
              onboarding_completed_at: null,
              setup_quality_score: 20,
              missing_setup_fields: ["primary_account"],
              protected_balance_configured: false,
              zero_balance_declared: false,
              cycle_configured: true,
              status: "active",
              created_at: "",
              updated_at: ""
            },
            can_complete: false,
            recommended_next_action: "primary_account",
            has_accounts: false,
            has_income_schedule: false,
            has_fixed_commitments: false,
            has_goals: false,
            has_budgets: false,
            has_transaction_history: false
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: {
              id: 1,
              user_id: "user-1",
              currency: "EUR",
              locale: "it-IT",
              salary_day: null,
              protected_balance: 0,
              risk_profile: "BALANCED",
              default_cycle_mode: "CALENDAR_MONTH",
              onboarding_status: "completed",
              onboarding_step: "completed",
              onboarding_completed_at: "2026-07-12T00:00:00Z",
              setup_quality_score: 60,
              missing_setup_fields: [],
              protected_balance_configured: true,
              zero_balance_declared: true,
              cycle_configured: true,
              status: "active",
              created_at: "",
              updated_at: ""
            },
            can_complete: true,
            recommended_next_action: "review",
            has_accounts: false,
            has_income_schedule: false,
            has_fixed_commitments: false,
            has_goals: false,
            has_budgets: false,
            has_transaction_history: false
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.updateOnboarding({ onboarding_step: "accounts" });
    await api.completeOnboarding();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/onboarding"),
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/onboarding/complete"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends categorization and feedback requests to the transaction intelligence endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                source_row_number: null,
                suggested_category_id: 4,
                normalized_merchant: "Vodafone",
                confidence: 0.91,
                matched_rule_source: "merchant_alias",
                explanation: "Recognized the merchant as Vodafone.",
                needs_review: false,
                warnings: []
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            account_id: null,
            category_id: 4,
            amount: 35,
            currency: "EUR",
            type: "expense",
            date: "2026-07-12",
            description: "Vodafone",
            merchant: "Vodafone",
            source: "manual",
            status: "posted",
            created_at: "",
            updated_at: ""
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.categorizeTransactions([
      {
        description: "ADDEBITO SEPA VODAFONE",
        type: "expense"
      }
    ]);
    await api.submitTransactionCategorizationFeedback(1, {
      confirmed_category_id: 4,
      confirmed_merchant: "Vodafone",
      apply_to_similar: true
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/transactions/categorize"),
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/transactions/1/categorization-feedback"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("exposes helper guards for network failures", async () => {
    const error = new MoneyPulseApiError({
      code: "network_unavailable",
      message: "Network unavailable."
    });

    expect(isNetworkUnavailableError(error)).toBe(true);
    expect(isAuthenticationError(error)).toBe(false);
  });

  it("sends categorization and feedback requests to the transaction intelligence endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                source_row_number: null,
                suggested_category_id: 4,
                normalized_merchant: "Vodafone",
                confidence: 0.91,
                matched_rule_source: "merchant_alias",
                explanation: "Recognized the merchant as Vodafone.",
                needs_review: false,
                warnings: []
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 1,
            account_id: null,
            category_id: 4,
            amount: 35,
            currency: "EUR",
            type: "expense",
            date: "2026-07-12",
            description: "Vodafone",
            merchant: "Vodafone",
            source: "manual",
            status: "posted",
            created_at: "",
            updated_at: ""
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await api.categorizeTransactions([
      {
        description: "ADDEBITO SEPA VODAFONE",
        type: "expense"
      }
    ]);
    await api.submitTransactionCategorizationFeedback(1, {
      confirmed_category_id: 4,
      confirmed_merchant: "Vodafone",
      apply_to_similar: true
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/transactions/categorize"),
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/transactions/1/categorization-feedback"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
