import type {
  Account,
  AffordabilityInput,
  AffordabilityResult,
  Budget,
  EngineDecision,
  FinancialProfile,
  FinancialSnapshot,
  ForecastResult,
  Goal,
  GoalStatus,
  MoneyAmount,
  RecurringItem,
  RiskAssessment,
  RiskProfile,
  Transaction
} from "../engine";

export type CopilotIntent =
  | "health_check"
  | "affordability_check"
  | "budget_analysis"
  | "goal_analysis"
  | "forecast_check"
  | "survival_plan"
  | "unknown";

export type CopilotProviderId = "mock" | "remote" | "openai";

export interface CopilotEntities {
  amount?: number;
  currency?: string;
}

export interface IntentClassification {
  intent: CopilotIntent;
  confidence: number;
  entities: CopilotEntities;
}

export interface CopilotEngineInput {
  profile: FinancialProfile;
  accounts: Account[];
  transactions: Transaction[];
  recurringItems: RecurringItem[];
  budgets: Budget[];
  goals: Goal[];
}

export type MissingDataWarningCode =
  | "missing_salary_day"
  | "missing_protected_balance"
  | "no_goals_configured"
  | "no_budgets_configured"
  | "no_transaction_history";

export interface MissingDataWarning {
  code: MissingDataWarningCode;
  message: string;
}

export interface GroundedToolOutput<TNumbers extends Record<string, unknown>> {
  keyNumbers: TNumbers;
  riskLevel: EngineDecision["level"];
  reasons: string[];
  suggestedAction: string;
  missingDataWarnings: MissingDataWarning[];
}

export interface SnapshotToolResult {
  snapshot: FinancialSnapshot;
  risk: RiskAssessment;
  decision: EngineDecision;
  summary: string[];
  grounding: GroundedToolOutput<{
    realAvailabilityNow: MoneyAmount;
    projectedAvailability: MoneyAmount;
    safeDailySpend: MoneyAmount;
    protectedBalance: MoneyAmount;
    fixedExpensesRemaining: MoneyAmount;
    goalsRemaining: MoneyAmount;
    daysRemainingInCycle: number;
  }>;
}

export interface AffordabilityToolResult {
  affordability: AffordabilityResult;
  summary: string[];
  grounding: GroundedToolOutput<{
    availabilityBefore: MoneyAmount;
    availabilityAfter: MoneyAmount;
    safeDailySpendBefore: MoneyAmount;
    safeDailySpendAfter: MoneyAmount;
    currentCycleImpact: MoneyAmount;
    futureCommitmentTotal: MoneyAmount;
    protectedBalance: MoneyAmount;
    protectedBalanceBreached: boolean;
  }> & {
    suggestedAlternative?: string;
  };
}

export interface BudgetAnalysisResult {
  snapshot: FinancialSnapshot;
  overall: "HEALTHY" | "NEAR_LIMIT" | "OVER_LIMIT";
  nearLimitCategories: string[];
  overLimitCategories: string[];
  remainingByCategory: Array<{
    category: string;
    remaining: MoneyAmount;
  }>;
  grounding: GroundedToolOutput<{
    realAvailabilityNow: MoneyAmount;
    safeDailySpend: MoneyAmount;
    budgetCount: number;
    nearLimitCount: number;
    overLimitCount: number;
  }> & {
    categoriesToReduce: string[];
  };
}

export interface GoalAnalysisResult {
  snapshot: FinancialSnapshot;
  goalStatus: GoalStatus;
  essentialCovered: boolean;
  importantCovered: boolean;
  flexibleDeferred: boolean;
  grounding: GroundedToolOutput<{
    remainingThisCycle: MoneyAmount;
    essentialGoalCount: number;
    importantGoalCount: number;
    flexibleGoalCount: number;
  }> & {
    goalsToProtect: string[];
  };
}

