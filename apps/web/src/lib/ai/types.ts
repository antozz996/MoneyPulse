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

export type CopilotProviderId = "mock" | "openai";

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

export interface SnapshotToolResult {
  snapshot: FinancialSnapshot;
  risk: RiskAssessment;
  decision: EngineDecision;
  summary: string[];
}

export interface AffordabilityToolResult {
  affordability: AffordabilityResult;
  summary: string[];
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
}

export interface GoalAnalysisResult {
  snapshot: FinancialSnapshot;
  goalStatus: GoalStatus;
  essentialCovered: boolean;
  importantCovered: boolean;
  flexibleDeferred: boolean;
}

export interface ForecastCheckResult {
  forecast: ForecastResult;
  decision: EngineDecision;
}

export interface SurvivalPlanResult {
  snapshot: FinancialSnapshot;
  decision: EngineDecision;
  safeDailySpend: MoneyAmount;
  daysRemainingInCycle: number;
  steps: string[];
  nextCheckpoint:
    | {
        date: string;
        label: string;
        amount: MoneyAmount;
      }
    | null;
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
