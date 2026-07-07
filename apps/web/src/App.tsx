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
  type Account,
  type BeforeYouBuyResponse,
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
import { formatCurrency, formatDate, formatDecisionLabel } from "./lib/format";

type Screen = "today" | "buy" | "money" | "goals" | "insights";
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

const navItems: Array<{ id: Screen; label: string; icon: string }> = [
  { id: "today", label: "Today", icon: "◉" },
  { id: "buy", label: "Buy", icon: "◎" },
  { id: "money", label: "Money", icon: "◌" },
  { id: "goals", label: "Goals", icon: "◍" },
  { id: "insights", label: "Insights", icon: "◐" }
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

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>(() => {
    const hash = window.location.hash.replace("#", "");

    return navItems.some((item) => item.id === hash)
      ? (hash as Screen)
      : "today";
  });

  const [todayState, setTodayState] = useState<AsyncState>("loading");
  const [accountsState, setAccountsState] = useState<AsyncState>("loading");
  const [transactionsState, setTransactionsState] = useState<AsyncState>("loading");
  const [recurringEventsState, setRecurringEventsState] = useState<AsyncState>("loading");
  const [goalsState, setGoalsState] = useState<AsyncState>("loading");

  const [loadError, setLoadError] = useState<string | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

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

  const [buyResult, setBuyResult] = useState<BeforeYouBuyResponse | null>(null);

  const [accountForm, setAccountForm] = useState(initialAccountForm);
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [recurringEventForm, setRecurringEventForm] = useState(initialRecurringEventForm);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [buyForm, setBuyForm] = useState(initialBuyForm);

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editingRecurringEventId, setEditingRecurringEventId] = useState<number | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);

  async function loadAllData(): Promise<void> {
    setTodayState("loading");
    setAccountsState("loading");
    setTransactionsState("loading");
    setRecurringEventsState("loading");
    setGoalsState("loading");
    setLoadError(null);

    try {
      const [
        todayResponse,
        accountsResponse,
        transactionsResponse,
        recurringEventsResponse,
        goalsResponse
      ] = await Promise.all([
        api.getToday(),
        api.listAccounts(),
        api.listTransactions(),
        api.listRecurringEvents(),
        api.listGoals()
      ]);

      setToday(todayResponse);
      setAccounts(accountsResponse);
      setTransactions(transactionsResponse);
      setRecurringEvents(recurringEventsResponse);
      setGoals(goalsResponse);

      setTodayState("success");
      setAccountsState("success");
      setTransactionsState("success");
      setRecurringEventsState("success");
      setGoalsState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load MoneyPulse.";

      setLoadError(message);
      setTodayState("error");
      setAccountsState("error");
      setTransactionsState("error");
      setRecurringEventsState("error");
      setGoalsState("error");
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  useEffect(() => {
    window.location.hash = activeScreen;
  }, [activeScreen]);

  const hasFinancialContext =
    accounts.length > 0 ||
    transactions.length > 0 ||
    recurringEvents.length > 0 ||
    goals.length > 0;

  const moneySummary = {
    currency: today?.currency ?? accounts[0]?.currency ?? defaultCurrency,
    totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
    totalIncome: transactions
      .filter((transaction) => transaction.direction === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    totalExpenses: transactions
      .filter((transaction) => transaction.direction === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    activeRecurring: recurringEvents.filter((recurringEvent) => recurringEvent.active).length
  };

  const goalSummary = {
    currency: today?.currency ?? goals[0]?.currency ?? defaultCurrency,
    totalTargets: goals.reduce((sum, goal) => sum + goal.target_amount, 0),
    totalReserved: goals.reduce((sum, goal) => sum + goal.reserved_amount, 0),
    totalPlanned: goals.reduce((sum, goal) => sum + goal.planned_contribution, 0)
  };

  const nextCheckpoint =
    transactions
      .filter(
        (transaction) =>
          transaction.effective_date >= new Date().toISOString().slice(0, 10)
      )
      .sort((left, right) => left.effective_date.localeCompare(right.effective_date))
      .map<ScheduledCheckpoint>((transaction) => ({
        date: transaction.effective_date,
        amount: transaction.amount,
        currency: transaction.currency,
        label: transaction.name
      }))[0] ?? null;

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
        message: editingAccountId === null ? "Account added." : "Account updated."
      });
      await loadAllData();
    } catch (error) {
      setAccountStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not save account."
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

      setAccountStatus({ state: "success", message: "Account deleted." });
      await loadAllData();
    } catch (error) {
      setAccountStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not delete account."
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
            ? "Transaction added."
            : "Transaction updated."
      });
      await loadAllData();
    } catch (error) {
      setTransactionStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not save transaction."
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

      setTransactionStatus({ state: "success", message: "Transaction deleted." });
      await loadAllData();
    } catch (error) {
      setTransactionStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not delete transaction."
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
            ? "Recurring event added."
            : "Recurring event updated."
      });
      await loadAllData();
    } catch (error) {
      setRecurringEventStatus({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not save recurring event."
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
        message: "Recurring event deleted."
      });
      await loadAllData();
    } catch (error) {
      setRecurringEventStatus({
        state: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not delete recurring event."
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
        message: editingGoalId === null ? "Goal saved." : "Goal updated."
      });
      await loadAllData();
    } catch (error) {
      setGoalStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not save goal."
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

      setGoalStatus({ state: "success", message: "Goal deleted." });
      await loadAllData();
    } catch (error) {
      setGoalStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not delete goal."
      });
    }
  }

  async function handleBeforeYouBuy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuyStatus({ state: "loading", message: null });

    try {
      const response = await api.evaluateBeforeYouBuy({
        amount: Number(buyForm.amount),
        currency: buyForm.currency.trim().toUpperCase(),
        description: buyForm.description.trim() || undefined
      });

      setBuyResult(response);
      setBuyStatus({ state: "success", message: null });
    } catch (error) {
      setBuyStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not evaluate purchase."
      });
      setBuyResult(null);
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

  return (
    <main className="app-shell">
      <div className="ambient ambient--top" />
      <div className="ambient ambient--bottom" />

      <section className="hero-panel">
        <p className="eyebrow">MoneyPulse MVP</p>
        <h1>Know tomorrow. Decide today.</h1>
        <p className="lede">
          A mobile-first financial command center for daily clarity, purchase
          checks, and future-aware spending.
        </p>
      </section>

      <section className="screen-stack">
        {activeScreen === "today" ? (
          <TodayScreen
            error={loadError}
            hasFinancialContext={hasFinancialContext}
            nextCheckpoint={nextCheckpoint}
            onJumpToBuy={() => jumpToScreen("buy")}
            onJumpToGoals={() => jumpToScreen("goals")}
            onJumpToMoney={() => jumpToScreen("money")}
            onRefresh={loadAllData}
            state={todayState}
            today={today}
          />
        ) : null}

        {activeScreen === "buy" ? (
          <BeforeYouBuyScreen
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
          <InsightsScreen
            goals={goals}
            hasFinancialContext={hasFinancialContext}
            loadError={loadError}
            onJumpToMoney={() => jumpToScreen("money")}
            nextCheckpoint={nextCheckpoint}
            today={today}
            transactions={transactions}
          />
        ) : null}
      </section>

      <nav aria-label="Primary" className="bottom-nav">
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
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function TodayScreen(props: {
  state: AsyncState;
  error: string | null;
  today: TodayResponse | null;
  hasFinancialContext: boolean;
  nextCheckpoint: ScheduledCheckpoint | null;
  onRefresh: () => Promise<void>;
  onJumpToBuy: () => void;
  onJumpToMoney: () => void;
  onJumpToGoals: () => void;
}) {
  const {
    error,
    hasFinancialContext,
    nextCheckpoint,
    onJumpToBuy,
    onJumpToGoals,
    onJumpToMoney,
    onRefresh,
    state,
    today
  } = props;

  if (state === "loading") {
    return (
      <Card title="Today" subtitle="Checking your latest financial context.">
        <LoadingState label="Building today's briefing..." />
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card title="Today" subtitle="MoneyPulse could not reach the API.">
        <ErrorState
          actionLabel="Retry"
          message={error ?? "Something went wrong while loading today."}
          onAction={() => void onRefresh()}
        />
      </Card>
    );
  }

  if (!hasFinancialContext || !today) {
    return (
      <Card
        title="Today"
        subtitle="The first answer appears as soon as you add accounts, obligations, or goals."
      >
        <EmptyState
          actionLabel="Add money context"
          description="Start with an account, a planned transaction, or a recurring event so MoneyPulse can explain what feels safe today."
          onAction={onJumpToMoney}
        />
        <div className="inline-actions">
          <button className="secondary-button" onClick={onJumpToGoals} type="button">
            Add a goal
          </button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Today"
        subtitle="Your daily affordability briefing from the backend decision engine."
      >
        <div className="today-amount">
          <span>Available to Spend</span>
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
          {today.explanations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="inline-actions">
          <button className="primary-button" onClick={onJumpToBuy} type="button">
            Before You Buy
          </button>
          <button className="secondary-button" onClick={() => void onRefresh()} type="button">
            Refresh
          </button>
        </div>
      </Card>

      <section className="metric-grid">
        <MetricCard
          label="Available balance"
          value={formatCurrency(today.inputs.available_balance, today.currency)}
        />
        <MetricCard
          label="Essential obligations"
          value={formatCurrency(today.inputs.essential_obligations, today.currency)}
        />
        <MetricCard
          label="Committed spending"
          value={formatCurrency(today.inputs.committed_spending, today.currency)}
        />
        <MetricCard
          label="Goal contribution"
          value={formatCurrency(today.inputs.planned_goal_contribution, today.currency)}
        />
        <MetricCard
          label="Confidence"
          value={`${today.confidence.mode} · ${today.confidence.input_completeness}`}
        />
        <MetricCard
          label="Next checkpoint"
          testId="today-next-checkpoint"
          value={
            nextCheckpoint
              ? `${formatDate(nextCheckpoint.date)} · ${formatCurrency(
                  nextCheckpoint.amount,
                  nextCheckpoint.currency
                )}`
              : "No upcoming checkpoint"
          }
        />
      </section>

      <Card
        title="What happens next?"
        subtitle="The more current your balances and obligations are, the more useful Today becomes."
      >
        <div className="schedule-chip">
          <strong>{nextCheckpoint ? nextCheckpoint.label : "No upcoming item"}</strong>
          <span>
            {nextCheckpoint
              ? `${formatDate(nextCheckpoint.date)} · ${formatCurrency(
                  nextCheckpoint.amount,
                  nextCheckpoint.currency
                )}`
              : "Add a planned transaction to see the next checkpoint here."}
          </span>
        </div>
        <div className="inline-actions">
          <button className="secondary-button" onClick={onJumpToMoney} type="button">
            Review money
          </button>
          <button className="secondary-button" onClick={onJumpToGoals} type="button">
            Review goals
          </button>
        </div>
      </Card>
    </>
  );
}

function BeforeYouBuyScreen(props: {
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
    form,
    hasFinancialContext,
    onBackToToday,
    onJumpToMoney,
    onFormChange,
    onSubmit,
    result,
    status
  } = props;

  return (
    <>
      <Card
        title="Before You Buy"
        subtitle="Simulate a purchase before money leaves the account."
      >
        <form
          className="stack-form"
          data-testid="buy-form"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="field">
            <span>Item</span>
            <input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              placeholder="Trainers, trip, dinner..."
              value={form.description}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Price</span>
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
              <span>Currency</span>
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
            {status.state === "loading" ? "Checking..." : "Check this purchase"}
          </button>
          <button className="secondary-button" onClick={onBackToToday} type="button">
            Back to Today
          </button>
        </form>

        {!hasFinancialContext ? (
          <div className="stack-block">
            <p className="helper-copy">
              Add at least one account, transaction, recurring event, or goal so the
              backend can evaluate the purchase with real context.
            </p>
            <button className="secondary-button" onClick={onJumpToMoney} type="button">
              Go to Money
            </button>
          </div>
        ) : null}

        {status.state === "error" && status.message ? (
          <p className="feedback feedback--error">{status.message}</p>
        ) : null}
      </Card>

      {result ? (
        <Card
          title="Decision"
          subtitle="The backend evaluated this purchase against today's financial context."
        >
          <div className="decision-summary" data-testid="buy-decision-summary">
            <div>
              <span>Decision</span>
              <strong data-testid="buy-decision-label">
                {formatDecisionLabel(result.decision)}
              </strong>
            </div>
            <div>
              <span>Remaining after purchase</span>
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
              label="Current headroom"
              value={formatCurrency(result.current_available_to_spend, result.currency)}
            />
            <MetricCard
              label="Purchase amount"
              value={formatCurrency(result.purchase_amount, result.currency)}
            />
            <MetricCard
              label="Change"
              value={formatCurrency(result.delta, result.currency)}
            />
            <MetricCard
              label="Confidence"
              value={`${result.confidence.mode} · ${result.confidence.purchase_context}`}
            />
          </section>

          <ul className="reason-list">
            {result.explanations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {result.alternatives && result.alternatives.length > 0 ? (
            <section className="alternatives-panel">
              <h3>Alternatives</h3>
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
          title="Result"
          subtitle="Your decision card appears here after the first simulation."
        >
          <EmptyState description="Run a purchase check to see if the item is safe, tight, or something to hold." />
        </Card>
      )}
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

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label="Balances"
          value={formatCurrency(moneySummary.totalBalance, moneySummary.currency)}
        />
        <MetricCard
          label="Recorded income"
          value={formatCurrency(moneySummary.totalIncome, moneySummary.currency)}
        />
        <MetricCard
          label="Recorded expenses"
          value={formatCurrency(moneySummary.totalExpenses, moneySummary.currency)}
        />
        <MetricCard
          label="Active recurring"
          value={`${moneySummary.activeRecurring}`}
        />
      </section>

      <Card title="Accounts" subtitle="Every balance shown here feeds the Today answer.">
        <form
          className="stack-form"
          data-testid="account-form"
          onSubmit={(event) => void onSaveAccount(event)}
        >
          <label className="field">
            <span>Account name</span>
            <input
              onChange={(event) =>
                onAccountFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Main account"
              value={accountForm.name}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Balance</span>
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
              <span>Currency</span>
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
              {editingAccountId === null ? "Add account" : "Update account"}
            </button>
            {editingAccountId !== null ? (
              <button className="secondary-button" onClick={resetAccountForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
          <StatusMessage status={accountStatus} />
        </form>

        <ResourceBody
          emptyDescription="No accounts yet. Add one to give MoneyPulse a starting balance."
          errorDetails="Make sure the backend is running and the frontend API settings are correct."
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
                  <span>{formatCurrency(account.balance, account.currency)}</span>
                </div>
                <div className="list-actions">
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`account-edit-${account.id}`}
                    onClick={() => onEditAccount(account)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`account-delete-${account.id}`}
                    onClick={() => void onDeleteAccount(account.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>

      <Card
        title="Transactions"
        subtitle="Add dated obligations and income so the decision engine sees what happens next."
      >
        <form
          className="stack-form"
          data-testid="transaction-form"
          onSubmit={(event) => void onSaveTransaction(event)}
        >
          <label className="field">
            <span>Name</span>
            <input
              onChange={(event) =>
                onTransactionFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Rent, salary, groceries..."
              value={transactionForm.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>Amount</span>
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
              <span>Direction</span>
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
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="field">
              <span>Category</span>
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
                <option value="essential">Essential</option>
                <option value="committed">Committed</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Date</span>
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
              <span>Currency</span>
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
              {editingTransactionId === null ? "Add transaction" : "Update transaction"}
            </button>
            {editingTransactionId !== null ? (
              <button
                className="secondary-button"
                onClick={resetTransactionForm}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
          <StatusMessage status={transactionStatus} />
        </form>

        <ResourceBody
          emptyDescription="No transactions yet. Add essentials, commitments, or expected income."
          errorDetails="The transaction feed is empty until the API responds with real records."
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
                      {formatDate(transaction.effective_date)} · {transaction.direction}
                      {transaction.category ? ` · ${transaction.category}` : ""}
                    </p>
                  </div>
                  <span>{formatCurrency(transaction.amount, transaction.currency)}</span>
                </div>
                <div className="list-actions">
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`transaction-edit-${transaction.id}`}
                    onClick={() => onEditTransaction(transaction)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`transaction-delete-${transaction.id}`}
                    onClick={() => void onDeleteTransaction(transaction.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </ResourceBody>
      </Card>

      <Card
        title="Recurring events"
        subtitle="Track repeated income and obligations that should shape each day automatically."
      >
        <form
          className="stack-form"
          data-testid="recurring-event-form"
          onSubmit={(event) => void onSaveRecurringEvent(event)}
        >
          <label className="field">
            <span>Name</span>
            <input
              onChange={(event) =>
                onRecurringEventFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Salary, gym, subscriptions..."
              value={recurringEventForm.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>Amount</span>
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
              <span>Direction</span>
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
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="field">
              <span>Category</span>
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
                <option value="essential">Essential</option>
                <option value="committed">Committed</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Cadence</span>
              <select
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    cadence: event.target.value as RecurringEventCadence
                  }))
                }
                value={recurringEventForm.cadence}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="field">
              <span>Start date</span>
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
              <span>Currency</span>
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
              <span>Status</span>
              <select
                onChange={(event) =>
                  onRecurringEventFormChange((current) => ({
                    ...current,
                    active: event.target.value === "active"
                  }))
                }
                value={recurringEventForm.active ? "active" : "paused"}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" type="submit">
              {editingRecurringEventId === null
                ? "Add recurring event"
                : "Update recurring event"}
            </button>
            {editingRecurringEventId !== null ? (
              <button
                className="secondary-button"
                onClick={resetRecurringEventForm}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
          <StatusMessage status={recurringEventStatus} />
        </form>

        <ResourceBody
          emptyDescription="No recurring events yet. Add repeated salary, rent, or subscriptions."
          errorDetails="Recurring events come from the backend and feed the daily snapshot."
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
                      {recurringEvent.cadence} · {formatDate(recurringEvent.start_date)}
                      {recurringEvent.category ? ` · ${recurringEvent.category}` : ""}
                    </p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(recurringEvent.amount, recurringEvent.currency)}</span>
                    <span
                      className={
                        recurringEvent.active ? "status-tag" : "status-tag status-tag--muted"
                      }
                    >
                      {recurringEvent.active ? "Active" : "Paused"}
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
                    Edit
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`recurring-event-delete-${recurringEvent.id}`}
                    onClick={() => void onDeleteRecurringEvent(recurringEvent.id)}
                    type="button"
                  >
                    Delete
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

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label="Target value"
          value={formatCurrency(summary.totalTargets, summary.currency)}
        />
        <MetricCard
          label="Reserved now"
          value={formatCurrency(summary.totalReserved, summary.currency)}
        />
        <MetricCard
          label="Planned next"
          value={formatCurrency(summary.totalPlanned, summary.currency)}
        />
      </section>

      <Card title="Goals" subtitle="Goals keep tomorrow visible before you spend today.">
        <form
          className="stack-form"
          data-testid="goal-form"
          onSubmit={(event) => void onSubmit(event)}
        >
          <label className="field">
            <span>Name</span>
            <input
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="Holiday fund, emergency buffer..."
              value={form.name}
            />
          </label>
          <div className="field-grid field-grid--triple">
            <label className="field">
              <span>Target</span>
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
              <span>Planned</span>
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
              <span>Reserved</span>
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
              <span>Kind</span>
              <select
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    kind: event.target.value as GoalKind
                  }))
                }
                value={form.kind}
              >
                <option value="goal">Goal</option>
                <option value="safety_buffer">Safety buffer</option>
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
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
              {editingGoalId === null ? "Save goal" : "Update goal"}
            </button>
            {editingGoalId !== null ? (
              <button className="secondary-button" onClick={resetGoalForm} type="button">
                Cancel
              </button>
            ) : null}
          </div>
          <StatusMessage status={goalStatus} />
        </form>

        <ResourceBody
          emptyDescription="No goals yet. Add one to show how today affects the future."
          errorDetails="Goals are loaded from the backend so Today and Before You Buy can include future tradeoffs."
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
                    <p>{goal.kind === "safety_buffer" ? "Safety buffer" : "Goal"}</p>
                  </div>
                  <div className="data-list__meta">
                    <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
                    <span className="status-tag">
                      {formatCurrency(goal.reserved_amount, goal.currency)} reserved
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
                    Edit
                  </button>
                  <button
                    className="secondary-button secondary-button--small"
                    data-testid={`goal-delete-${goal.id}`}
                    onClick={() => void onDeleteGoal(goal.id)}
                    type="button"
                  >
                    Delete
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

function InsightsScreen(props: {
  hasFinancialContext: boolean;
  loadError: string | null;
  onJumpToMoney: () => void;
  today: TodayResponse | null;
  transactions: Transaction[];
  goals: Goal[];
  nextCheckpoint: ScheduledCheckpoint | null;
}) {
  const {
    goals,
    hasFinancialContext,
    loadError,
    nextCheckpoint,
    onJumpToMoney,
    today,
    transactions
  } = props;

  const largestExpense =
    transactions
      .filter((transaction) => transaction.direction === "expense")
      .sort((left, right) => right.amount - left.amount)[0] ?? null;

  return (
    <Card
      title="Insights"
      subtitle="Useful patterns distilled from your current balances, commitments, and goals."
    >
      {hasFinancialContext && today ? (
        <section className="metric-grid">
          <MetricCard
            label="Today pressure"
            value={formatCurrency(
              today.inputs.essential_obligations + today.inputs.committed_spending,
              today.currency
            )}
          />
          <MetricCard
            label="Protected buffer"
            value={formatCurrency(today.inputs.safety_buffer, today.currency)}
          />
          <MetricCard
            label="Largest expense"
            value={
              largestExpense
                ? `${largestExpense.name} · ${formatCurrency(
                    largestExpense.amount,
                    largestExpense.currency
                  )}`
                : "No expenses yet"
            }
          />
          <MetricCard
            label="Next checkpoint"
            value={
              nextCheckpoint
                ? `${nextCheckpoint.label} · ${formatDate(nextCheckpoint.date)}`
                : "No upcoming checkpoint"
            }
          />
        </section>
      ) : loadError ? (
        <ErrorState
          actionLabel="Go to Money"
          message={loadError}
          onAction={onJumpToMoney}
        />
      ) : (
        <EmptyState
          actionLabel="Start in Money"
          description="Insights become useful once balances, commitments, and goals are in place."
          onAction={onJumpToMoney}
        />
      )}

      {goals.length > 0 ? (
        <p className="insight-placeholder">
          <strong>{goals.length}</strong> goal{goals.length === 1 ? "" : "s"} already
          influence future affordability through the decision engine.
        </p>
      ) : null}
    </Card>
  );
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

  if (state === "loading") {
    return <LoadingState label="Loading latest records..." />;
  }

  if (state === "error") {
    return (
      <ErrorState
        actionLabel="Retry"
        details={errorDetails}
        message={loadError ?? "The latest records could not be loaded right now."}
        onAction={() => void onRetry()}
      />
    );
  }

  if (state === "success" && itemsCount === 0) {
    return <EmptyState description={emptyDescription} />;
  }

  return <>{children}</>;
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

function StatusMessage(props: { status: FormStatus }) {
  if (!props.status.message) {
    return null;
  }

  return (
    <p
      className={
        props.status.state === "error" ? "feedback feedback--error" : "feedback"
      }
    >
      {props.status.message}
    </p>
  );
}
