import { setApiAccessToken, type AuthSession } from "../api";
import { env } from "../env";
import { buildDemoSession } from "./demoAuth";
import type { AuthClient, MoneyPulseAuthMode } from "./types";

const SESSION_STORAGE_KEY = "moneypulse-session";

function resolveAuthMode(): MoneyPulseAuthMode {
  return env.authMode === "demo" ? "demo" : "app";
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function writeStoredSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function removeStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

export const authClient: AuthClient = {
  get mode() {
    return resolveAuthMode();
  },
  get requiresAuthentication() {
    return resolveAuthMode() !== "demo";
  },
  loadSession() {
    const session = readStoredSession();

    if (session) {
      return session;
    }

    return resolveAuthMode() === "demo" ? buildDemoSession() : null;
  },
  persistSession(session) {
    writeStoredSession(session);
    setApiAccessToken(session.access_token || null);
    return session;
  },
  clearSession() {
    removeStoredSession();

    if (resolveAuthMode() === "demo") {
      const demoSession = buildDemoSession();
      setApiAccessToken(null);
      return demoSession;
    }

    setApiAccessToken(null);
    return null;
  },
  syncApiSession(session) {
    setApiAccessToken(session?.access_token || null);
  }
};

export function loadAuthSession(): AuthSession | null {
  return authClient.loadSession();
}

export function persistAuthSession(session: AuthSession): AuthSession {
  return authClient.persistSession(session);
}

export function clearAuthSession(): AuthSession | null {
  return authClient.clearSession();
}

export function syncAuthSession(session: AuthSession | null) {
  authClient.syncApiSession(session);
}

export function requiresAuthentication(): boolean {
  return authClient.requiresAuthentication;
}
