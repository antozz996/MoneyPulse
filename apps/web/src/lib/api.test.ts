import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  isAuthenticationError,
  isNetworkUnavailableError,
  MoneyPulseApiError
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

  it("exposes helper guards for network failures", async () => {
    const error = new MoneyPulseApiError({
      code: "network_unavailable",
      message: "Network unavailable."
    });

    expect(isNetworkUnavailableError(error)).toBe(true);
    expect(isAuthenticationError(error)).toBe(false);
  });
});
