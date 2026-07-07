import { env } from "./env";

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?:
    | BodyInit
    | null
    | Record<string, unknown>
    | AccountCreateInput
    | TransactionCreateInput
    | GoalCreateInput
    | BeforeYouBuyInput;
};

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

export interface TransactionCreateInput {
  name: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  category?: TransactionCategory;
  effective_date: string;
}

export interface GoalCreateInput {
  name: string;
  target_amount: number;
  planned_contribution: number;
  reserved_amount: number;
  currency: string;
  kind: GoalKind;
}

export interface BeforeYouBuyInput {
  amount: number;
  currency: string;
  description?: string;
}

const API_BASE_URL = env.apiBaseUrl;

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
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export const api = {
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
  listTransactions() {
    return request<Transaction[]>("/transactions");
  },
  createTransaction(payload: TransactionCreateInput) {
    return request<Transaction>("/transactions", {
      method: "POST",
      body: payload
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
  }
};
