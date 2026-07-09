import {
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction
} from "react";
import { Card } from "@moneypulse/ui";

import {
  api,
  isAuthenticationError,
  isMoneyPulseApiError,
  isNetworkUnavailableError,
  type Account,
  type AuthSession,
  type BankConnection,
  type BeforeYouBuyResponse,
  type CoachDecisionExplanation,
  type CoachTodaySummary,
  type CoachWeeklySummary,
  type Goal,
  type GoalKind,
  type RecurringEvent,
  type RecurringEventCadence,
  type TodayResponse,
  type Transaction,
  type TransactionCategory,
  type TransactionDirection
} from "./lib/api";
import { env } from "./lib/env";
import {
  buildForecast,
  createMoneyAmount,
  listTransactionsForDate,
  simulatePurchase,
  summarizeGoals as summarizeEngineGoals,
  summarizeMoney,
  type FinancialProfile,
  type Goal as EngineGoal,
  type RecurringItem as EngineRecurringItem,
  type Transaction as EngineTransaction,
  type AffordabilityResult,
  type FinancialSnapshot
} from "./lib/engine";
import { supportedLanguages, useI18n } from "./lib/i18n";
import {
  buildDecisionCoachContent,
  buildDecisionCoachContentFromEngine,
  buildPurchaseExplanations,
  buildPurchaseExplanationsFromEngine,
  buildTodayCoachContentFromEngine,
  buildTodayExplanations,
  buildWeeklyCoachContent
} from "./lib/localized-copy";
import { clearSession, loadSession, persistSession, syncApiSession } from "./lib/session";

type Screen = "today" | "buy" | "money" | "goals" | "insights";
type AuthMode = "register" | "login";
type AsyncState = "idle" | "loading" | "success" | "error";

interface FormStatus {
  state: AsyncState;
  message: string | null;
}

interface ScheduledCheckpoint {
  date: string;
  amount: number;
  currency: string;
  label: string;
}

interface CoachNarrativeView {
  source: "deterministic" | "llm";
  modelVersion: string;
  summary: string;
  why: string[];
  whatChanged: string[];
  nextSteps: string[];
}

const navItems: Array<{ id: Screen; icon: string }> = [
  { id: "today", icon: "◉" },
  { id: "buy", icon: "◎" },
  { id: "money", icon: "◌" },
  { id: "goals", icon: "◍" },
  { id: "insights", icon: "◐" }
];

const defaultCurrency = env.defaultCurrency;

const initialAccountForm = {
  name: "",
  balance: "",
  currency: defaultCurrency
};

const initialTransactionForm = {
  name: "",
  amount: "",
  currency: defaultCurrency,
  direction: "expense" as TransactionDirection,
  category: "essential" as TransactionCategory,
  effectiveDate: new Date().toISOString().slice(0, 10)
};

const initialRecurringEventForm = {
  name: "",
  amount: "",
  currency: defaultCurrency,
  direction: "expense" as TransactionDirection,
  category: "committed" as TransactionCategory,
  cadence: "monthly" as RecurringEventCadence,
  startDate: new Date().toISOString().slice(0, 10),
  active: true
};

const initialGoalForm = {
  name: "",
  targetAmount: "",
  plannedContribution: "",
  reservedAmount: "",
  currency: defaultCurrency,
  kind: "goal" as GoalKind
};

const initialBuyForm = {
  description: "",
  amount: "",
  currency: defaultCurrency
};

const initialAuthForm = {
  name: "",
  email: "",
  password: ""
};

function screenFromHash(hash: string): Screen {
  const normalizedHash = hash.replace("#", "");

  return navItems.some((item) => item.id === normalizedHash)
    ? (normalizedHash as Screen)
    : "today";
}

function toEngineProfile(options: {
  todayDate: string;
  currency: string;
  protectedBalanceAmount: number;
}): FinancialProfile {
  return {
    salaryDay: null,
    protectedBalance: createMoneyAmount(
      options.protectedBalanceAmount,
      options.currency
    ),
    riskProfile: "BALANCED",
    today: options.todayDate
  };
}

function toEngineTransaction(transaction: Transaction): EngineTransaction {
  return {
    id: transaction.id,
    name: transaction.name,
    amount: createMoneyAmount(transaction.amount, transaction.currency),
    type:
      transaction.direction === "income"
        ? "INCOME"
        : transaction.category === "essential"
          ? "FIXED_EXPENSE"
          : "DISCRETIONARY_EXPENSE",
    effectiveDate: transaction.effective_date,
    category: transaction.category ?? undefined,
    confirmed: true,
    source: transaction.source
  };
}

function toEngineRecurringItem(recurringEvent: RecurringEvent): EngineRecurringItem {
  return {
    id: recurringEvent.id,
    name: recurringEvent.name,
    amount: createMoneyAmount(recurringEvent.amount, recurringEvent.currency),
    type:
      recurringEvent.direction === "income"
        ? "INCOME"
        : recurringEvent.category === "essential"
          ? "FIXED_EXPENSE"
          : "DISCRETIONARY_EXPENSE",
    cadence: recurringEvent.cadence.toUpperCase() as EngineRecurringItem["cadence"],
    startDate: recurringEvent.start_date,
    active: recurringEvent.active,
    category: recurringEvent.category ?? undefined,
    confirmed: true,
    source: "manual"
  };
}

function toEngineGoal(goal: Goal): EngineGoal {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: createMoneyAmount(goal.target_amount, goal.currency),
    plannedContribution: createMoneyAmount(goal.planned_contribution, goal.currency),
    reservedAmount: createMoneyAmount(goal.reserved_amount, goal.currency),
    priority: goal.kind === "safety_buffer" ? "ESSENTIAL" : "IMPORTANT",
    active: true,
    kind: goal.kind === "safety_buffer" ? "SAFETY_BUFFER" : "GOAL"
  };
}

