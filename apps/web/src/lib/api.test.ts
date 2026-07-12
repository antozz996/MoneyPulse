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

  it("exposes helper guards for network failures", async () => {
    const error = new MoneyPulseApiError({
      code: "network_unavailable",
      message: "Network unavailable."
    });

    expect(isNetworkUnavailableError(error)).toBe(true);
    expect(isAuthenticationError(error)).toBe(false);
  });
});