export interface ForecastCheckResult {
  forecast: ForecastResult;
  decision: EngineDecision;
  grounding: GroundedToolOutput<{
    realAvailabilityNow: MoneyAmount;
    projectedAvailability: MoneyAmount;
    safeDailySpend: MoneyAmount;
    fixedExpensesRemaining: MoneyAmount;
    nextCheckpointDate: string | null;
  }>;
}

export interface SurvivalPlanResult {
  snapshot: FinancialSnapshot;
  decision: EngineDecision;
  safeDailySpend: MoneyAmount;
  daysRemainingInCycle: number;
  steps: string[];
  categoriesToReduce: string[];
  fixedExpensesStillComing: Array<{
    label: string;
    date: string;
    amount: MoneyAmount;
  }>;
  goalsToProtect: string[];
  whatNotToTouch: string[];
  nextCheckpoint:
    | {
        date: string;
        label: string;
        amount: MoneyAmount;
      }
    | null;
  grounding: GroundedToolOutput<{
    realAvailabilityNow: MoneyAmount;
    safeDailySpend: MoneyAmount;
    fixedExpensesRemaining: MoneyAmount;
    goalsRemaining: MoneyAmount;
    nextCheckpointDate: string | null;
  }>;
}

export interface CopilotContextInput extends CopilotEngineInput {
  locale: string;
  currency: string;
  recentDecision?: AffordabilityResult | null;
}

export interface CopilotContext {
  locale: string;
  currency: string;
  riskProfile: RiskProfile;
  snapshotSummary: {
    cycleStart: string;
    cycleEnd: string;
    realAvailabilityNow: MoneyAmount;
    projectedAvailability: MoneyAmount;
    safeDailySpend: MoneyAmount;
    decisionLevel: EngineDecision["level"];
  };
  budgetSummary: {
    overall: "HEALTHY" | "NEAR_LIMIT" | "OVER_LIMIT";
    overLimitCategories: string[];
    nearLimitCategories: string[];
  };
  goalSummary: {
    essentialCovered: boolean;
    importantCovered: boolean;
    flexibleDeferred: boolean;
    remainingThisCycle: MoneyAmount;
  };
  recentDecisionSummary?: {
    level: EngineDecision["level"];
    status: EngineDecision["status"];
    purchaseAmount: MoneyAmount;
    remainingAfterPurchase: MoneyAmount;
  };
}

export interface CopilotPromptPayload {
  systemPrompt: string;
  context: CopilotContext;
}

export interface CopilotConversationMessage {
  role: "assistant" | "user";
  text: string;
}

export interface CopilotReply {
  provider: CopilotProviderId;
  modelVersion: string;
  fallbackUsed?: boolean;
  model?: string | null;
  intent: CopilotIntent;
  answer: string;
  classification: IntentClassification;
  context: CopilotContext;
}

export interface CopilotProviderRequest extends CopilotContextInput {
  message: string;
  context: CopilotContext;
  history: CopilotConversationMessage[];
  tools: CopilotToolbox;
}

export interface MockCopilotRequest extends CopilotContextInput {
  message: string;
}

export type MockCopilotResponse = CopilotReply;

export interface CopilotProvider {
  id: CopilotProviderId;
  generateCopilotReply: (input: CopilotProviderRequest) => Promise<CopilotReply>;
}

export interface CopilotServiceRequest extends CopilotContextInput {
  message: string;
  history?: CopilotConversationMessage[];
}

export interface CopilotServiceConfig {
  provider: CopilotProviderId;
  enableLiveProvider: boolean;
  backendPath?: string | null;
}

export type CopilotToolbox = {
  getFinancialSnapshot: (input: CopilotEngineInput) => SnapshotToolResult;
  simulatePurchase: (input: AffordabilityInput) => AffordabilityToolResult;
  analyzeBudgets: (input: CopilotEngineInput) => BudgetAnalysisResult;
  analyzeGoals: (input: CopilotEngineInput) => GoalAnalysisResult;
  forecastCycleEnd: (input: CopilotEngineInput) => ForecastCheckResult;
  generateSurvivalPlan: (input: CopilotEngineInput) => SurvivalPlanResult;
};