export default function App() {
  const { t } = useI18n();
  const [activeScreen, setActiveScreen] = useState<Screen>(() => {
    return screenFromHash(window.location.hash);
  });

  const [todayState, setTodayState] = useState<AsyncState>("loading");
  const [accountsState, setAccountsState] = useState<AsyncState>("loading");
  const [transactionsState, setTransactionsState] = useState<AsyncState>("loading");
  const [recurringEventsState, setRecurringEventsState] = useState<AsyncState>("loading");
  const [goalsState, setGoalsState] = useState<AsyncState>("loading");
  const [bankConnectionsState, setBankConnectionsState] = useState<AsyncState>("loading");
  const [todayCoachState, setTodayCoachState] = useState<AsyncState>("idle");
  const [weeklyCoachState, setWeeklyCoachState] = useState<AsyncState>("idle");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
  const [todayCoach, setTodayCoach] = useState<CoachTodaySummary | null>(null);
  const [weeklyCoach, setWeeklyCoach] = useState<CoachWeeklySummary | null>(null);
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authStatus, setAuthStatus] = useState<FormStatus>({ state: "idle", message: null });

  const [buyStatus, setBuyStatus] = useState<FormStatus>({ state: "idle", message: null });
  const [accountStatus, setAccountStatus] = useState<FormStatus>({
    state: "idle",
    message: null
  });
  const [transactionStatus, setTransactionStatus] = useState<FormStatus>({
    state: "idle",
    message: null
  });
  const [recurringEventStatus, setRecurringEventStatus] = useState<FormStatus>({
    state: "idle",
    message: null
  });
  const [goalStatus, setGoalStatus] = useState<FormStatus>({ state: "idle", message: null });
  const [bankSyncStatus, setBankSyncStatus] = useState<FormStatus>({
    state: "idle",
    message: null
  });
  const [buyCoachStatus, setBuyCoachStatus] = useState<FormStatus>({
    state: "idle",
    message: null
  });

  const [buyResult, setBuyResult] = useState<BeforeYouBuyResponse | null>(null);
  const [buyCoach, setBuyCoach] = useState<CoachDecisionExplanation | null>(null);
  const [todayCoachError, setTodayCoachError] = useState<string | null>(null);
  const [weeklyCoachError, setWeeklyCoachError] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState(initialAccountForm);
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [recurringEventForm, setRecurringEventForm] = useState(initialRecurringEventForm);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [buyForm, setBuyForm] = useState(initialBuyForm);
  const [authForm, setAuthForm] = useState(initialAuthForm);

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editingRecurringEventId, setEditingRecurringEventId] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  function resetDataState() {
    setToday(null);
    setAccounts([]);
    setTransactions([]);
    setRecurringEvents([]);
    setGoals([]);
    setBankConnections([]);
    setTodayCoach(null);
    setWeeklyCoach(null);
    setLoadError(null);
    setTodayCoachError(null);
    setWeeklyCoachError(null);
    setTodayState("idle");
    setAccountsState("idle");
    setTransactionsState("idle");
    setRecurringEventsState("idle");
    setGoalsState("idle");
    setBankConnectionsState("idle");
    setTodayCoachState("idle");
    setWeeklyCoachState("idle");
    setBuyResult(null);
    setBuyCoach(null);
  }

  function applyAuthenticatedSession(nextSession: AuthSession) {
    persistSession(nextSession);
    setSession(nextSession);
    setAuthForm(initialAuthForm);
    setAuthStatus({ state: "success", message: null });
  }

  async function handleLogout(options?: { remote?: boolean }) {
    if (options?.remote !== false && session) {
      try {
        await api.logout();
      } catch {
        // Logout still clears the local session if the token is already invalid.
      }
    }

    clearSession();
    setSession(null);
    resetDataState();
    setAccountStatus({ state: "idle", message: null });
    setTransactionStatus({ state: "idle", message: null });
    setRecurringEventStatus({ state: "idle", message: null });
    setGoalStatus({ state: "idle", message: null });
    setBuyStatus({ state: "idle", message: null });
    setBankSyncStatus({ state: "idle", message: null });
    setBuyCoachStatus({ state: "idle", message: null });
    setAuthMode("login");
  }

  function getUserFacingError(error: unknown, fallbackKey: string): string {
    if (isNetworkUnavailableError(error)) {
      return error.details &&
        typeof error.details === "object" &&
        "offline" in error.details &&
        (error.details as { offline?: boolean }).offline
        ? t("errors.networkOffline")
        : t("errors.networkUnavailable");
    }

    if (isMoneyPulseApiError(error)) {
      switch (error.code) {
        case "authentication_error":
          return t("errors.unauthorized");
        case "validation_error":
          return t("errors.validation");
        case "conflict":
          return t("errors.conflict");
        case "rate_limit_exceeded":
          return t("errors.rateLimit");
        case "not_found":
          return t("errors.notFound");
        default:
          return t("errors.generic");
      }
    }

    return t(fallbackKey as never);
  }

  async function handleUnauthorizedState(error: unknown): Promise<boolean> {
    if (!isAuthenticationError(error)) {
      return false;
    }

    await handleLogout({ remote: false });
    setAuthStatus({
      state: "error",
      message: t("auth.sessionExpired")
    });
    return true;
  }

  async function handleAuthenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthStatus({ state: "loading", message: null });

    try {
      const nextSession =
        authMode === "register"
          ? await api.register({
              name: authForm.name.trim(),
              email: authForm.email.trim().toLowerCase(),
              password: authForm.password
            })
          : await api.login({
              email: authForm.email.trim().toLowerCase(),
              password: authForm.password
            });

      applyAuthenticatedSession(nextSession);
    } catch (error) {
      setAuthStatus({
        state: "error",
        message: getUserFacingError(error, "auth.signInError")
      });
    }
  }

  async function loadAllData(): Promise<void> {
    if (!session) {
      resetDataState();
      return;
    }

    setTodayState("loading");
    setAccountsState("loading");
    setTransactionsState("loading");
    setRecurringEventsState("loading");
    setGoalsState("loading");
    setBankConnectionsState("loading");
    setLoadError(null);

    try {
      const [
        todayResponse,
        accountsResponse,
        transactionsResponse,
        recurringEventsResponse,
        goalsResponse,
        bankConnectionsResponse
      ] = await Promise.all([
        api.getToday(),
        api.listAccounts(),
        api.listTransactions(),
        api.listRecurringEvents(),
        api.listGoals(),
        api.listBankConnections()
      ]);

      setToday(todayResponse);
      setAccounts(accountsResponse);
      setTransactions(transactionsResponse);
      setRecurringEvents(recurringEventsResponse);
      setGoals(goalsResponse);
      setBankConnections(bankConnectionsResponse);

      setTodayState("success");
      setAccountsState("success");
      setTransactionsState("success");
      setRecurringEventsState("success");
      setGoalsState("success");
      setBankConnectionsState("success");

      const nextHasFinancialContext =
        accountsResponse.length > 0 ||
        transactionsResponse.length > 0 ||
        recurringEventsResponse.length > 0 ||
        goalsResponse.length > 0;

      await loadCoachSummaries(nextHasFinancialContext);
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setLoadError(getUserFacingError(error, "errors.loadApp"));
      setTodayState("error");
      setAccountsState("error");
      setTransactionsState("error");
      setRecurringEventsState("error");
      setGoalsState("error");
      setBankConnectionsState("error");
      setTodayCoachState("idle");
      setWeeklyCoachState("idle");
    }
  }

  async function loadCoachSummaries(hasContext: boolean): Promise<void> {
    if (!hasContext) {
      setTodayCoach(null);
      setWeeklyCoach(null);
      setTodayCoachError(null);
      setWeeklyCoachError(null);
      setTodayCoachState("idle");
      setWeeklyCoachState("idle");
      return;
    }

    setTodayCoachState("loading");
    setWeeklyCoachState("loading");
    setTodayCoachError(null);
    setWeeklyCoachError(null);

    const [todayCoachResult, weeklyCoachResult] = await Promise.allSettled([
      api.getCoachTodaySummary(),
      api.getCoachWeeklySummary()
    ]);

    if (todayCoachResult.status === "fulfilled") {
      setTodayCoach(todayCoachResult.value);
      setTodayCoachState("success");
    } else {
      setTodayCoach(null);
      setTodayCoachError(
        todayCoachResult.reason instanceof Error
          ? getUserFacingError(todayCoachResult.reason, "errors.generic")
          : t("coach.genericError")
      );
      setTodayCoachState("error");
    }

    if (weeklyCoachResult.status === "fulfilled") {
      setWeeklyCoach(weeklyCoachResult.value);
      setWeeklyCoachState("success");
    } else {
      setWeeklyCoach(null);
      setWeeklyCoachError(
        weeklyCoachResult.reason instanceof Error
          ? getUserFacingError(weeklyCoachResult.reason, "errors.generic")
          : t("coach.genericError")
      );
      setWeeklyCoachState("error");
    }
  }

  useEffect(() => {
    syncApiSession(session);

    if (session) {
      void loadAllData();
    } else {
      resetDataState();
    }
  }, [session]);

  useEffect(() => {
    window.location.hash = activeScreen;
  }, [activeScreen]);

  useEffect(() => {
    function handleHashChange() {
      const nextScreen = screenFromHash(window.location.hash);
      setActiveScreen((current) => (current === nextScreen ? current : nextScreen));
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const hasFinancialContext =
    accounts.length > 0 ||
    transactions.length > 0 ||
    recurringEvents.length > 0 ||
    goals.length > 0;
  const todayDate = new Date().toISOString().slice(0, 10);
  const financialCurrency =
    today?.currency ?? accounts[0]?.currency ?? goals[0]?.currency ?? defaultCurrency;
  const protectedBalanceAmount =
    today?.inputs.safety_buffer ??
    goals
      .filter((goal) => goal.kind === "safety_buffer")
      .reduce((sum, goal) => sum + goal.reserved_amount, 0);
  const engineProfile = toEngineProfile({
    todayDate,
    currency: financialCurrency,
    protectedBalanceAmount
  });
  const engineAccounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    balance: createMoneyAmount(account.balance, account.currency),
    source: account.source
  }));
  const engineTransactions = transactions.map(toEngineTransaction);
  const engineRecurringItems = recurringEvents.map(toEngineRecurringItem);
  const engineGoals = goals.map(toEngineGoal);
  const engineForecast = hasFinancialContext
    ? buildForecast({
        profile: engineProfile,
        accounts: engineAccounts,
        transactions: engineTransactions,
        recurringItems: engineRecurringItems,
        budgets: [],
        goals: engineGoals
      })
    : null;
  const moneySummarySnapshot = summarizeMoney(
    engineAccounts,
    engineTransactions,
    engineRecurringItems,
    financialCurrency
  );
  const moneySummary = {
    currency: moneySummarySnapshot.currency,
    totalBalance: moneySummarySnapshot.totalBalance.amount,
    totalIncome: moneySummarySnapshot.totalIncome.amount,
    totalExpenses: moneySummarySnapshot.totalExpenses.amount,
    activeRecurring: moneySummarySnapshot.activeRecurring
  };
  const goalSummarySnapshot = summarizeEngineGoals(engineGoals, financialCurrency);
  const goalSummary = {
    currency: goalSummarySnapshot.currency,
    totalTargets: goalSummarySnapshot.totalTargets.amount,
    totalReserved: goalSummarySnapshot.totalReserved.amount,
    totalPlanned: goalSummarySnapshot.totalPlanned.amount
  };
  const todayTransactionKeys = new Set(
    listTransactionsForDate(engineTransactions, todayDate).map((transaction) =>
      String(transaction.id ?? `${transaction.name}:${transaction.effectiveDate}`)
    )
  );
  const todaysTransactions = transactions.filter((transaction) =>
    todayTransactionKeys.has(
      String(transaction.id ?? `${transaction.name}:${transaction.effective_date}`)
    )
  );
  const nextCheckpoint = engineForecast?.nextCheckpoint
    ? {
        date: engineForecast.nextCheckpoint.date,
        amount: engineForecast.nextCheckpoint.amount.amount,
        currency: engineForecast.nextCheckpoint.amount.currency,
        label: engineForecast.nextCheckpoint.label
      }
    : null;
  const parsedBuyAmount = Number(buyForm.amount);
  const engineAffordability =
    hasFinancialContext && buyResult && Number.isFinite(parsedBuyAmount) && parsedBuyAmount > 0
      ? simulatePurchase({
          profile: engineProfile,
          accounts: engineAccounts,
          transactions: engineTransactions,
          recurringItems: engineRecurringItems,
          budgets: [],
          goals: engineGoals,
          purchaseAmount: createMoneyAmount(
            parsedBuyAmount,
            buyForm.currency.trim() || financialCurrency
          ),
          description: buyForm.description.trim() || undefined
        })
      : null;

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountStatus({ state: "loading", message: null });

    try {
      const payload = {
        name: accountForm.name.trim(),
        balance: Number(accountForm.balance),
        currency: accountForm.currency.trim().toUpperCase()
      };

      if (editingAccountId === null) {
        await api.createAccount(payload);
      } else {
        await api.updateAccount(editingAccountId, payload);
      }

      resetAccountForm();
      setAccountStatus({
        state: "success",
        message:
          editingAccountId === null
            ? t("money.accountAdded")
            : t("money.accountUpdated")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setAccountStatus({
        state: "error",
        message: getUserFacingError(error, "money.saveAccountError")
      });
    }
  }

  async function handleConnectMockBank() {
    setBankSyncStatus({ state: "loading", message: null });

    try {
      const started = await api.startBankConnection({ provider: "mock" });
      const connected = await api.completeBankConnection({
        connection_id: started.connection_id
      });

      setBankSyncStatus({
        state: "success",
        message: t("bank.connected", {
          institution: connected.institution_name
        })
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setBankSyncStatus({
        state: "error",
        message: getUserFacingError(error, "bank.syncError")
      });
    }
  }

  async function handleSyncBank(connectionId?: number) {
    setBankSyncStatus({ state: "loading", message: null });

    try {
      const summary = await api.syncBankConnections(
        connectionId ? { connection_id: connectionId } : {}
      );

      setBankSyncStatus({
        state: "success",
        message: t("bank.syncComplete", {
          duplicates: summary.duplicate_transactions,
          imported: summary.imported_transactions
        })
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setBankSyncStatus({
        state: "error",
        message: getUserFacingError(error, "bank.syncError")
      });
    }
  }

  async function handleDeleteBankConnection(connectionId: number) {
    setBankSyncStatus({ state: "loading", message: null });

    try {
      await api.deleteBankConnection(connectionId);
      setBankSyncStatus({
        state: "success",
        message:
          t("bank.deleted")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setBankSyncStatus({
        state: "error",
        message: getUserFacingError(error, "bank.deleteError")
      });
    }
  }

  async function handleDeleteAccount(accountId: number) {
    setAccountStatus({ state: "loading", message: null });

    try {
      await api.deleteAccount(accountId);

      if (editingAccountId === accountId) {
        resetAccountForm();
      }

      setAccountStatus({ state: "success", message: t("money.accountDeleted") });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setAccountStatus({
        state: "error",
        message: getUserFacingError(error, "money.deleteAccountError")
      });
    }
  }

  async function handleSaveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransactionStatus({ state: "loading", message: null });

    try {
      const payload = {
        name: transactionForm.name.trim(),
        amount: Number(transactionForm.amount),
        currency: transactionForm.currency.trim().toUpperCase(),
        direction: transactionForm.direction,
        category:
          transactionForm.direction === "expense" ? transactionForm.category : undefined,
        effective_date: transactionForm.effectiveDate
      };

      if (editingTransactionId === null) {
        await api.createTransaction(payload);
      } else {
        await api.updateTransaction(editingTransactionId, payload);
      }

      resetTransactionForm();
      setTransactionStatus({
        state: "success",
        message:
          editingTransactionId === null
            ? t("money.transactionSaved")
            : t("money.transactionUpdated")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setTransactionStatus({
        state: "error",
        message: getUserFacingError(error, "money.saveTransactionError")
      });
    }
  }

  async function handleDeleteTransaction(transactionId: number) {
    setTransactionStatus({ state: "loading", message: null });

    try {
      await api.deleteTransaction(transactionId);

      if (editingTransactionId === transactionId) {
        resetTransactionForm();
      }

      setTransactionStatus({ state: "success", message: t("money.transactionDeleted") });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setTransactionStatus({
        state: "error",
        message: getUserFacingError(error, "money.deleteTransactionError")
      });
    }
  }

  async function handleSaveRecurringEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecurringEventStatus({ state: "loading", message: null });

    try {
      const payload = {
        name: recurringEventForm.name.trim(),
        amount: Number(recurringEventForm.amount),
        currency: recurringEventForm.currency.trim().toUpperCase(),
        direction: recurringEventForm.direction,
        category:
          recurringEventForm.direction === "expense"
            ? recurringEventForm.category
            : undefined,
        cadence: recurringEventForm.cadence,
        start_date: recurringEventForm.startDate,
        active: recurringEventForm.active
      };

      if (editingRecurringEventId === null) {
        await api.createRecurringEvent(payload);
      } else {
        await api.updateRecurringEvent(editingRecurringEventId, payload);
      }

      resetRecurringEventForm();
      setRecurringEventStatus({
        state: "success",
        message:
          editingRecurringEventId === null
            ? t("money.recurringSaved")
            : t("money.recurringUpdated")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setRecurringEventStatus({
        state: "error",
        message: getUserFacingError(error, "money.saveRecurringError")
      });
    }
  }

  async function handleDeleteRecurringEvent(recurringEventId: number) {
    setRecurringEventStatus({ state: "loading", message: null });

    try {
      await api.deleteRecurringEvent(recurringEventId);

      if (editingRecurringEventId === recurringEventId) {
        resetRecurringEventForm();
      }

      setRecurringEventStatus({
        state: "success",
        message: t("money.recurringDeleted")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setRecurringEventStatus({
        state: "error",
        message: getUserFacingError(error, "money.deleteRecurringError")
      });
    }
  }

  async function handleSaveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalStatus({ state: "loading", message: null });

    try {
      const payload = {
        name: goalForm.name.trim(),
        target_amount: Number(goalForm.targetAmount || 0),
        planned_contribution: Number(goalForm.plannedContribution || 0),
        reserved_amount: Number(goalForm.reservedAmount || 0),
        currency: goalForm.currency.trim().toUpperCase(),
        kind: goalForm.kind
      };

      if (editingGoalId === null) {
        await api.createGoal(payload);
      } else {
        await api.updateGoal(editingGoalId, payload);
      }

      resetGoalForm();
      setGoalStatus({
        state: "success",
        message: editingGoalId === null ? t("goals.saved") : t("goals.updated")
      });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setGoalStatus({
        state: "error",
        message: getUserFacingError(error, "goals.saveError")
      });
    }
  }

  async function handleDeleteGoal(goalId: number) {
    setGoalStatus({ state: "loading", message: null });

    try {
      await api.deleteGoal(goalId);

      if (editingGoalId === goalId) {
        resetGoalForm();
      }

      setGoalStatus({ state: "success", message: t("goals.deleted") });
      await loadAllData();
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setGoalStatus({
        state: "error",
        message: getUserFacingError(error, "goals.deleteError")
      });
    }
  }

  async function handleBeforeYouBuy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuyStatus({ state: "loading", message: null });
    setBuyCoachStatus({ state: "idle", message: null });
    setBuyCoach(null);
    setBuyResult(null);

    try {
      const payload = {
        amount: Number(buyForm.amount),
        currency: buyForm.currency.trim().toUpperCase(),
        description: buyForm.description.trim() || undefined
      };
      const response = await api.evaluateBeforeYouBuy(payload);

      setBuyResult(response);
      setBuyStatus({ state: "success", message: null });

      setBuyCoachStatus({ state: "loading", message: null });

      try {
        const coachResponse = await api.explainCoachDecision(payload);
        setBuyCoach(coachResponse);
        setBuyCoachStatus({ state: "success", message: null });
      } catch (error) {
        if (await handleUnauthorizedState(error)) {
          return;
        }

        setBuyCoachStatus({
          state: "error",
          message: getUserFacingError(error, "coach.loadError")
        });
      }
    } catch (error) {
      if (await handleUnauthorizedState(error)) {
        return;
      }

      setBuyStatus({
        state: "error",
        message: getUserFacingError(error, "buy.error")
      });
      setBuyResult(null);
      setBuyCoach(null);
      setBuyCoachStatus({ state: "idle", message: null });
    }
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountForm(initialAccountForm);
  }

  function resetTransactionForm() {
    setEditingTransactionId(null);
    setTransactionForm(initialTransactionForm);
  }

  function resetRecurringEventForm() {
    setEditingRecurringEventId(null);
    setRecurringEventForm(initialRecurringEventForm);
  }

  function resetGoalForm() {
    setEditingGoalId(null);
    setGoalForm(initialGoalForm);
  }

  function startAccountEdit(account: Account) {
    setEditingAccountId(account.id);
    setAccountStatus({ state: "idle", message: null });
    setAccountForm({
      name: account.name,
      balance: String(account.balance),
      currency: account.currency
    });
  }

  function startTransactionEdit(transaction: Transaction) {
    setEditingTransactionId(transaction.id);
    setTransactionStatus({ state: "idle", message: null });
    setTransactionForm({
      name: transaction.name,
      amount: String(transaction.amount),
      currency: transaction.currency,
      direction: transaction.direction,
      category: transaction.category ?? "essential",
      effectiveDate: transaction.effective_date
    });
  }

  function startRecurringEventEdit(recurringEvent: RecurringEvent) {
    setEditingRecurringEventId(recurringEvent.id);
    setRecurringEventStatus({ state: "idle", message: null });
    setRecurringEventForm({
      name: recurringEvent.name,
      amount: String(recurringEvent.amount),
      currency: recurringEvent.currency,
      direction: recurringEvent.direction,
      category: recurringEvent.category ?? "committed",
      cadence: recurringEvent.cadence,
      startDate: recurringEvent.start_date,
      active: recurringEvent.active
    });
  }

  function startGoalEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalStatus({ state: "idle", message: null });
    setGoalForm({
      name: goal.name,
      targetAmount: String(goal.target_amount),
      plannedContribution: String(goal.planned_contribution),
      reservedAmount: String(goal.reserved_amount),
      currency: goal.currency,
      kind: goal.kind
    });
  }

  function jumpToScreen(screen: Screen) {
    startTransition(() => {
      setActiveScreen(screen);
    });
  }

  if (!session) {
    return (
      <AuthScreen
        form={authForm}
        mode={authMode}
        onFormChange={setAuthForm}
        onModeChange={setAuthMode}
        onSubmit={handleAuthenticate}
        status={authStatus}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient--top" />
      <div className="ambient ambient--bottom" />

      <section className="hero-panel">
        <p className="eyebrow">{t("app.mvp")}</p>
        <h1>{t("app.heroTitle")}</h1>
        <p className="lede">{t("app.heroDescription")}</p>
        <div className="hero-meta">
          <span>{t("app.signedInAs", { name: session.user.name })}</span>
          <button className="secondary-button secondary-button--small" onClick={() => void handleLogout()} type="button">
            {t("common.logout")}
          </button>
        </div>
      </section>

      <section className="screen-stack">
        {activeScreen === "today" ? (
          <TodayScreen
            engineSnapshot={engineForecast?.snapshot ?? null}
            error={loadError}
            hasFinancialContext={hasFinancialContext}
            nextCheckpoint={nextCheckpoint}
            onJumpToBuy={() => jumpToScreen("buy")}
            onJumpToGoals={() => jumpToScreen("goals")}
            onJumpToMoney={() => jumpToScreen("money")}
            onRefresh={loadAllData}
            state={todayState}
            todayCoach={todayCoach}
            todayCoachError={todayCoachError}
            todayCoachState={todayCoachState}
            todaysTransactions={todaysTransactions}
            today={today}
            weeklyCoach={weeklyCoach}
            weeklyCoachError={weeklyCoachError}
            weeklyCoachState={weeklyCoachState}
          />
        ) : null}

        {activeScreen === "buy" ? (
          <BeforeYouBuyScreen
            coach={buyCoach}
            coachStatus={buyCoachStatus}
            engineResult={engineAffordability}
            form={buyForm}
            hasFinancialContext={hasFinancialContext}
            onBackToToday={() => jumpToScreen("today")}
            onFormChange={setBuyForm}
            onJumpToMoney={() => jumpToScreen("money")}
            onSubmit={handleBeforeYouBuy}
            result={buyResult}
            status={buyStatus}
          />
        ) : null}

        {activeScreen === "money" ? (
          <MoneyScreen
            accountForm={accountForm}
            accountStatus={accountStatus}
            accounts={accounts}
            accountsState={accountsState}
            editingAccountId={editingAccountId}
            editingRecurringEventId={editingRecurringEventId}
            editingTransactionId={editingTransactionId}
            loadError={loadError}
            moneySummary={moneySummary}
            onAccountFormChange={setAccountForm}
            onDeleteAccount={handleDeleteAccount}
            onDeleteRecurringEvent={handleDeleteRecurringEvent}
            onDeleteTransaction={handleDeleteTransaction}
            onEditAccount={startAccountEdit}
            onEditRecurringEvent={startRecurringEventEdit}
            onEditTransaction={startTransactionEdit}
            onRecurringEventFormChange={setRecurringEventForm}
            onRetry={loadAllData}
            onSaveAccount={handleSaveAccount}
            onSaveRecurringEvent={handleSaveRecurringEvent}
            onSaveTransaction={handleSaveTransaction}
            onTransactionFormChange={setTransactionForm}
            recurringEventForm={recurringEventForm}
            recurringEventStatus={recurringEventStatus}
            recurringEvents={recurringEvents}
            recurringEventsState={recurringEventsState}
            resetAccountForm={resetAccountForm}
            resetRecurringEventForm={resetRecurringEventForm}
            resetTransactionForm={resetTransactionForm}
            transactionForm={transactionForm}
            transactionStatus={transactionStatus}
            transactions={transactions}
            transactionsState={transactionsState}
          />
        ) : null}

        {activeScreen === "goals" ? (
          <GoalsScreen
            editingGoalId={editingGoalId}
            form={goalForm}
            goalStatus={goalStatus}
            goals={goals}
            goalsState={goalsState}
            loadError={loadError}
            onDeleteGoal={handleDeleteGoal}
            onEditGoal={startGoalEdit}
            onFormChange={setGoalForm}
            onRetry={loadAllData}
            onSubmit={handleSaveGoal}
            resetGoalForm={resetGoalForm}
            summary={goalSummary}
          />
        ) : null}

        {activeScreen === "insights" ? (
          <SettingsScreen
            bankConnections={bankConnections}
            bankConnectionsState={bankConnectionsState}
            bankSyncStatus={bankSyncStatus}
            loadError={loadError}
            onConnectMockBank={handleConnectMockBank}
            onDeleteConnection={handleDeleteBankConnection}
            onRetry={loadAllData}
            onSyncAll={() => void handleSyncBank()}
            onSyncConnection={(connectionId) => void handleSyncBank(connectionId)}
          />
        ) : null}
      </section>

      <nav aria-label={t("nav.primary")} className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={
              item.id === activeScreen ? "nav-item nav-item--active" : "nav-item"
            }
            data-testid={`nav-${item.id}`}
            onClick={() => jumpToScreen(item.id)}
            type="button"
          >
            <span aria-hidden="true" className="nav-item__icon">
              {item.icon}
            </span>
            <span>{t(`nav.${item.id === "insights" ? "settings" : item.id}`)}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function TodayScreen(props: {
  engineSnapshot: FinancialSnapshot | null;
  state: AsyncState;
  error: string | null;
  today: TodayResponse | null;
  todayCoach: CoachTodaySummary | null;
  todayCoachState: AsyncState;
  todayCoachError: string | null;
  weeklyCoach: CoachWeeklySummary | null;
  weeklyCoachState: AsyncState;
  weeklyCoachError: string | null;
  hasFinancialContext: boolean;
  nextCheckpoint: ScheduledCheckpoint | null;
  onRefresh: () => Promise<void>;
  onJumpToBuy: () => void;
  onJumpToMoney: () => void;
  onJumpToGoals: () => void;
  todaysTransactions: Transaction[];
}) {
  const {
    engineSnapshot,
    error,
    hasFinancialContext,
    nextCheckpoint,
    onJumpToBuy,
    onJumpToGoals,
    onJumpToMoney,
    onRefresh,
    state,
    todayCoach,
    todayCoachError,
    todayCoachState,
    todaysTransactions,
    today,
    weeklyCoach,
    weeklyCoachError,
    weeklyCoachState
  } = props;
  const {
    formatCurrency,
    formatDate,
    formatDecisionLabel,
    formatSourceLabel,
    formatTransactionCategory,
    formatTransactionDirection,
    t
  } = useI18n();
  const translateAny = (key: string, variables?: Record<string, string | number>) =>
    t(key as Parameters<typeof t>[0], variables);

  const explanations = today
    ? buildTodayExplanations(today, {
        t: translateAny,
        formatCurrency,
        formatDate,
        formatDecisionLabel
      })
    : [];
  const todayNarrative: CoachNarrativeView | null = engineSnapshot
    ? {
        ...buildTodayCoachContentFromEngine(engineSnapshot, {
          t: translateAny,
          formatCurrency,
          formatDate,
          formatDecisionLabel
        }),
        source: todayCoach?.source ?? "deterministic",
        modelVersion: todayCoach?.model_version ?? today?.model_version ?? "frontend-engine"
      }
    : null;
  const weeklyNarrative: CoachNarrativeView | null = weeklyCoach
    ? {
        ...buildWeeklyCoachContent(weeklyCoach, {
          t: translateAny,
          formatCurrency,
          formatDate,
          formatDecisionLabel
        }),
        source: weeklyCoach.source,
        modelVersion: weeklyCoach.model_version
      }
    : null;

  if (state === "loading") {
    return (
      <Card title={t("today.title")} subtitle={t("today.loadingSubtitle")}>
        <LoadingState label={t("loading.todayBriefing")} />
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card title={t("today.title")} subtitle={t("today.errorSubtitle")}>
        <ErrorState
          actionLabel={t("common.retry")}
          message={error ?? t("errors.generic")}
          onAction={() => void onRefresh()}
        />
      </Card>
    );
  }

  if (!hasFinancialContext || !today) {
    return (
      <Card
        title={t("today.title")}
        subtitle={t("today.emptySubtitle")}
      >
        <EmptyState
          actionLabel={t("today.addMoneyContext")}
          description={t("today.emptyDescription")}
          onAction={onJumpToMoney}
        />
        <div className="inline-actions">
          <button className="secondary-button" onClick={onJumpToGoals} type="button">
            {t("today.addGoal")}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title={t("today.title")}
        subtitle={t("today.subtitle")}
      >
        <div className="today-amount">
          <span>{t("today.availableToSpend")}</span>
          <strong data-testid="today-available-to-spend">
            {formatCurrency(today.available_to_spend_today, today.currency)}
          </strong>
        </div>
        <div
          className={`decision-pill decision-pill--${today.risk_level}`}
          data-testid="today-risk-level"
        >
          {formatDecisionLabel(today.risk_level)}
        </div>
        <ul className="reason-list">
          {explanations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="inline-actions">
          <button className="primary-button" onClick={onJumpToBuy} type="button">
            {t("buy.formTitle")}
          </button>
          <button className="secondary-button" onClick={() => void onRefresh()} type="button">
            {t("today.refresh")}
          </button>
        </div>
      </Card>

      <section className="metric-grid">
        <MetricCard
          label={t("today.availableBalance")}
          value={formatCurrency(today.inputs.available_balance, today.currency)}
        />
        <MetricCard
          label={t("today.essentials")}
          value={formatCurrency(today.inputs.essential_obligations, today.currency)}
        />
        <MetricCard
          label={t("today.commitments")}
          value={formatCurrency(today.inputs.committed_spending, today.currency)}
        />
        <MetricCard
          label={t("today.goalContribution")}
          value={formatCurrency(today.inputs.planned_goal_contribution, today.currency)}
        />
        <MetricCard
          label={t("today.confidence")}
          value={`${today.confidence.mode} · ${today.confidence.input_completeness}`}
        />
        <MetricCard
          label={t("today.nextCheckpoint")}
          testId="today-next-checkpoint"
          value={
            nextCheckpoint
              ? `${formatDate(nextCheckpoint.date)} · ${formatCurrency(
                  nextCheckpoint.amount,
                  nextCheckpoint.currency
                )}`
              : t("today.nextCheckpointEmpty")
          }
        />
      </section>

      <CoachCard
        title={t("coach.title")}
        subtitle={t("today.coachTodaySubtitle")}
        narrative={todayNarrative}
        error={todayCoachError}
        state={todayCoachState}
        onRetry={() => void onRefresh()}
      />

      <Card
        title={t("today.nextTitle")}
        subtitle={t("today.nextTitleSubtitle")}
      >
        <div className="schedule-chip">
          <strong>{nextCheckpoint ? nextCheckpoint.label : t("today.noUpcomingItem")}</strong>
          <span>
            {nextCheckpoint
              ? `${formatDate(nextCheckpoint.date)} · ${formatCurrency(
                  nextCheckpoint.amount,
                  nextCheckpoint.currency
                )}`
              : t("today.noUpcomingItemDescription")}
          </span>
        </div>
        <div className="inline-actions">
          <button className="secondary-button" onClick={onJumpToMoney} type="button">
            {t("today.reviewMoney")}
          </button>
          <button className="secondary-button" onClick={onJumpToGoals} type="button">
            {t("today.reviewGoals")}
          </button>
        </div>
      </Card>

      <CoachCard
        title={t("coach.thisWeek")}
        subtitle={
          weeklyNarrative
            ? `${formatDate(weeklyCoach!.period_start)} to ${formatDate(weeklyCoach!.period_end)}`
            : t("coach.cardEmpty")
        }
        narrative={weeklyNarrative}
        error={weeklyCoachError}
        state={weeklyCoachState}
        onRetry={() => void onRefresh()}
      />

      <Card
        title={t("today.activityTitle")}
        subtitle={t("today.activitySubtitle")}
      >
        {todaysTransactions.length > 0 ? (
          <ul className="data-list">
            {todaysTransactions.map((transaction) => (
              <li key={transaction.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{transaction.name}</strong>
                    <p>
                      {formatTransactionDirection(transaction.direction)}
                      {transaction.category
                        ? ` · ${formatTransactionCategory(transaction.category)}`
                        : ""}
                    </p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(transaction.amount, transaction.currency)}</span>
                    <span className={sourceTagClassName(transaction.source)}>
                      {formatSourceLabel(transaction.source)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState description={t("today.activityEmpty")} />
        )}
      </Card>
    </>
  );
}

function BeforeYouBuyScreen(props: {
  coach: CoachDecisionExplanation | null;
  coachStatus: FormStatus;
  engineResult: AffordabilityResult | null;
  form: typeof initialBuyForm;
  onFormChange: Dispatch<SetStateAction<typeof initialBuyForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBackToToday: () => void;
  onJumpToMoney: () => void;
  result: BeforeYouBuyResponse | null;
  status: FormStatus;
  hasFinancialContext: boolean;
}) {
  const {
    coach,
    coachStatus,
    engineResult,
    form,
    hasFinancialContext,
    onBackToToday,
    onJumpToMoney,
    onFormChange,
    onSubmit,
    result,
    status
  } = props;
  const { formatCurrency, formatDate, formatDecisionLabel, t } = useI18n();
  const translateAny = (key: string, variables?: Record<string, string | number>) =>
    t(key as Parameters<typeof t>[0], variables);
  const explanations = engineResult
    ? buildPurchaseExplanationsFromEngine(engineResult, {
        t: translateAny,
        formatCurrency,
        formatDate,
        formatDecisionLabel
      })
    : result
      ? buildPurchaseExplanations(result, {
          t: translateAny,
          formatCurrency,
          formatDate,
          formatDecisionLabel
        })
      : [];
  const coachNarrative: CoachNarrativeView | null = engineResult
    ? {
        ...buildDecisionCoachContentFromEngine(engineResult, form.description, {
          t: translateAny,
          formatCurrency,
          formatDate,
          formatDecisionLabel
        }),
        source: coach?.source ?? "deterministic",
        modelVersion: coach?.model_version ?? result?.model_version ?? "frontend-engine"
      }
    : result
      ? {
          ...buildDecisionCoachContent(
            result,
            coach?.baseline_risk_level ?? result.decision,
            form.description,
            {
              t: translateAny,
              formatCurrency,
              formatDate,
              formatDecisionLabel
            }
          ),
          source: coach?.source ?? "deterministic",
          modelVersion: coach?.model_version ?? result.model_version
        }
      : null;

  return (
    <>
      <Card
        title={t("buy.formTitle")}
        subtitle={t("buy.formSubtitle")}
      >
        <form
          className="stack-form"
          data-testid="buy-form"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="field">
            <span>{t("buy.item")}</span>
            <input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              placeholder={t("buy.itemPlaceholder")}
              value={form.description}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>{t("buy.price")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                placeholder="120"
                value={form.amount}
              />
            </label>
            <label className="field">
              <span>{t("common.currency")}</span>
              <input
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
                value={form.currency}
              />
            </label>
          </div>
          <button
            className="primary-button"
            disabled={status.state === "loading" || !hasFinancialContext}
            type="submit"
          >
            {status.state === "loading" ? t("buy.checking") : t("buy.checkPurchase")}
          </button>
          <button className="secondary-button" onClick={onBackToToday} type="button">
            {t("buy.backToToday")}
          </button>
        </form>

        {!hasFinancialContext ? (
          <div className="stack-block">
            <p className="helper-copy">{t("buy.helperContext")}</p>
            <button className="secondary-button" onClick={onJumpToMoney} type="button">
              {t("buy.goToMoney")}
            </button>
          </div>
        ) : null}

        {status.state === "error" && status.message ? (
          <p className="feedback feedback--error">{status.message}</p>
        ) : null}
      </Card>

      {result ? (
        <Card
          title={t("buy.decisionTitle")}
          subtitle={t("buy.resultSubtitle")}
        >
          <div className="decision-summary" data-testid="buy-decision-summary">
            <div>
              <span>{t("buy.decisionTitle")}</span>
              <strong data-testid="buy-decision-label">
                {formatDecisionLabel(result.decision)}
              </strong>
            </div>
            <div>
              <span>{t("buy.remainingAfterPurchase")}</span>
              <strong data-testid="buy-remaining-after-purchase">
                {formatCurrency(
                  result.available_to_spend_after_purchase,
                  result.currency
                )}
              </strong>
            </div>
          </div>

          <section className="metric-grid">
            <MetricCard
              label={t("buy.currentHeadroom")}
              value={formatCurrency(result.current_available_to_spend, result.currency)}
            />
            <MetricCard
              label={t("buy.purchaseAmount")}
              value={formatCurrency(result.purchase_amount, result.currency)}
            />
            <MetricCard
              label={t("buy.change")}
              value={formatCurrency(result.delta, result.currency)}
            />
            <MetricCard
              label={t("today.confidence")}
              value={`${result.confidence.mode} · ${result.confidence.purchase_context}`}
            />
          </section>

          <ul className="reason-list">
            {explanations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {result.alternatives && result.alternatives.length > 0 ? (
            <section className="alternatives-panel">
              <h3>{t("buy.alternatives")}</h3>
              <ul className="reason-list">
                {result.alternatives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </Card>
      ) : (
        <Card
          title={t("buy.resultEmptyTitle")}
          subtitle={t("buy.resultEmptySubtitle")}
        >
          <EmptyState description={t("buy.resultEmptyDescription")} />
        </Card>
      )}

      {result ? (
        <CoachCard
          title={t("coach.title")}
          subtitle={t("buy.coachSubtitle")}
          narrative={coachNarrative}
          error={coachStatus.message}
          state={coachStatus.state}
        />
      ) : null}
    </>
  );
}

function MoneyScreen(props: {
  accounts: Account[];
  accountsState: AsyncState;
  transactions: Transaction[];
  transactionsState: AsyncState;
  recurringEvents: RecurringEvent[];
  recurringEventsState: AsyncState;
  loadError: string | null;
  moneySummary: {
    currency: string;
    totalBalance: number;
    totalIncome: number;
    totalExpenses: number;
    activeRecurring: number;
  };
  accountForm: typeof initialAccountForm;
  transactionForm: typeof initialTransactionForm;
  recurringEventForm: typeof initialRecurringEventForm;
  onAccountFormChange: Dispatch<SetStateAction<typeof initialAccountForm>>;
  onTransactionFormChange: Dispatch<SetStateAction<typeof initialTransactionForm>>;
  onRecurringEventFormChange: Dispatch<
    SetStateAction<typeof initialRecurringEventForm>
  >;
  onSaveAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveTransaction: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveRecurringEvent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteAccount: (accountId: number) => Promise<void>;
  onDeleteTransaction: (transactionId: number) => Promise<void>;
  onDeleteRecurringEvent: (recurringEventId: number) => Promise<void>;
  onEditAccount: (account: Account) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onEditRecurringEvent: (recurringEvent: RecurringEvent) => void;
  onRetry: () => Promise<void>;
  resetAccountForm: () => void;
  resetTransactionForm: () => void;
  resetRecurringEventForm: () => void;
  accountStatus: FormStatus;
  transactionStatus: FormStatus;
  recurringEventStatus: FormStatus;
  editingAccountId: number | null;
  editingTransactionId: number | null;
  editingRecurringEventId: number | null;
}) {
  const {
    accountForm,
    accountStatus,
    accounts,
    accountsState,
    editingAccountId,
    editingRecurringEventId,
    editingTransactionId,
    loadError,
    moneySummary,
    onAccountFormChange,
    onDeleteAccount,
    onDeleteRecurringEvent,
    onDeleteTransaction,
    onEditAccount,
    onEditRecurringEvent,
    onEditTransaction,
    onRecurringEventFormChange,
    onRetry,
    onSaveAccount,
    onSaveRecurringEvent,
    onSaveTransaction,
    onTransactionFormChange,
    recurringEventForm,
    recurringEventStatus,
    recurringEvents,
    recurringEventsState,
    resetAccountForm,
    resetRecurringEventForm,
    resetTransactionForm,
    transactionForm,
    transactionStatus,
    transactions,
    transactionsState
  } = props;
  const {
    formatCurrency,
    formatDate,
    formatRecurringCadence,
    formatSourceLabel,
    formatTransactionCategory,
    formatTransactionDirection,
    t
  } = useI18n();

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label={t("money.balances")}
          value={formatCurrency(moneySummary.totalBalance, moneySummary.currency)}
        />
        <MetricCard
          label={t("money.income")}
          value={formatCurrency(moneySummary.totalIncome, moneySummary.currency)}
        />
        <MetricCard
          label={t("money.expenses")}
          value={formatCurrency(moneySummary.totalExpenses, moneySummary.currency)}
        />
        <MetricCard
          label={t("money.activeRecurring")}
          value={`${moneySummary.activeRecurring}`}
        />
      </section>

      <Card title={t("money.accountsTitle")} subtitle={t("money.accountsSubtitle")}>
        <form
          className="stack-form"
          data-testid="account-form"
          onSubmit={(event) => void onSaveAccount(event)}
        >
          <label className="field">
            <span>{t("money.accountName")}</span>
            <input
              onChange={(event) =>
                onAccountFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder={t("money.accountPlaceholder")}
              value={accountForm.name}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>{t("money.balance")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onAccountFormChange((current) => ({
                    ...current,
                    balance: event.target.value
                  }))
                }
                value={accountForm.balance}
              />
            </label>
            <label className="field">
              <span>{t("common.currency")}</span>
              <input
                onChange={(event) =>
                  onAccountFormChange((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
                value={accountForm.currency}
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">
              {editingAccountId === null ? t("money.addAccount") : t("money.updateAccount")}
            </button>
            {editingAccountId !== null ? (
              <button className="secondary-button" onClick={resetAccountForm} type="button">
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
          <StatusMessage status={accountStatus} />
        </form>

        <ResourceBody
          emptyDescription={t("money.accountsEmpty")}
          errorDetails={t("money.accountsError")}
          itemsCount={accounts.length}
          loadError={loadError}
          onRetry={onRetry}
          state={accountsState}
        >
          <ul className="data-list" data-testid="accounts-list">
            {accounts.map((account) => (
              <li key={account.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{account.name}</strong>
                    <p>{formatDate(account.created_at)}</p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(account.balance, account.currency)}</span>
                    <span className={sourceTagClassName(account.source)}>
                      {formatSourceLabel(account.source)}
                    </span>
                  </div>
                </div>
                {account.source === "manual" ? (
                  <div className="list-actions">
                    <button
                      className="secondary-button secondary-button--small"
                      data-testid={`account-edit-${account.id}`}
                      onClick={() => onEditAccount(account)}
                      type="button"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      data-testid={`account-delete-${account.id}`}
                      onClick={() => void onDeleteAccount(account.id)}
                      type="button"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                ) : (
                  <p className="helper-copy helper-copy--compact">
                    {t("money.managedByBank")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>

      <Card
        title={t("money.transactionTitle")}
        subtitle={t("money.transactionSubtitle")}
      >
        <form
          className="stack-form"
          data-testid="transaction-form"
          onSubmit={(event) => void onSaveTransaction(event)}
        >
          <label className="field">
            <span>{t("common.name")}</span>
            <input
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder={t("money.namePlaceholder")}
              value={transactionForm.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>{t("money.amount")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onTransactionFormChange((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                value={transactionForm.amount}
              />
            </label>
            <label className="field">
              <span>{t("money.direction")}</span>
              <select
                onChange={(event) =>
                  onTransactionFormChange((current) => ({
                    ...current,
                    direction: event.target.value as TransactionDirection,
                    category:
                      event.target.value === "expense"
                        ? current.category
                        : "essential"
                  }))
                }
                value={transactionForm.direction}
              >
                <option value="expense">{t("common.direction.expense")}</option>
                <option value="income">{t("common.direction.income")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("money.category")}</span>
              <select
                disabled={transactionForm.direction === "income"}
                onChange={(event) =>
                  onTransactionFormChange((current) => ({
                    ...current,
                    category: event.target.value as TransactionCategory
                  }))
                }
                value={transactionForm.category}
              >
                <option value="essential">{t("money.category.essential")}</option>
                <option value="committed">{t("money.category.committed")}</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>{t("money.date")}</span>
              <input
                onChange={(event) =>
                  onTransactionFormChange((current) => ({
                    ...current,
                    effectiveDate: event.target.value
                  }))
                }
                type="date"
                value={transactionForm.effectiveDate}
              />
            </label>
            <label className="field">
              <span>{t("common.currency")}</span>
              <input
                onChange={(event) =>
                  onTransactionFormChange((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
                value={transactionForm.currency}
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">
              {editingTransactionId === null
                ? t("money.addTransaction")
                : t("money.updateTransaction")}
            </button>
            {editingTransactionId !== null ? (
              <button
                className="secondary-button"
                onClick={resetTransactionForm}
                type="button"
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
          <StatusMessage status={transactionStatus} />
        </form>

        <ResourceBody
          emptyDescription={t("money.transactionEmpty")}
          errorDetails={t("money.transactionError")}
          itemsCount={transactions.length}
          loadError={loadError}
          onRetry={onRetry}
          state={transactionsState}
        >
          <ul className="data-list" data-testid="transactions-list">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{transaction.name}</strong>
                    <p>
                      {formatDate(transaction.effective_date)} ·{" "}
                      {formatTransactionDirection(transaction.direction)}
                      {transaction.category
                        ? ` · ${formatTransactionCategory(transaction.category)}`
                        : ""}
                    </p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(transaction.amount, transaction.currency)}</span>
                    <span className={sourceTagClassName(transaction.source)}>
                      {formatSourceLabel(transaction.source)}
                    </span>
                  </div>
                </div>
                {transaction.source === "manual" ? (
                  <div className="list-actions">
                    <button
                      className="secondary-button secondary-button--small"
                      data-testid={`transaction-edit-${transaction.id}`}
                      onClick={() => onEditTransaction(transaction)}
                      type="button"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      className="secondary-button secondary-button--small"
                      data-testid={`transaction-delete-${transaction.id}`}
                      onClick={() => void onDeleteTransaction(transaction.id)}
                      type="button"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                ) : (
                  <p className="helper-copy helper-copy--compact">
                    {t("money.managedByBank")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>

      <Card
        title={t("money.recurringTitle")}
        subtitle={t("money.recurringSubtitle")}
      >
        <form
          className="stack-form"
          data-testid="recurring-event-form"
          onSubmit={(event) => void onSaveRecurringEvent(event)}
        >
          <label className="field">
            <span>{t("common.name")}</span>
            <input
              onChange={(event) =>
                onRecurringEventFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder={t("money.recurringNamePlaceholder")}
              value={recurringEventForm.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>{t("money.amount")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    amount: event.target.value
                  }))
                }
                value={recurringEventForm.amount}
              />
            </label>
            <label className="field">
              <span>{t("money.direction")}</span>
              <select
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    direction: event.target.value as TransactionDirection,
                    category:
                      event.target.value === "expense"
                        ? current.category
                        : "essential"
                  }))
                }
                value={recurringEventForm.direction}
              >
                <option value="expense">{t("common.direction.expense")}</option>
                <option value="income">{t("common.direction.income")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("money.category")}</span>
              <select
                disabled={recurringEventForm.direction === "income"}
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    category: event.target.value as TransactionCategory
                  }))
                }
                value={recurringEventForm.category}
              >
                <option value="essential">{t("money.category.essential")}</option>
                <option value="committed">{t("money.category.committed")}</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>{t("money.cadence")}</span>
              <select
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    cadence: event.target.value as RecurringEventCadence
                  }))
                }
                value={recurringEventForm.cadence}
              >
                <option value="daily">{t("money.cadence.daily")}</option>
                <option value="weekly">{t("money.cadence.weekly")}</option>
                <option value="monthly">{t("money.cadence.monthly")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("money.startDate")}</span>
              <input
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    startDate: event.target.value
                  }))
                }
                type="date"
                value={recurringEventForm.startDate}
              />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>{t("common.currency")}</span>
              <input
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
                value={recurringEventForm.currency}
              />
            </label>
            <label className="field">
              <span>{t("money.recurringStatus")}</span>
              <select
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    active: event.target.value === "active"
                  }))
                }
                value={recurringEventForm.active ? "active" : "paused"}
              >
                <option value="active">{t("common.active")}</option>
                <option value="paused">{t("common.paused")}</option>
              </select>
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">
              {editingRecurringEventId === null
                ? t("money.addRecurringEvent")
                : t("money.updateRecurringEvent")}
            </button>
            {editingRecurringEventId !== null ? (
              <button
                className="secondary-button"
                onClick={resetRecurringEventForm}
                type="button"
              >
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
          <StatusMessage status={recurringEventStatus} />
        </form>

        <ResourceBody
          emptyDescription={t("money.recurringEmpty")}
          errorDetails={t("money.recurringError")}
          itemsCount={recurringEvents.length}
          loadError={loadError}
          onRetry={onRetry}
          state={recurringEventsState}
        >
          <ul className="data-list" data-testid="recurring-events-list">
            {recurringEvents.map((recurringEvent) => (
              <li key={recurringEvent.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{recurringEvent.name}</strong>
                    <p>
                      {formatRecurringCadence(recurringEvent.cadence)} ·{" "}
                      {formatDate(recurringEvent.start_date)}
                      {recurringEvent.category
                        ? ` · ${formatTransactionCategory(recurringEvent.category)}`
                        : ""}
                    </p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(recurringEvent.amount, recurringEvent.currency)}</span>
                    <span
                      className={
                        recurringEvent.active ? "status-tag" : "status-tag status-tag--muted"
                      }
                    >
                      {recurringEvent.active ? t("common.active") : t("common.paused")}
                    </span>
                  </div>
                </div>
                <div className="list-actions">
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`recurring-event-edit-${recurringEvent.id}`}
                    onClick={() => onEditRecurringEvent(recurringEvent)}
                    type="button"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`recurring-event-delete-${recurringEvent.id}`}
                    onClick={() => void onDeleteRecurringEvent(recurringEvent.id)}
                    type="button"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>
    </>
  );
}

function GoalsScreen(props: {
  goals: Goal[];
  goalsState: AsyncState;
  loadError: string | null;
  summary: {
    currency: string;
    totalTargets: number;
    totalReserved: number;
    totalPlanned: number;
  };
  form: typeof initialGoalForm;
  goalStatus: FormStatus;
  editingGoalId: number | null;
  onFormChange: Dispatch<SetStateAction<typeof initialGoalForm>>;
  onRetry: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: number) => Promise<void>;
  resetGoalForm: () => void;
}) {
  const {
    editingGoalId,
    form,
    goalStatus,
    goals,
    goalsState,
    loadError,
    onDeleteGoal,
    onEditGoal,
    onFormChange,
    onRetry,
    onSubmit,
    resetGoalForm,
    summary
  } = props;
  const { formatCurrency, formatGoalKind, t } = useI18n();

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label={t("goals.subtitleMetrics.targets")}
          value={formatCurrency(summary.totalTargets, summary.currency)}
        />
        <MetricCard
          label={t("goals.subtitleMetrics.reserved")}
          value={formatCurrency(summary.totalReserved, summary.currency)}
        />
        <MetricCard
          label={t("goals.subtitleMetrics.planned")}
          value={formatCurrency(summary.totalPlanned, summary.currency)}
        />
      </section>

      <Card title={t("goals.formTitle")} subtitle={t("goals.formSubtitle")}>
        <form
          className="stack-form"
          data-testid="goal-form"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="field">
            <span>{t("common.name")}</span>
            <input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder={t("goals.namePlaceholder")}
              value={form.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>{t("goals.target")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    targetAmount: event.target.value
                  }))
                }
                value={form.targetAmount}
              />
            </label>
            <label className="field">
              <span>{t("goals.planned")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    plannedContribution: event.target.value
                  }))
                }
                value={form.plannedContribution}
              />
            </label>
            <label className="field">
              <span>{t("goals.reserved")}</span>
              <input
                inputMode="decimal"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    reservedAmount: event.target.value
                  }))
                }
                value={form.reservedAmount}
              />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>{t("goals.kind")}</span>
              <select
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    kind: event.target.value as GoalKind
                  }))
                }
                value={form.kind}
              >
                <option value="goal">{t("goals.kind.goal")}</option>
                <option value="safety_buffer">{t("goals.kind.safety_buffer")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("common.currency")}</span>
              <input
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    currency: event.target.value.toUpperCase()
                  }))
                }
                value={form.currency}
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">
              {editingGoalId === null ? t("goals.save") : t("goals.update")}
            </button>
            {editingGoalId !== null ? (
              <button className="secondary-button" onClick={resetGoalForm} type="button">
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
          <StatusMessage status={goalStatus} />
        </form>

        <ResourceBody
          emptyDescription={t("goals.empty")}
          errorDetails={t("goals.errorDetails")}
          itemsCount={goals.length}
          loadError={loadError}
          onRetry={onRetry}
          state={goalsState}
        >
          <ul className="data-list" data-testid="goals-list">
            {goals.map((goal) => (
              <li key={goal.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{goal.name}</strong>
                    <p>{formatGoalKind(goal.kind)}</p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
                    <span className="status-tag">
                      {t("goals.goalReserved", {
                        amount: formatCurrency(goal.reserved_amount, goal.currency)
                      })}
                    </span>
                  </div>
                </div>
                <div className="list-actions">
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`goal-edit-${goal.id}`}
                    onClick={() => onEditGoal(goal)}
                    type="button"
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`goal-delete-${goal.id}`}
                    onClick={() => void onDeleteGoal(goal.id)}
                    type="button"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>
    </>
  );
}

function SettingsScreen(props: {
  bankConnections: BankConnection[];
  bankConnectionsState: AsyncState;
  bankSyncStatus: FormStatus;
  loadError: string | null;
  onConnectMockBank: () => Promise<void>;
  onDeleteConnection: (connectionId: number) => Promise<void>;
  onRetry: () => Promise<void>;
  onSyncAll: () => void;
  onSyncConnection: (connectionId: number) => void;
}) {
  const {
    bankConnections,
    bankConnectionsState,
    bankSyncStatus,
    loadError,
    onConnectMockBank,
    onDeleteConnection,
    onRetry,
    onSyncAll,
    onSyncConnection
  } = props;
  const {
    formatConnectionStatus,
    formatDate,
    language,
    setLanguage,
    t
  } = useI18n();

  return (
    <>
      <Card
        title={t("i18n.selectorTitle")}
        subtitle={t("i18n.selectorSubtitle")}
      >
        <label className="field">
          <span>{t("i18n.language")}</span>
          <select
            data-testid="language-select"
            onChange={(event) => setLanguage(event.target.value as typeof language)}
            value={language}
          >
            {supportedLanguages.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="helper-copy">{t("i18n.selectorHint")}</p>
      </Card>

      <Card
        title={t("bank.settingsTitle")}
        subtitle={t("bank.settingsSubtitle")}
      >
        <p className="helper-copy">{t("bank.manualModeHelp")}</p>
        <div className="inline-actions">
          <button
            className="primary-button"
            data-testid="bank-connect-mock"
            disabled={bankSyncStatus.state === "loading"}
            onClick={() => void onConnectMockBank()}
            type="button"
          >
            {bankSyncStatus.state === "loading"
              ? t("bank.working")
              : t("bank.connectMock")}
          </button>
          <button
            className="secondary-button"
            data-testid="bank-sync-all"
            disabled={bankSyncStatus.state === "loading" || bankConnections.length === 0}
            onClick={onSyncAll}
            type="button"
          >
            {t("bank.syncAll")}
          </button>
        </div>
        <StatusMessage status={bankSyncStatus} />
      </Card>

      <Card
        title={t("bank.connectionsTitle")}
        subtitle={t("bank.settingsSubtitle")}
      >
        <ResourceBody
          emptyDescription={t("bank.empty")}
          errorDetails={t("bank.errorDetails")}
          itemsCount={bankConnections.length}
          loadError={loadError}
          onRetry={onRetry}
          state={bankConnectionsState}
        >
          <ul className="data-list" data-testid="bank-connections-list">
            {bankConnections.map((connection) => (
              <li key={connection.id} className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{connection.institution_name}</strong>
                    <p>
                      {t(
                        connection.linked_accounts === 1
                          ? "bank.linkedAccounts"
                          : "bank.linkedAccounts_plural",
                        { count: connection.linked_accounts }
                      )}{" "}
                      ·{" "}
                      {connection.last_sync_at
                        ? t("bank.lastSync", {
                            date: formatDate(connection.last_sync_at)
                          })
                        : t("bank.notSyncedYet")}
                    </p>
                  </div>
                  <span
                    className={
                      connection.status === "active"
                        ? "status-tag"
                        : "status-tag status-tag--muted"
                    }
                  >
                    {formatConnectionStatus(connection.status)}
                  </span>
                </div>
                <div className="list-actions">
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => onSyncConnection(connection.id)}
                    type="button"
                  >
                    {t("bank.syncOne")}
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    onClick={() => void onDeleteConnection(connection.id)}
                    type="button"
                  >
                    {t("bank.disconnect")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>

      <Card
        title={t("bank.howItWorksTitle")}
        subtitle={t("bank.howItWorksSubtitle")}
      >
        <section className="metric-grid">
          <MetricCard
            label={t("bank.provider")}
            value={t("bank.providerValue")}
          />
          <MetricCard
            label={t("bank.credentials")}
            value={t("bank.credentialsValue")}
          />
          <MetricCard
            label={t("bank.importMode")}
            value={t("bank.importModeValue")}
          />
          <MetricCard
            label={t("bank.fallback")}
            value={t("bank.fallbackValue")}
          />
        </section>
      </Card>
    </>
  );
}

function sourceTagClassName(source: string) {
  return source === "bank_import"
    ? "status-tag status-tag--info"
    : "status-tag status-tag--muted";
}

function ResourceBody(props: {
  state: AsyncState;
  itemsCount: number;
  loadError: string | null;
  emptyDescription: string;
  errorDetails: string;
  onRetry: () => Promise<void>;
  children: ReactNode;
}) {
  const { children, emptyDescription, errorDetails, itemsCount, loadError, onRetry, state } =
    props;
  const { t } = useI18n();

  if (state === "loading") {
    return <LoadingState label={t("common.loadingRecords")} />;
  }

  if (state === "error") {
    return (
      <ErrorState
        actionLabel={t("common.retry")}
        details={errorDetails}
        message={loadError ?? t("status.errorDefault")}
        onAction={() => void onRetry()}
      />
    );
  }

  if (state === "success" && itemsCount === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return <>{children}</>;
}

function CoachCard(props: {
  title: string;
  subtitle: string;
  state: AsyncState;
  error: string | null;
  narrative: CoachNarrativeView | null;
  onRetry?: () => void;
}) {
  const { error, narrative, onRetry, state, subtitle, title } = props;
  const { t } = useI18n();

  return (
    <Card title={title} subtitle={subtitle}>
      {state === "loading" ? (
        <LoadingState label={t("coach.loading")} />
      ) : state === "error" ? (
        <ErrorState
          actionLabel={onRetry ? t("common.retry") : undefined}
          message={error ?? t("coach.genericError")}
          onAction={onRetry}
        />
      ) : narrative ? (
        <div className="coach-panel">
          <p className="coach-summary">{narrative.summary}</p>
          <div className="coach-badge-row">
            <span className="status-tag status-tag--muted">
              {t("coach.badge", { source: narrative.source })}
            </span>
            <span className="status-tag status-tag--muted">
              {t("common.modelVersion", { version: narrative.modelVersion })}
            </span>
          </div>

          <section className="coach-section">
            <h3>{t("coach.why")}</h3>
            <ul className="reason-list">
              {narrative.why.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="coach-section">
            <h3>{t("coach.whatChanged")}</h3>
            <ul className="reason-list">
              {narrative.whatChanged.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="coach-section">
            <h3>{t("coach.nextSteps")}</h3>
            <ul className="reason-list">
              {narrative.nextSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <EmptyState description={t("coach.cardEmpty")} />
      )}
    </Card>
  );
}

function MetricCard(props: { label: string; value: string; testId?: string }) {
  const { label, testId, value } = props;

  return (
    <article className="metric-card" data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function LoadingState(props: { label: string }) {
  return (
    <div className="status-block">
      <div aria-hidden="true" className="status-spinner" />
      <p>{props.label}</p>
    </div>
  );
}

function ErrorState(props: {
  message: string;
  details?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { actionLabel, details, message, onAction } = props;

  return (
    <div className="status-block status-block--error">
      <p>{message}</p>
      {details ? <p className="status-block__details">{details}</p> : null}
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function EmptyState(props: {
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { actionLabel, description, onAction } = props;

  return (
    <div className="status-block">
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="secondary-button" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function AuthScreen(props: {
  mode: AuthMode;
  form: typeof initialAuthForm;
  status: FormStatus;
  onModeChange: (mode: AuthMode) => void;
  onFormChange: Dispatch<SetStateAction<typeof initialAuthForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { form, mode, onFormChange, onModeChange, onSubmit, status } = props;
  const { t } = useI18n();

  return (
    <main className="app-shell">
      <div className="ambient ambient--top" />
      <div className="ambient ambient--bottom" />

      <section className="hero-panel hero-panel--auth">
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("auth.heroTitle")}</h1>
        <p className="lede">{t("auth.heroDescription")}</p>
      </section>

      <section className="screen-stack screen-stack--single">
        <Card
          title={mode === "register" ? t("auth.createAccount") : t("auth.welcomeBack")}
          subtitle={
            mode === "register"
              ? t("auth.startWorkspace")
              : t("auth.pickUpToday")
          }
        >
          <div className="auth-toggle">
            <button
              className={mode === "register" ? "primary-button auth-toggle__button" : "secondary-button auth-toggle__button"}
              onClick={() => onModeChange("register")}
              type="button"
            >
              {t("auth.register")}
            </button>
            <button
              className={mode === "login" ? "primary-button auth-toggle__button" : "secondary-button auth-toggle__button"}
              onClick={() => onModeChange("login")}
              type="button"
            >
              {t("auth.login")}
            </button>
          </div>

          <form className="stack-form" data-testid="auth-form" onSubmit={(event) => void onSubmit(event)}>
            {mode === "register" ? (
              <label className="field">
                <span>{t("auth.name")}</span>
                <input
                  autoComplete="name"
                  onChange={(event) =>
                    onFormChange((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder={t("auth.namePlaceholder")}
                  value={form.name}
                />
              </label>
            ) : null}

            <label className="field">
              <span>{t("auth.email")}</span>
              <input
                autoComplete="email"
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    email: event.target.value
                  }))
                }
                placeholder={t("auth.emailPlaceholder")}
                type="email"
                value={form.email}
              />
            </label>

            <label className="field">
              <span>{t("auth.password")}</span>
              <input
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    password: event.target.value
                  }))
                }
                placeholder={t("auth.passwordPlaceholder")}
                type="password"
                value={form.password}
              />
            </label>

            <button className="primary-button" disabled={status.state === "loading"} type="submit">
              {status.state === "loading"
                ? mode === "register"
                  ? t("auth.creating")
                  : t("auth.signingIn")
                : mode === "register"
                  ? t("auth.createAccount")
                  : t("auth.login")}
            </button>
            <StatusMessage status={status} />
          </form>
        </Card>
      </section>
    </main>
  );
}

function StatusMessage(props: { status: FormStatus }) {
  if (!props.status.message) {
    return null;
  }

  return (
    <p
      className={
        props.status.state === "error" ? "feedback feedback--error" : "feedback"
      }
      role="status"
    >
      {props.status.message}
    </p>
  );
}
