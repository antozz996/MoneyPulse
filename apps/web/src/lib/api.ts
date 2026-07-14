import { env } from "./env";
import type { LanguageCode } from "./i18n";

export class MoneyPulseApiError extends Error {
  statusCode?: number;
  code: string;
  details?: unknown;

  constructor(options: {
    message: string;
    code: string;
    statusCode?: number;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "MoneyPulseApiError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?:
    | BodyInit
    | null
    | Record<string, unknown>
    | AccountCreateInput
    | AccountUpdateInput
    | TransactionCreateInput
    | TransactionUpdateInput
    | TransactionCategorizationFeedbackInput
    | TransactionRecategorizeRequest
    | BudgetCreateInput
    | BudgetUpdateInput
    | GoalCreateInput
    | GoalUpdateInput
    | RecurringEventCreateInput
    | RecurringEventUpdateInput
    | FinancialProfileUpdateInput
    | OnboardingUpdateInput
    | BankConnectStartInput
    | BankConnectCompleteInput
    | BankSyncInput
    | RegisterInput
    | LoginInput
    | BeforeYouBuyInput
    | CopilotChatInput;
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
  source: string;
  created_at: string;
}

export type TransactionDirection = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionCategory = "essential" | "committed";

export interface Transaction {
  id: number;
  account_id: number | null;
  category_id: number | null;
  amount: number;
  currency: string;
  type: TransactionType;
  date: string;
  description: string;
  merchant: string | null;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface BankConnection {
  id: number;
  provider: "mock";
  status: string;
  institution_name: string;
  linked_accounts: number;
  last_sync_at: string | null;
  created_at: string;
}

export type GoalKind = "goal" | "safety_buffer";

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  planned_contribution: number;
  reserved_amount: number;
  currency: string;
  kind: GoalKind;
  priority: "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE";
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export type FinancialRiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
export type FinancialCycleMode = "SALARY_CYCLE" | "CALENDAR_MONTH";
export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";
export type OnboardingStep =
  | "basics"
  | "accounts"
  | "protected_money"
  | "income"
  | "fixed_commitments"
  | "goals"
  | "budgets"
  | "review"
  | "completed";
export type SetupFieldCode =
  | "cycle_mode"
  | "salary_day"
  | "primary_account"
  | "protected_balance"
  | "income_schedule"
  | "fixed_commitments"
  | "goals"
  | "budgets"
  | "transaction_history";

export interface FinancialProfile {
  id: number;
  user_id: string;
  currency: string;
  locale: string;
  salary_day: number | null;
  protected_balance: number;
  risk_profile: FinancialRiskProfile;
  default_cycle_mode: FinancialCycleMode;
  onboarding_status: OnboardingStatus;
  onboarding_step: OnboardingStep | null;
  onboarding_completed_at: string | null;
  setup_quality_score: number;
  missing_setup_fields: SetupFieldCode[];
  protected_balance_configured: boolean;
  zero_balance_declared: boolean;
  cycle_configured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialProfileUpdateInput {
  currency: string;
  locale: string;
  salary_day: number | null;
  protected_balance: number;
  risk_profile: FinancialRiskProfile;
  default_cycle_mode: FinancialCycleMode;
}

export interface OnboardingUpdateInput {
  currency?: string;
  locale?: string;
  salary_day?: number | null;
  protected_balance?: number;
  default_cycle_mode?: FinancialCycleMode;
  onboarding_status?: "not_started" | "in_progress" | "skipped";
  onboarding_step?: OnboardingStep;
  protected_balance_configured?: boolean;
  zero_balance_declared?: boolean;
  cycle_configured?: boolean;
}

export interface OnboardingSummary {
  profile: FinancialProfile;
  can_complete: boolean;
  recommended_next_action: SetupFieldCode | "review" | null;
  has_accounts: boolean;
  has_income_schedule: boolean;
  has_fixed_commitments: boolean;
  has_goals: boolean;
  has_budgets: boolean;
  has_transaction_history: boolean;
}

export interface Category {
  id: number;
  user_id: string;
  name: string;
  key: string;
  entry_type: "income" | "expense" | "transfer";
  icon_key: string | null;
  color_key: string | null;
  is_system: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: number;
  user_id: string;
  category_id: number | null;
  amount: number;
  currency: string;
  period: "MONTHLY" | "SALARY_CYCLE";
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetCreateInput {
  category_id: number;
  amount: number;
  currency: string;
  period: "MONTHLY" | "SALARY_CYCLE";
  status?: string;
}

export type BudgetUpdateInput = Partial<BudgetCreateInput>;

export interface FinancialDataResponse {
  mode: "api" | "demo";
  financial_profile: FinancialProfile;
  categories: Category[];
  budgets: Budget[];
  accounts: Account[];
  transactions: Transaction[];
  recurring_events: RecurringEvent[];
  goals: Goal[];
  bank_connections: BankConnection[];
}

export type RecurringEventCadence = "daily" | "weekly" | "monthly";

export interface RecurringEvent {
  id: number;
  account_id: number | null;
  category_id: number | null;
  name: string;
  amount: number;
  currency: string;
  type: TransactionDirection;
  direction: TransactionDirection;
  category: TransactionCategory | null;
  frequency: RecurringEventCadence;
  cadence: RecurringEventCadence;
  next_due_date: string | null;
  start_date: string;
  active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
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
  account_id?: number;
  category_id?: number;
  amount: number;
  currency: string;
  type: TransactionType;
  date: string;
  description: string;
  merchant?: string;
}

export type TransactionUpdateInput = Partial<TransactionCreateInput>;

export interface TransactionCategorizationInputRow {
  source_row_number?: number | null;
  description: string;
  merchant?: string | null;
  amount?: number | null;
  type: TransactionType;
  date?: string | null;
  account_id?: number | null;
  category_id?: number | null;
  currency?: string | null;
}

export interface TransactionCategorizationSuggestion {
  source_row_number: number | null;
  suggested_category_id: number | null;
  normalized_merchant: string | null;
  confidence: number;
  matched_rule_source:
    | "explicit"
    | "user_rule_exact"
    | "merchant_alias"
    | "user_rule_partial"
    | "history"
    | "system_rule"
    | "fallback";
  explanation: string;
  needs_review: boolean;
  warnings: string[];
}

export interface TransactionCategorizationResponse {
  items: TransactionCategorizationSuggestion[];
}

export interface TransactionCategorizationFeedbackInput {
  confirmed_category_id: number;
  confirmed_merchant?: string | null;
  apply_to_similar: boolean;
}

export interface TransactionRecategorizeRequest {
  commit?: boolean;
  overwrite_existing?: boolean;
  limit?: number;
}

export interface TransactionRecategorizeItem {
  transaction_id: number;
  description: string;
  merchant: string | null;
  previous_category_id: number | null;
  suggested_category_id: number | null;
  normalized_merchant: string | null;
  confidence: number;
  explanation: string;
  needs_review: boolean;
  updated: boolean;
}

export interface TransactionRecategorizeResponse {
  commit: boolean;
  evaluated_count: number;
  updated_count: number;
  items: TransactionRecategorizeItem[];
}

export interface GoalCreateInput {
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  currency: string;
  priority: "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE";
  deadline?: string | null;
  status?: string;
  kind?: GoalKind;
}

export type GoalUpdateInput = Partial<GoalCreateInput>;

export interface RecurringEventCreateInput {
  account_id?: number;
  category_id?: number;
  name: string;
  amount: number;
  currency: string;
  type: TransactionDirection;
  direction: TransactionDirection;
  category?: TransactionCategory;
  frequency: RecurringEventCadence;
  cadence: RecurringEventCadence;
  next_due_date: string;
  start_date: string;
  active: boolean;
  status?: string;
}

export type RecurringEventUpdateInput = Partial<RecurringEventCreateInput>;

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

export interface BankConnectStartInput {
  provider: "mock";
  institution_id?: string;
}

export interface BankConnectStartResponse {
  connection_id: number;
  provider: "mock";
  status: "pending";
  institution_name: string;
  start_reference: string;
  authorize_url: string;
}

export interface BankConnectCompleteInput {
  connection_id: number;
}

export interface BankSyncInput {
  connection_id?: number;
}

export interface BankSyncResponse {
  connections_synced: number;
  accounts_upserted: number;
  imported_transactions: number;
  duplicate_transactions: number;
}

export interface CoachTodaySummary {
  source: "deterministic" | "llm";
  summary: string;
  why: string[];
  what_changed: string[];
  next_steps: string[];
  model_version: string;
  risk_level: "safe" | "caution" | "hold";
  available_to_spend_today: number;
  currency: string;
}

export interface CoachDecisionExplanation {
  source: "deterministic" | "llm";
  summary: string;
  why: string[];
  what_changed: string[];
  next_steps: string[];
  model_version: string;
  baseline_risk_level: "safe" | "caution" | "hold";
  decision: "safe" | "caution" | "hold";
  current_available_to_spend: number;
  purchase_amount: number;
  available_to_spend_after_purchase: number;
  delta: number;
  can_afford: boolean;
  currency: string;
}

export interface CoachWeeklySummary {
  source: "deterministic" | "llm";
  summary: string;
  why: string[];
  what_changed: string[];
  next_steps: string[];
  model_version: string;
  period_start: string;
  period_end: string;
  risk_level: "safe" | "caution" | "hold";
  current_available_to_spend: number;
  documented_income: number;
  documented_outgoing: number;
  upcoming_items_count: number;
  currency: string;
}

export interface CopilotApiHistoryMessage {
  role: "assistant" | "user";
  text: string;
}

export interface CopilotChatInput {
  message: string;
  locale: string;
  history: CopilotApiHistoryMessage[];
}

export interface CopilotChatResponse {
  provider: "mock" | "openai";
  model_version: string;
  fallback_used?: boolean;
  model?: string | null;
  intent:
    | "health_check"
    | "affordability_check"
    | "budget_analysis"
    | "goal_analysis"
    | "forecast_check"
    | "survival_plan"
    | "unknown";
  answer: string;
  classification: {
    intent: CopilotChatResponse["intent"];
    confidence: number;
    entities: {
      amount: number | null;
      currency: string | null;
    };
  };
  context: {
    locale: string;
    currency: string;
    risk_profile: "BALANCED";
    snapshot_summary: {
      cycle_start: string;
      cycle_end: string;
      real_availability_now: { amount: number; currency: string };
      projected_availability: { amount: number; currency: string };
      safe_daily_spend: { amount: number; currency: string };
      decision_level: "GREEN" | "YELLOW" | "RED" | "BLACK";
    };
    budget_summary: {
      overall: "HEALTHY" | "NEAR_LIMIT" | "OVER_LIMIT";
      over_limit_categories: string[];
      near_limit_categories: string[];
    };
    goal_summary: {
      essential_covered: boolean;
      important_covered: boolean;
      flexible_deferred: boolean;
      remaining_this_cycle: { amount: number; currency: string };
    };
    recent_decision_summary?: {
      level: "GREEN" | "YELLOW" | "RED" | "BLACK";
      status: "ALLOW" | "ALLOW_WITH_CAUTION" | "NOT_RECOMMENDED" | "BLOCKED";
      purchase_amount: { amount: number; currency: string };
      remaining_after_purchase: { amount: number; currency: string };
    } | null;
  };
}

const API_BASE_URL = env.apiBaseUrl;
let accessToken: string | null = null;
let apiLanguage: LanguageCode = "en";

export function isMoneyPulseApiError(error: unknown): error is MoneyPulseApiError {
  return error instanceof MoneyPulseApiError;
}

export function isAuthenticationError(error: unknown): error is MoneyPulseApiError {
  return isMoneyPulseApiError(error) && error.statusCode === 401;
}

export function isNetworkUnavailableError(error: unknown): error is MoneyPulseApiError {
  return isMoneyPulseApiError(error) && error.code === "network_unavailable";
}

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setApiLanguage(language: LanguageCode) {
  apiLanguage = language;
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
        "Accept-Language": apiLanguage,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {})
      },
      body: body as BodyInit | null | undefined
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const apiLocation = API_BASE_URL || "the current web origin";
      const offline =
        typeof navigator !== "undefined" && "onLine" in navigator && navigator.onLine === false;
      throw new MoneyPulseApiError({
        code: "network_unavailable",
        message: offline
          ? "Your device appears to be offline. Reconnect to keep MoneyPulse in sync."
          : `MoneyPulse could not reach the API at ${apiLocation}. Check the backend URL or local proxy configuration.`,
        details: {
          apiBaseUrl: API_BASE_URL || null,
          offline
        }
      });
    }

    throw error;
  }

  if (!response.ok) {
    let parsedMessage: string | null = null;
    let parsedCode: string | null = null;
    let parsedDetails: unknown;
    const responseClone = response.clone();

    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
        detail?: string;
      };
      parsedCode = payload.error?.code ?? null;
      parsedMessage = payload.error?.message ?? payload.detail ?? null;
      parsedDetails = payload.error?.details;
    } catch {
      const fallbackText = await responseClone.text();
      parsedMessage = fallbackText || null;
    }

