export interface MoneyAmount {
  amount: number;
  currency: string;
}

export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export interface FinancialProfile {
  salaryDay: number | null;
  protectedBalance: MoneyAmount;
  riskProfile: RiskProfile;
  today?: string;
}

export interface Account {
  id?: number | string;
  name: string;
  balance: MoneyAmount;
  source?: string;
}

export type TransactionType =
  | "INCOME"
  | "FIXED_EXPENSE"
  | "DISCRETIONARY_EXPENSE"
  | "GOAL_CONTRIBUTION";

export interface Transaction {
  id?: number | string;
  name: string;
  amount: MoneyAmount;
  type: TransactionType;
  effectiveDate: string;
  category?: string;
  confirmed?: boolean;
  source?: string;
}

export type RecurringCadence = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RecurringItem {
  id?: number | string;
  name: string;
  amount: MoneyAmount;
  type: Exclude<TransactionType, "GOAL_CONTRIBUTION">;
  cadence: RecurringCadence;
  startDate: string;
  active: boolean;
  category?: string;
  confirmed?: boolean;
  source?: string;
}

export interface Budget {
  category: string;
  limit: MoneyAmount;
  spent?: MoneyAmount;
}

export type GoalPriority = "ESSENTIAL" | "IMPORTANT" | "FLEXIBLE";

export interface Goal {
  id?: number | string;
  name: string;
  targetAmount: MoneyAmount;
  plannedContribution: MoneyAmount;
  reservedAmount: MoneyAmount;
  priority: GoalPriority;
  dueDate?: string;
  active?: boolean;
  kind?: "GOAL" | "SAFETY_BUFFER";
}

export interface FinancialCycle {
  strategy: "SALARY_CYCLE" | "CALENDAR_MONTH";
  salaryDay: number | null;
  cycleStart: string;
  cycleEnd: string;
  nextCycleStart: string;
  anchorDate: string;
}

export type BudgetHealth = "HEALTHY" | "NEAR_LIMIT" | "OVER_LIMIT";

export interface BudgetStatusItem {
  category: string;
  limit: MoneyAmount;
  spent: MoneyAmount;
  remaining: MoneyAmount;
  utilization: number;
  health: BudgetHealth;
}

export interface BudgetStatus {
  overall: BudgetHealth;
  items: BudgetStatusItem[];
  nearLimitCount: number;
  overLimitCount: number;
}

export interface GoalStatusItem {
  id?: number | string;
  name: string;
  priority: GoalPriority;
  targetAmount: MoneyAmount;
  plannedContribution: MoneyAmount;
  reservedAmount: MoneyAmount;
  requiredThisCycle: MoneyAmount;
  covered: boolean;
  deferred: boolean;
}

export interface GoalStatus {
  items: GoalStatusItem[];
  totalRequiredThisCycle: MoneyAmount;
  remainingThisCycle: MoneyAmount;
  essentialCovered: boolean;
  importantCovered: boolean;
  flexibleDeferred: boolean;
}

export interface FinancialSnapshot {
  cycleStart: string;
  cycleEnd: string;
  totalBalance: MoneyAmount;
  protectedBalance: MoneyAmount;
  availableBalance: MoneyAmount;
  cycleIncome: MoneyAmount;
  cycleSpent: MoneyAmount;
  fixedExpensesRemaining: MoneyAmount;
  goalsRemaining: MoneyAmount;
  realAvailabilityNow: MoneyAmount;
  projectedAvailability: MoneyAmount;
  daysRemainingInCycle: number;
  safeDailySpend: MoneyAmount;
  budgetStatus: BudgetStatus;
  goalStatus: GoalStatus;
  generatedAt: string;
  cycle: FinancialCycle;
}

export type RiskLevel = "GREEN" | "YELLOW" | "RED" | "BLACK";

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  protectedBalanceBreached: boolean;
  essentialGoalsCovered: boolean;
  importantGoalsCovered: boolean;
  flexibleGoalsDelayed: boolean;
  safeDailySpendHealthy: boolean;
  budgetNearLimit: boolean;
  budgetOverLimit: boolean;
  confidence: number;
}

export interface EngineDecision {
  level: RiskLevel;
  status: "ALLOW" | "ALLOW_WITH_CAUTION" | "NOT_RECOMMENDED" | "BLOCKED";
  label: string;
  reasons: string[];
  suggestedAction: string;
  confidence: number;
}

export interface InstallmentPlan {
  count: number;
  amount?: MoneyAmount;
  cadence?: "MONTHLY";
  startDate?: string;
}

export interface FutureCommitment {
  dueDate: string;
  amount: MoneyAmount;
  label: string;
  type: "INSTALLMENT";
}

export interface AffordabilityInput {
  profile: FinancialProfile;
  accounts: Account[];
  transactions: Transaction[];
  recurringItems: RecurringItem[];
  budgets: Budget[];
  goals: Goal[];
  purchaseAmount: MoneyAmount;
  purchaseDate?: string;
  description?: string;
  category?: string;
  installments?: InstallmentPlan;
}

export interface AffordabilityResult {
  snapshotBefore: FinancialSnapshot;
  snapshotAfter: FinancialSnapshot;
  riskBefore: RiskAssessment;
  riskAfter: RiskAssessment;
  purchaseAmount: MoneyAmount;
  currentCycleImpact: MoneyAmount;
  futureCommitments: FutureCommitment[];
  decision: EngineDecision;
}

export interface ForecastCheckpoint {
  date: string;
  label: string;
  amount: MoneyAmount;
  kind: "TRANSACTION" | "RECURRING" | "INSTALLMENT";
  type: TransactionType;
}

export interface ForecastResult {
  cycle: FinancialCycle;
  snapshot: FinancialSnapshot;
  nextCheckpoint: ForecastCheckpoint | null;
  checkpoints: ForecastCheckpoint[];
  futureCommitments: FutureCommitment[];
}

export interface MoneySummary {
  currency: string;
  totalBalance: MoneyAmount;
  totalIncome: MoneyAmount;
  totalExpenses: MoneyAmount;
  activeRecurring: number;
}

export interface GoalSummary {
  currency: string;
  totalTargets: MoneyAmount;
  totalReserved: MoneyAmount;
  totalPlanned: MoneyAmount;
}
