import type { AuthSession } from "../api";

const DEMO_SESSION_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function buildDemoSession(): AuthSession {
  return {
    access_token: "",
    token_type: "bearer",
    expires_in_seconds: 31_536_000,
    user: {
      id: "demo-user",
      name: "Demo User",
      email: "demo@moneypulse.local",
      created_at: DEMO_SESSION_CREATED_AT
    }
  };
}