    throw new MoneyPulseApiError({
      code: parsedCode ?? `http_${response.status}`,
      details: parsedDetails,
      message: parsedMessage || `Request failed with status ${response.status}.`,
      statusCode: response.status
    });
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
  startBankConnection(payload: BankConnectStartInput) {
    return request<BankConnectStartResponse>("/bank/connect/start", {
      method: "POST",
      body: payload
    });
  },
  completeBankConnection(payload: BankConnectCompleteInput) {
    return request<BankConnection>("/bank/connect/complete", {
      method: "POST",
      body: payload
    });
  },
  listBankConnections() {
    return request<BankConnection[]>("/bank/connections");
  },
  deleteBankConnection(connectionId: number) {
    return request<void>(`/bank/connections/${connectionId}`, {
      method: "DELETE"
    });
  },
  syncBankConnections(payload: BankSyncInput = {}) {
    return request<BankSyncResponse>("/bank/sync", {
      method: "POST",
      body: payload
    });
  },
  getToday() {
    return request<TodayResponse>("/today");
  },
  getFinancialData() {
    return request<FinancialDataResponse>("/financial-data");
  },
  getFinancialProfile() {
    return request<FinancialProfile>("/financial-profile");
  },
  updateFinancialProfile(payload: FinancialProfileUpdateInput) {
    return request<FinancialProfile>("/financial-profile", {
      method: "PUT",
      body: payload
    });
  },
  getOnboarding() {
    return request<OnboardingSummary>("/onboarding");
  },
  startOnboarding() {
    return request<OnboardingSummary>("/onboarding", {
      method: "POST"
    });
  },
  updateOnboarding(payload: OnboardingUpdateInput) {
    return request<OnboardingSummary>("/onboarding", {
      method: "PATCH",
      body: payload
    });
  },
  completeOnboarding() {
    return request<OnboardingSummary>("/onboarding/complete", {
      method: "POST"
    });
  },
  listCategories() {
    return request<Category[]>("/categories");
  },
  listBudgets() {
    return request<Budget[]>("/budgets");
  },
  createBudget(payload: BudgetCreateInput) {
    return request<Budget>("/budgets", {
      method: "POST",
      body: payload
    });
  },
  updateBudget(budgetId: number, payload: BudgetUpdateInput) {
    return request<Budget>(`/budgets/${budgetId}`, {
      method: "PATCH",
      body: payload
    });
  },
  deleteBudget(budgetId: number) {
    return request<void>(`/budgets/${budgetId}`, {
      method: "DELETE"
    });
  },
  getCoachTodaySummary() {
    return request<CoachTodaySummary>("/coach/today-summary");
  },
  getCoachWeeklySummary() {
    return request<CoachWeeklySummary>("/coach/weekly-summary");
  },
  explainCoachDecision(payload: BeforeYouBuyInput) {
    return request<CoachDecisionExplanation>("/coach/explain-decision", {
      method: "POST",
      body: payload
    });
  },
  chatCopilot(payload: CopilotChatInput) {
    return request<CopilotChatResponse>("/api/copilot/chat", {
      method: "POST",
      body: payload
    });
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
    return request<TransactionListResponse>("/transactions");
  },
  categorizeTransactions(items: TransactionCategorizationInputRow[]) {
    return request<TransactionCategorizationResponse>("/transactions/categorize", {
      method: "POST",
      body: { items }
    });
  },
  createTransaction(payload: TransactionCreateInput) {
    return request<Transaction>("/transactions", {
      method: "POST",
      body: payload
    });
  },
  updateTransaction(transactionId: number, payload: TransactionUpdateInput) {
    return request<Transaction>(`/transactions/${transactionId}`, {
      method: "PATCH",
      body: payload
    });
  },
  submitTransactionCategorizationFeedback(
    transactionId: number,
    payload: TransactionCategorizationFeedbackInput
  ) {
    return request<Transaction>(`/transactions/${transactionId}/categorization-feedback`, {
      method: "POST",
      body: payload
    });
  },
  recategorizeTransactions(payload: TransactionRecategorizeRequest = {}) {
    return request<TransactionRecategorizeResponse>("/transactions/recategorize", {
      method: "POST",
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
      method: "PATCH",
      body: payload
    });
  },
  deleteGoal(goalId: number) {
    return request<void>(`/goals/${goalId}`, {
      method: "DELETE"
    });
  },
  listRecurringEvents() {
    return request<RecurringEvent[]>("/recurring-items");
  },
  createRecurringEvent(payload: RecurringEventCreateInput) {
    return request<RecurringEvent>("/recurring-items", {
      method: "POST",
      body: payload
    });
  },
  updateRecurringEvent(
    recurringEventId: number,
    payload: RecurringEventUpdateInput
  ) {
    return request<RecurringEvent>(`/recurring-items/${recurringEventId}`, {
      method: "PATCH",
      body: payload
    });
  },
  deleteRecurringEvent(recurringEventId: number) {
    return request<void>(`/recurring-items/${recurringEventId}`, {
      method: "DELETE"
    });
  }
};
