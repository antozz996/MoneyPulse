import { env } from "./env";

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?:
    | BodyInit
    | null
    | Record<string, unknown>
    | AccountCreateInput
    | AccountUpdateInput
    | TransactionCreateInput
    | TransactionUpdateInput
    | GoalCreateInput
    | GoalUpdateInput
    | RecurringEventCreateInput
    | RecurringEventUpdateInput
    | RegisterInput
    | LoginInput
    | BeforeYouBuyInput;
};

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: "bearer";
  expires_in_seconds: number;
  user: User;
}

export interface Account {
  id: number;
  name: string;
  balance: number;
  currency: string;
  created_at: string;
}

export type TransactionDirection = "income" | "expense";
export type TransactionCategory = "essential" | "committed";

export interface Transaction {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category: TransactionCategory | null;
  effective_date: string;
  created_at: string;
}

export type GoalKind = "goal" | "safety_buffer";

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  planned_contribution: number;
  reserved_amount: number;
  currency: string;
  kind: GoalKind;
  created_at: string;
}

export type RecurringEventCadence = "daily" | "weekly" | "monthly";

export interface RecurringEvent {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category: TransactionCategory | null;
  cadence: RecurringEventCadence;
  start_date: string;
  active: boolean;
  created_at: string;
}

export interface TodayResponse {
  available_to_spend_today: number;
  risk_level: "safe" | "caution" | "hold";
  currency: string;
  model_version: string;
  explanations: string[];
  inputs: {
    available_balance: number;
    expected_income_today: number;
    essential_obligations: number;
    committed_spending: number;
    safety_buffer: number;
    planned_goal_contribution: number;
  };
  confidence: {
    mode: "deterministic";
    input_completeness: "complete";
    uses_documented_inputs_only: boolean;
    purchase_context: "not-provided" | "matched-currency";
    supported_inputs: string[];
    model_version: string;
  };
}

export interface BeforeYouBuyResponse {
  current_available_to_spend: number;
  purchase_amount: number;
  available_to_spend_after_purchase: number;
  delta: number;
  can_afford: boolean;
  decision: "safe" | "caution" | "hold";
  currency: string;
  model_version: string;
  explanations: string[];
  alternatives?: string[];
  confidence: {
    mode: "deterministic";
    input_completeness: "complete";
    uses_documented_inputs_only: boolean;
    purchase_context: "not-provided" | "matched-currency";
    supported_inputs: string[];
    model_version: string;
  };
}

export interface AccountCreateInput {
  name: string;
  balance: number;
  currency: string;
}

export type AccountUpdateInput = AccountCreateInput;

export interface TransactionCreateInput {
  name: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category?: TransactionCategory;
  effective_date: string;
}

export type TransactionUpdateInput = TransactionCreateInput;

export interface GoalCreateInput {
  name: string;
  target_amount: number;
  planned_contribution: number;
  reserved_amount: number;
  currency: string;
  kind: GoalKind;
}

export type GoalUpdateInput = GoalCreateInput;

export interface RecurringEventCreateInput {
  name: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category?: TransactionCategory;
  cadence: RecurringEventCadence;
  start_date: string;
  active: boolean;
}

export type RecurringEventUpdateInput = RecurringEventCreateInput;

export interface BeforeYouBuyInput {
  amount: number;
  currency: string;
  description?: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const API_BASE_URL = env.apiBaseUrl;
let accessToken: string | null = null;

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const body =
    init?.body && typeof init.body === "object" && !(init.body instanceof FormData)
      ? JSON.stringify(init.body)
      : init?.body;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {})
      },
      body: body as BodyInit | null | undefined
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const apiLocation = API_BASE_URL || "the current web origin";
      throw new Error(
        `MoneyPulse could not reach the API at ${apiLocation}. Check the backend URL or local proxy configuration.`
      );
    }

    throw error;
  }

  if (!response.ok) {
    let parsedMessage: string | null = null;
    const responseClone = response.clone();

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
        detail?: string;
      };
      parsedMessage = payload.error?.message ?? payload.detail ?? null;
    } catch {
      const fallbackText = await responseClone.text();
      parsedMessage = fallbackText || null;
    }

    throw new Error(parsedMessage || `Request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  register(payload: RegisterInput) {
    return request<AuthSession>("/auth/register", {
      method: "POST",
      body: payload
    });
  },
  login(payload: LoginInput) {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: payload
    });
  },
  logout() {
    return request<void>("/auth/logout", {
      method: "POST"
    });
  },
  getToday() {
    return request<TodayResponse>("/today");
  },
  evaluateBeforeYouBuy(payload: BeforeYouBuyInput) {
    return request<BeforeYouBuyResponse>("/before-you-buy", {
      method: "POST",
      body: payload
    });
  },
  listAccounts() {
    return request<Account[]>("/accounts");
  },
  createAccount(payload: AccountCreateInput) {
    return request<Account>("/accounts", {
      method: "POST",
      body: payload
    });
  },
  updateAccount(accountId: number, payload: AccountUpdateInput) {
    return request<Account>(`/accounts/${accountId}`, {
      method: "PUT",
      body: payload
    });
  },
  deleteAccount(accountId: number) {
    return request<void>(`/accounts/${accountId}`, {
      method: "DELETE"
    });
  },
  listTransactions() {
    return request<Transaction[]>("/transactions");
  },
  createTransaction(payload: TransactionCreateInput) {
    return request<Transaction>("/transactions", {
      method: "POST",
      body: payload
    });
  },
  updateTransaction(transactionId: number, payload: TransactionUpdateInput) {
    return request<Transaction>(`/transactions/${transactionId}`, {
      method: "PUT",
      body: payload
    });
  },
  deleteTransaction(transactionId: number) {
    return request<void>(`/transactions/${transactionId}`, {
      method: "DELETE"
    });
  },
  listGoals() {
    return request<Goal[]>("/goals");
  },
  createGoal(payload: GoalCreateInput) {
    return request<Goal>("/goals", {
      method: "POST",
      body: payload
    });
  },
  updateGoal(goalId: number, payload: GoalUpdateInput) {
    return request<Goal>(`/goals/${goalId}`, {
      method: "PUT",
      body: payload
    });
  },
  deleteGoal(goalId: number) {
    return request<void>(`/goals/${goalId}`, {
      method: "DELETE"
    });
  },
  listRecurringEvents() {
    return request<RecurringEvent[]>("/recurring-events");
  },
  createRecurringEvent(payload: RecurringEventCreateInput) {
    return request<RecurringEvent>("/recurring-events", {
      method: "POST",
      body: payload
    });
  },
  updateRecurringEvent(
    recurringEventId: number,
    payload: RecurringEventUpdateInput
  ) {
    return request<RecurringEvent>(`/recurring-events/${recurringEventId}`, {
      method: "PUT",
      body: payload
    });
  },
  deleteRecurringEvent(recurringEventId: number) {
    return request<void>(`/recurring-events/${recurringEventId}`, {
      method: "DELETE"
    });
  }
};
