import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSession, loadSession, persistSession, syncApiSession } from "./session";

const mockSetApiAccessToken = vi.fn();

vi.mock("./api", () => ({
  setApiAccessToken: (token: string | null) => mockSetApiAccessToken(token)
}));

describe("session helpers", () => {
  const localStorageState = new Map<string, string>();

  beforeEach(() => {
    localStorageState.clear();
    vi.stubGlobal("window", {
      localStorage: {
        clear() {
          localStorageState.clear();
        },
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

  it("persists and reloads an auth session", () => {
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

    persistSession(session);

    expect(loadSession()).toEqual(session);
    expect(mockSetApiAccessToken).toHaveBeenCalledWith("token-123");
  });

  it("clears broken sessions and resets api auth", () => {
    window.localStorage.setItem("moneypulse-session", "{broken");

    expect(loadSession()).toBeNull();

    syncApiSession(null);
    clearSession();

    expect(localStorageState.get("moneypulse-session")).toBeUndefined();
    expect(mockSetApiAccessToken).toHaveBeenLastCalledWith(null);
  });
});
