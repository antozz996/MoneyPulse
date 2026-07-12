import type { AuthSession } from "../api";

export type MoneyPulseAuthMode = "app" | "demo";

export interface AuthClient {
  mode: MoneyPulseAuthMode;
  requiresAuthentication: boolean;
  loadSession(): AuthSession | null;
  persistSession(session: AuthSession): AuthSession;
  clearSession(): AuthSession | null;
  syncApiSession(session: AuthSession | null): void;
}
