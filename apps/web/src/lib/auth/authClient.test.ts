import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "../env";
import { clearAuthSession, loadAuthSession, persistAuthSession, syncAuthSession } from "./authClient";

const mockSetApiAccessToken = vi.fn();

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");

  return {
    ...actual,
    setApiAccessToken: (token: string | null) => mockSetApiAccessToken(token)
  };
});

describe("authClient", () => {
  const localStorageState = new Map<string, string>();

  beforeEach(() => {
    env.authMode = "app";
    localStorageState.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem(key: string) {
          return localStorageState.get(key) ?? null;
        },
        removeItem(key: string) {
          localStorageState.delete(key);
        },
        setItem(key: string, value: string) {
          localStorageState.set(key, value);
        }
      }
    });
    mockSetApiAccessToken.mockReset();
  });

  it("loads the persisted app session when available", () => {
    const session = {
      access_token: "token-123",
      token_type: "bearer" as const,
      expires_in_seconds: 3600,
      user: {
        id: "user-1",
        name: "Antonio",
        email: "antonio@example.com",
        created_at: "2026-07-07T12:00:00Z"
      }
    };

    persistAuthSession(session);

    expect(loadAuthSession()).toEqual(session);
    expect(mockSetApiAccessToken).toHaveBeenCalledWith("token-123");
  });

  it("falls back to a deterministic demo session in demo mode", () => {
    env.authMode = "demo";

    const session = loadAuthSession();

    expect(session?.user.id).toBe("demo-user");
    expect(session?.access_token).toBe("");
  });

  it("restores the demo session after clearing auth in demo mode", () => {
    env.authMode = "demo";

    const clearedSession = clearAuthSession();

    expect(clearedSession?.user.id).toBe("demo-user");
    expect(mockSetApiAccessToken).toHaveBeenCalledWith(null);
  });

  it("syncs the API token when an authenticated session exists", () => {
    syncAuthSession({
      access_token: "sync-token",
      token_type: "bearer",
      expires_in_seconds: 1800,
      user: {
        id: "user-2",
        name: "Chiara",
        email: "chiara@example.com",
        created_at: "2026-07-09T09:30:00Z"
      }
    });

    expect(mockSetApiAccessToken).toHaveBeenCalledWith("sync-token");
  });
});
