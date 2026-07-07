import {
  startTransition,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction
} from "react";
import { Card } from "@moneypulse/ui";

import {
  api,
  type Account,
  type BeforeYouBuyResponse,
  type Goal,
  type GoalKind,
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
  const [todayError, setTodayError] = useState<string | null>(null);
  const [today, setToday] = useState<TodayResponse | null>(null);

  const [accountsState, setAccountsState] = useState<AsyncState>("loading");
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [transactionsState, setTransactionsState] = useState<AsyncState>("loading");
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [goalsState, setGoalsState] = useState<AsyncState>("loading");
  const [goals, setGoals] = useState<Goal[]>([]);

  const [buyStatus, setBuyStatus] = useState<FormStatus>({ state: "idle", message: null });
  const [buyResult, setBuyResult] = useState<BeforeYouBuyResponse | null>(null);

  const [accountStatus, setAccountStatus] = useState<FormStatus>({ state: "idle", message: null });
  const [transactionStatus, setTransactionStatus] = useState<FormStatus>({ state: "idle", message: null });
  const [goalStatus, setGoalStatus] = useState<FormStatus>({ state: "idle", message: null });

  const [accountForm, setAccountForm] = useState(initialAccountForm);
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [goalForm, setGoalForm] = useState(initialGoalForm);
  const [buyForm, setBuyForm] = useState(initialBuyForm);

  async function loadAllData(): Promise<void> {
    setTodayState("loading");
    setAccountsState("loading");
    setTransactionsState("loading");
    setGoalsState("loading");
    setTodayError(null);

    try {
      const [todayResponse, accountsResponse, transactionsResponse, goalsResponse] =
        await Promise.all([
          api.getToday(),
          api.listAccounts(),
          api.listTransactions(),
          api.listGoals()
        ]);

      setToday(todayResponse);
      setAccounts(accountsResponse);
      setTransactions(transactionsResponse);
      setGoals(goalsResponse);

      setTodayState("success");
      setAccountsState("success");
      setTransactionsState("success");
      setGoalsState("success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load MoneyPulse.";

      setTodayError(message);
      setTodayState("error");
      setAccountsState("error");
      setTransactionsState("error");
      setGoalsState("error");
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  useEffect(() => {
    window.location.hash = activeScreen;
  }, [activeScreen]);

  const moneySummary = {
    currency: today?.currency ?? accounts[0]?.currency ?? defaultCurrency,
    totalBalance: accounts.reduce((sum, account) => sum + account.balance, 0),
    totalIncome: transactions
      .filter((transaction) => transaction.direction === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
    totalExpenses: transactions
      .filter((transaction) => transaction.direction === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  };

  const goalSummary = {
    currency: today?.currency ?? goals[0]?.currency ?? defaultCurrency,
    totalTargets: goals.reduce((sum, goal) => sum + goal.target_amount, 0),
    totalReserved: goals.reduce((sum, goal) => sum + goal.reserved_amount, 0),
    totalPlanned: goals.reduce(
      (sum, goal) => sum + goal.planned_contribution,
      0
    )
  };

  const nextCheckpoint =
    transactions
      .filter(
        (transaction) =>
          transaction.effective_date >= new Date().toISOString().slice(0, 10)
      )
      .sort((left, right) => left.effective_date.localeCompare(right.effective_date))[0] ??
    null;

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountStatus({ state: "loading", message: null });

    try {
      await api.createAccount({
        name: accountForm.name.trim(),
        balance: Number(accountForm.balance),
        currency: accountForm.currency.trim().toUpperCase()
      });

      setAccountForm(initialAccountForm);
      setAccountStatus({ state: "success", message: "Account added." });
      await loadAllData();
    } catch (error) {
      setAccountStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not save account."
      });
    }
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTransactionStatus({ state: "loading", message: null });

    try {
      await api.createTransaction({
        name: transactionForm.name.trim(),
        amount: Number(transactionForm.amount),
        currency: transactionForm.currency.trim().toUpperCase(),
        direction: transactionForm.direction,
        category:
          transactionForm.direction === "expense" ? transactionForm.category : undefined,
        effective_date: transactionForm.effectiveDate
      });

      setTransactionForm(initialTransactionForm);
      setTransactionStatus({ state: "success", message: "Transaction added." });
      await loadAllData();
    } catch (error) {
      setTransactionStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not save transaction."
      });
    }
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalStatus({ state: "loading", message: null });

    try {
      await api.createGoal({
        name: goalForm.name.trim(),
        target_amount: Number(goalForm.targetAmount || 0),
        planned_contribution: Number(goalForm.plannedContribution || 0),
        reserved_amount: Number(goalForm.reservedAmount || 0),
        currency: goalForm.currency.trim().toUpperCase(),
        kind: goalForm.kind
      });

      setGoalForm(initialGoalForm);
      setGoalStatus({ state: "success", message: "Goal saved." });
      await loadAllData();
    } catch (error) {
      setGoalStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Could not save goal."
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

  function jumpToScreen(screen: Screen) {
    startTransition(() => {
      setActiveScreen(screen);
    });
  }

  const hasFinancialContext =
    accounts.length > 0 || transactions.length > 0 || goals.length > 0;

  return (
    <main className="app-shell">
      <div className="ambient ambient--top" />
      <div className="ambient ambient--bottom" />

      <section className="hero-panel">
        <p className="eyebrow">MoneyPulse MVP</p>
        <h1>Know tomorrow. Decide today.</h1>
        <p className="lede">
          A mobile-first financial command center for daily clarity, purchase
          checks, and goal-aware spending.
        </p>
      </section>

      <section className="screen-stack">
        {activeScreen === "today" ? (
          <TodayScreen
            hasFinancialContext={hasFinancialContext}
            onRefresh={loadAllData}
            onJumpToBuy={() => jumpToScreen("buy")}
            onJumpToMoney={() => jumpToScreen("money")}
            onJumpToGoals={() => jumpToScreen("goals")}
            nextCheckpoint={nextCheckpoint}
            state={todayState}
            error={todayError}
            today={today}
          />
        ) : null}

        {activeScreen === "buy" ? (
          <BeforeYouBuyScreen
            hasFinancialContext={hasFinancialContext}
            form={buyForm}
            onBackToToday={() => jumpToScreen("today")}
            onJumpToMoney={() => jumpToScreen("money")}
            onFormChange={setBuyForm}
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
            moneySummary={moneySummary}
            onAccountFormChange={setAccountForm}
            onCreateAccount={handleCreateAccount}
            onCreateTransaction={handleCreateTransaction}
            transactionForm={transactionForm}
            transactionStatus={transactionStatus}
            transactions={transactions}
            transactionsState={transactionsState}
            onTransactionFormChange={setTransactionForm}
            onRetry={loadAllData}
            loadError={todayError}
          />
        ) : null}

        {activeScreen === "goals" ? (
          <GoalsScreen
            form={goalForm}
            goalStatus={goalStatus}
            goals={goals}
            goalsState={goalsState}
            summary={goalSummary}
            onFormChange={setGoalForm}
            onSubmit={handleCreateGoal}
            onRetry={loadAllData}
            loadError={todayError}
          />
        ) : null}

        {activeScreen === "insights" ? (
          <InsightsScreen
            goals={goals}
            hasFinancialContext={hasFinancialContext}
            loadError={todayError}
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
            <span className="nav-item__icon" aria-hidden="true">
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
  nextCheckpoint: Transaction | null;
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
        subtitle="The first answer appears as soon as you add accounts, commitments, and goals."
      >
        <EmptyState
          actionLabel="Add money context"
          description="Start with an account or a commitment so MoneyPulse can explain what feels safe today."
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
              ? `${formatDate(nextCheckpoint.effective_date)} · ${formatCurrency(
                  nextCheckpoint.amount,
                  nextCheckpoint.currency
                )}`
              : "No upcoming checkpoint"
          }
        />
      </section>

      <Card
        title="What happens next?"
        subtitle="MoneyPulse answers better when accounts, obligations, and goals stay current."
      >
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
              Add at least one account, transaction, or goal in Money and Goals so
              the backend can evaluate the purchase with real context.
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
          <EmptyState
            description="Run a purchase check to see if the item is safe, tight, or something to hold."
          />
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
  loadError: string | null;
  moneySummary: {
    currency: string;
    totalBalance: number;
    totalIncome: number;
    totalExpenses: number;
  };
  accountForm: typeof initialAccountForm;
  transactionForm: typeof initialTransactionForm;
  onAccountFormChange: Dispatch<SetStateAction<typeof initialAccountForm>>;
  onTransactionFormChange: Dispatch<SetStateAction<typeof initialTransactionForm>>;
  onCreateAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateTransaction: (
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;
  onRetry: () => Promise<void>;
  accountStatus: FormStatus;
  transactionStatus: FormStatus;
}) {
  const {
    accountForm,
    accountStatus,
    accounts,
    accountsState,
    loadError,
    moneySummary,
    onAccountFormChange,
    onCreateAccount,
    onCreateTransaction,
    onTransactionFormChange,
    onRetry,
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
          label="Income today"
          value={formatCurrency(moneySummary.totalIncome, moneySummary.currency)}
        />
        <MetricCard
          label="Expenses today"
          value={formatCurrency(moneySummary.totalExpenses, moneySummary.currency)}
        />
      </section>

      <Card title="Accounts" subtitle="Every balance shown here feeds the Today answer.">
        <form
          className="stack-form"
          data-testid="account-form"
          onSubmit={(event) => void onCreateAccount(event)}
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
          <button className="primary-button" type="submit">
            Add account
          </button>
          {accountStatus.message ? (
            <p
              className={
                accountStatus.state === "error"
                  ? "feedback feedback--error"
                  : "feedback"
              }
            >
              {accountStatus.message}
            </p>
          ) : null}
        </form>

        {accountsState === "loading" ? <LoadingState label="Loading accounts..." /> : null}
        {accountsState === "error" ? (
          <ErrorState
            actionLabel="Retry"
            details="Make sure the backend is running and the frontend API settings are correct."
            message={loadError ?? "Accounts could not be loaded right now."}
            onAction={() => void onRetry()}
          />
        ) : null}
        {accountsState === "success" && accounts.length === 0 ? (
          <EmptyState description="No accounts yet. Add one to give MoneyPulse a starting balance." />
        ) : null}
        {accounts.length > 0 ? (
          <ul className="data-list" data-testid="accounts-list">
            {accounts.map((account) => (
              <li key={account.id} className="data-list__item">
                <div>
                  <strong>{account.name}</strong>
                  <p>{formatDate(account.created_at)}</p>
                </div>
                <span>{formatCurrency(account.balance, account.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card
        title="Transactions"
        subtitle="Add today's obligations and income so the decision engine sees what happens next."
      >
        <form
          className="stack-form"
          data-testid="transaction-form"
          onSubmit={(event) => void onCreateTransaction(event)}
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
          <button className="primary-button" type="submit">
            Add transaction
          </button>
          {transactionStatus.message ? (
            <p
              className={
                transactionStatus.state === "error"
                  ? "feedback feedback--error"
                  : "feedback"
              }
            >
              {transactionStatus.message}
            </p>
          ) : null}
        </form>

        {transactionsState === "loading" ? (
          <LoadingState label="Loading transactions..." />
        ) : null}
        {transactionsState === "error" ? (
          <ErrorState
            actionLabel="Retry"
            details="The transaction feed is empty until the API responds with real records."
            message={loadError ?? "Transactions could not be loaded right now."}
            onAction={() => void onRetry()}
          />
        ) : null}
        {transactionsState === "success" && transactions.length === 0 ? (
          <EmptyState description="No transactions yet. Add essentials, commitments, or expected income for today." />
        ) : null}
        {transactions.length > 0 ? (
          <ul className="data-list" data-testid="transactions-list">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="data-list__item">
                <div>
                  <strong>{transaction.name}</strong>
                  <p>
                    {formatDate(transaction.effective_date)} · {transaction.direction}
                    {transaction.category ? ` · ${transaction.category}` : ""}
                  </p>
                </div>
                <span>{formatCurrency(transaction.amount, transaction.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
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
  onFormChange: Dispatch<SetStateAction<typeof initialGoalForm>>;
  onRetry: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const { form, goalStatus, goals, goalsState, loadError, onFormChange, onRetry, onSubmit, summary } = props;

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
          <button className="primary-button" type="submit">
            Save goal
          </button>
          {goalStatus.message ? (
            <p
              className={
                goalStatus.state === "error" ? "feedback feedback--error" : "feedback"
              }
            >
              {goalStatus.message}
            </p>
          ) : null}
        </form>

        {goalsState === "loading" ? <LoadingState label="Loading goals..." /> : null}
        {goalsState === "error" ? (
          <ErrorState
            actionLabel="Retry"
            details="Goals are loaded from the backend so Today and Before You Buy can include future tradeoffs."
            message={loadError ?? "Goals could not be loaded right now."}
            onAction={() => void onRetry()}
          />
        ) : null}
        {goalsState === "success" && goals.length === 0 ? (
          <EmptyState description="No goals yet. Add one to show how today affects the future." />
        ) : null}
        {goals.length > 0 ? (
          <ul className="data-list" data-testid="goals-list">
            {goals.map((goal) => (
              <li key={goal.id} className="data-list__item">
                <div>
                  <strong>{goal.name}</strong>
                  <p>{goal.kind === "safety_buffer" ? "Safety buffer" : "Goal"}</p>
                </div>
                <span>{formatCurrency(goal.target_amount, goal.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
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
  nextCheckpoint: Transaction | null;
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
            label="Upcoming checkpoint"
            value={
              nextCheckpoint
                ? `${formatDate(nextCheckpoint.effective_date)} · ${nextCheckpoint.name}`
                : "Nothing scheduled"
            }
          />
          <MetricCard
            label="Goal count"
            value={`${goals.filter((goal) => goal.kind === "goal").length} active`}
          />
          <MetricCard
            label="Current answer"
            value={formatCurrency(today.available_to_spend_today, today.currency)}
          />
        </section>
      ) : (
        <EmptyState
          actionLabel={loadError ? "Go to Money" : undefined}
          description={
            loadError
              ? loadError
              : "Insights will light up after you add a bit of financial context."
          }
          onAction={loadError ? onJumpToMoney : undefined}
        />
      )}
    </Card>
  );
}

function MetricCard(props: { label: string; value: string; testId?: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong data-testid={props.testId}>{props.value}</strong>
    </article>
  );
}

function LoadingState(props: { label: string }) {
  return (
    <div className="status-block" role="status">
      <div className="status-spinner" aria-hidden="true" />
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
  return (
    <div className="status-block status-block--error">
      <p>{props.message}</p>
      {props.details ? <p className="status-block__details">{props.details}</p> : null}
      {props.actionLabel && props.onAction ? (
        <button className="secondary-button" onClick={props.onAction} type="button">
          {props.actionLabel}
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
  return (
    <div className="status-block status-block--empty">
      <p>{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button className="secondary-button" onClick={props.onAction} type="button">
          {props.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
