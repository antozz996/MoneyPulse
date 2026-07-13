import { useMemo, useState, type FormEvent } from "react";
import { Card } from "@moneypulse/ui";

import type {
  Account,
  AccountCreateInput,
  Budget,
  BudgetCreateInput,
  Category,
  Goal,
  GoalCreateInput,
  OnboardingStep,
  OnboardingSummary,
  OnboardingUpdateInput,
  RecurringEvent,
  RecurringEventCreateInput,
} from "./lib/api";
import type { FinancialSnapshot } from "./lib/engine";
import { buildTodayCoachContentFromEngine } from "./lib/localized-copy";
import { useI18n } from "./lib/i18n";

type AsyncState = "idle" | "loading" | "success" | "error";

interface FormStatus {
  state: AsyncState;
  message: string | null;
}

export interface OnboardingScreenProps {
  onboarding: OnboardingSummary | null;
  categories: Category[];
  accounts: Account[];
  recurringEvents: RecurringEvent[];
  goals: Goal[];
  budgets: Budget[];
  engineSnapshot: FinancialSnapshot | null;
  status: FormStatus;
  onUpdate: (payload: OnboardingUpdateInput) => Promise<void>;
  onCreateAccount: (payload: AccountCreateInput) => Promise<void>;
  onCreateRecurringEvent: (payload: RecurringEventCreateInput) => Promise<void>;
  onCreateGoal: (payload: GoalCreateInput) => Promise<void>;
  onCreateBudget: (payload: BudgetCreateInput) => Promise<void>;
  onComplete: () => Promise<void>;
  onSkip: () => Promise<void>;
  onCloseToToday: () => void;
}

const stepOrder: OnboardingStep[] = [
  "basics",
  "accounts",
  "protected_money",
  "income",
  "fixed_commitments",
  "goals",
  "budgets",
  "review",
];

function nextStep(current: OnboardingStep): OnboardingStep {
  const currentIndex = stepOrder.indexOf(current);
  return stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)] ?? "review";
}

function previousStep(current: OnboardingStep): OnboardingStep {
  const currentIndex = stepOrder.indexOf(current);
  return stepOrder[Math.max(currentIndex - 1, 0)] ?? "basics";
}

export function OnboardingScreen(props: OnboardingScreenProps) {
  const { t, formatCurrency, formatDate, formatDecisionLabel } = useI18n();
  const profile = props.onboarding?.profile ?? null;
  const currentStep =
    profile?.onboarding_step && profile.onboarding_step !== "completed"
      ? profile.onboarding_step
      : "basics";
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const incomeRecurring = props.recurringEvents.filter(
    (item) => item.status === "active" && item.direction === "income"
  );
  const expenseRecurring = props.recurringEvents.filter(
    (item) => item.status === "active" && item.direction === "expense"
  );
  const expenseCategories = props.categories.filter(
    (category) => category.entry_type === "expense"
  );
  const coachContent = useMemo(() => {
    if (!props.engineSnapshot) {
      return null;
    }

    return buildTodayCoachContentFromEngine(props.engineSnapshot, {
      t: (key, variables) => t(key as never, variables),
      formatCurrency,
      formatDate,
      formatDecisionLabel,
    });
  }, [formatCurrency, formatDate, formatDecisionLabel, props.engineSnapshot, t]);

  const [basicsForm, setBasicsForm] = useState(() => ({
    currency: profile?.currency ?? "EUR",
    locale: profile?.locale ?? "it-IT",
    cycleMode: profile?.default_cycle_mode ?? "CALENDAR_MONTH",
    salaryDay: profile?.salary_day ? String(profile.salary_day) : "",
  }));
  const [accountForm, setAccountForm] = useState({
    name: t("onboarding.defaults.accountName" as never),
    balance: "",
    currency: profile?.currency ?? "EUR",
  });
  const [protectedBalance, setProtectedBalance] = useState(
    profile?.protected_balance ? String(profile.protected_balance) : "0"
  );
  const [incomeForm, setIncomeForm] = useState<{
    name: string;
    amount: string;
    frequency: "daily" | "weekly" | "monthly";
    nextDueDate: string;
    accountId: string;
  }>(() => ({
    name: t("onboarding.defaults.incomeName" as never),
    amount: "",
    frequency: "monthly" as const,
    nextDueDate: new Date().toISOString().slice(0, 10),
    accountId: props.accounts[0] ? String(props.accounts[0].id) : "",
  }));
  const [commitmentForm, setCommitmentForm] = useState<{
    name: string;
    amount: string;
    frequency: "daily" | "weekly" | "monthly";
    nextDueDate: string;
    accountId: string;
  }>(() => ({
    name: "",
    amount: "",
    frequency: "monthly" as const,
    nextDueDate: new Date().toISOString().slice(0, 10),
    accountId: props.accounts[0] ? String(props.accounts[0].id) : "",
  }));
  const [goalForm, setGoalForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    monthlyContribution: "",
    deadline: "",
  });
  const [budgetForm, setBudgetForm] = useState({
    categoryId: "",
    amount: "",
  });

  if (!props.onboarding || !profile) {
    return (
      <Card
        title={t("onboarding.title" as never)}
        subtitle={t("onboarding.loading" as never)}
      >
        <div className="status-block">
          <div className="status-spinner" />
          <p className="status-block__details">{t("onboarding.loading" as never)}</p>
        </div>
      </Card>
    );
  }

  const resolvedProfile = profile;

  async function saveStep(next: OnboardingStep, patch: OnboardingUpdateInput = {}) {
    await props.onUpdate({
      onboarding_status:
        resolvedProfile.onboarding_status === "completed" ? undefined : "in_progress",
      onboarding_step: next,
      ...patch,
    });
  }

  async function handleBasicsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveStep("accounts", {
      currency: basicsForm.currency.trim().toUpperCase(),
      locale: basicsForm.locale.trim(),
      default_cycle_mode: basicsForm.cycleMode,
      salary_day:
        basicsForm.cycleMode === "SALARY_CYCLE" && basicsForm.salaryDay
          ? Number(basicsForm.salaryDay)
          : null,
      cycle_configured: true,
    });
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accountForm.name.trim() && props.accounts.length > 0) {
      await saveStep("protected_money");
      return;
    }

    await props.onCreateAccount({
      name: accountForm.name.trim(),
      balance: Number(accountForm.balance || "0"),
      currency: accountForm.currency.trim().toUpperCase(),
    });
    setAccountForm((current) => ({
      ...current,
      name: "",
      balance: "",
    }));
    await saveStep("protected_money", {
      zero_balance_declared: false,
    });
  }

  async function handleZeroBalance() {
    await saveStep("protected_money", {
      zero_balance_declared: true,
    });
  }

  async function handleProtectedBalanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveStep("income", {
      protected_balance: Number(protectedBalance || "0"),
      protected_balance_configured: true,
    });
  }

  async function handleIncomeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!incomeForm.amount) {
      await saveStep("fixed_commitments");
      return;
    }

    await props.onCreateRecurringEvent({
      account_id: incomeForm.accountId ? Number(incomeForm.accountId) : undefined,
      name: incomeForm.name.trim() || t("onboarding.defaults.incomeName" as never),
      amount: Number(incomeForm.amount),
      currency: resolvedProfile.currency,
      type: "income",
      direction: "income",
      frequency: incomeForm.frequency,
      cadence: incomeForm.frequency,
      next_due_date: incomeForm.nextDueDate,
      start_date: incomeForm.nextDueDate,
      active: true,
      status: "active",
    });
    setIncomeForm((current) => ({ ...current, amount: "" }));
    await saveStep("fixed_commitments");
  }

  async function handleCommitmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!commitmentForm.name.trim() || !commitmentForm.amount) {
      await saveStep("goals");
      return;
    }

    await props.onCreateRecurringEvent({
      account_id: commitmentForm.accountId ? Number(commitmentForm.accountId) : undefined,
      name: commitmentForm.name.trim(),
      amount: Number(commitmentForm.amount),
      currency: resolvedProfile.currency,
      type: "expense",
      direction: "expense",
      category: "essential",
      frequency: commitmentForm.frequency,
      cadence: commitmentForm.frequency,
      next_due_date: commitmentForm.nextDueDate,
      start_date: commitmentForm.nextDueDate,
      active: true,
      status: "active",
    });
    setCommitmentForm((current) => ({ ...current, name: "", amount: "" }));
    await saveStep("goals");
  }

  async function handleGoalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!goalForm.name.trim()) {
      await saveStep("budgets");
      return;
    }

    await props.onCreateGoal({
      name: goalForm.name.trim(),
      target_amount: Number(goalForm.targetAmount || "0"),
      current_amount: Number(goalForm.currentAmount || "0"),
      monthly_contribution: Number(goalForm.monthlyContribution || "0"),
      priority: "IMPORTANT",
      deadline: goalForm.deadline || null,
      currency: resolvedProfile.currency,
      kind: "goal",
    });
    setGoalForm({
      name: "",
      targetAmount: "",
      currentAmount: "",
      monthlyContribution: "",
      deadline: "",
    });
    await saveStep("budgets");
  }

  async function handleBudgetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!budgetForm.categoryId || !budgetForm.amount) {
      await saveStep("review");
      return;
    }

    await props.onCreateBudget({
      category_id: Number(budgetForm.categoryId),
      amount: Number(budgetForm.amount),
      currency: resolvedProfile.currency,
      period:
        resolvedProfile.default_cycle_mode === "SALARY_CYCLE"
          ? "SALARY_CYCLE"
          : "MONTHLY",
    });
    setBudgetForm({ categoryId: "", amount: "" });
    await saveStep("review");
  }

  async function handleSkipOptionalStep() {
    await saveStep(nextStep(currentStep));
  }

  const completionDisabled = !props.onboarding.can_complete || props.status.state === "loading";

  return (
    <div className="screen-stack screen-stack--single" data-testid="onboarding-screen">
      <Card
        title={t("onboarding.title" as never)}
        subtitle={t("onboarding.subtitle" as never)}
      >
        <div className="onboarding-progress">
          <div>
            <strong>
              {t("onboarding.progress" as never, {
                step: Math.max(currentStepIndex + 1, 1),
                total: stepOrder.length,
              })}
            </strong>
            <p className="helper-copy">
              {t(`onboarding.steps.${currentStep}.description` as never)}
            </p>
          </div>
          <span className="status-tag status-tag--info">
            {resolvedProfile.setup_quality_score}%
          </span>
        </div>
        <div className="onboarding-steps">
          {stepOrder.map((step, index) => (
            <span
              key={step}
              className={
                index <= currentStepIndex
                  ? "onboarding-step onboarding-step--active"
                  : "onboarding-step"
              }
            />
          ))}
        </div>
        {props.status.message ? (
          <p
            className={
              props.status.state === "error" ? "feedback feedback--error" : "feedback"
            }
          >
            {props.status.message}
          </p>
        ) : null}
        {resolvedProfile.missing_setup_fields.length > 0 ? (
          <div className="onboarding-warning">
            <strong>{t("onboarding.missingTitle" as never)}</strong>
            <ul className="reason-list">
              {resolvedProfile.missing_setup_fields.map((field) => (
                <li key={field}>{t(`onboarding.missing.${field}` as never)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="inline-actions">
          <button
            className="secondary-button secondary-button--small"
            onClick={() => void props.onSkip()}
            type="button"
          >
            {t("onboarding.finishLater" as never)}
          </button>
          {currentStepIndex > 0 ? (
            <button
              className="secondary-button secondary-button--small"
              onClick={() => void saveStep(previousStep(currentStep))}
              type="button"
            >
              {t("common.back" as never)}
            </button>
          ) : null}
        </div>
      </Card>

      {currentStep === "basics" ? (
        <Card
          title={t("onboarding.steps.basics.title" as never)}
          subtitle={t("onboarding.steps.basics.copy" as never)}
        >
          <form className="stack-form" onSubmit={(event) => void handleBasicsSubmit(event)}>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.currency" as never)}</span>
                <input
                  onChange={(event) =>
                    setBasicsForm((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                  value={basicsForm.currency}
                />
              </label>
              <label className="field">
                <span>{t("onboarding.locale" as never)}</span>
                <select
                  onChange={(event) =>
                    setBasicsForm((current) => ({
                      ...current,
                      locale: event.target.value,
                    }))
                  }
                  value={basicsForm.locale}
                >
                  <option value="it-IT">Italiano</option>
                  <option value="en-GB">English</option>
                  <option value="fr-FR">Français</option>
                  <option value="es-ES">Español</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>{t("onboarding.cycleMode" as never)}</span>
              <select
                onChange={(event) =>
                  setBasicsForm((current) => ({
                    ...current,
                    cycleMode: event.target.value as "SALARY_CYCLE" | "CALENDAR_MONTH",
                  }))
                }
                value={basicsForm.cycleMode}
              >
                <option value="CALENDAR_MONTH">
                  {t("onboarding.cycle.calendar" as never)}
                </option>
                <option value="SALARY_CYCLE">
                  {t("onboarding.cycle.salary" as never)}
                </option>
              </select>
            </label>
            {basicsForm.cycleMode === "SALARY_CYCLE" ? (
              <label className="field">
                <span>{t("onboarding.salaryDay" as never)}</span>
                <input
                  max="31"
                  min="1"
                  onChange={(event) =>
                    setBasicsForm((current) => ({
                      ...current,
                      salaryDay: event.target.value,
                    }))
                  }
                  type="number"
                  value={basicsForm.salaryDay}
                />
              </label>
            ) : null}
            <button className="primary-button" type="submit">
              {t("common.continue" as never)}
            </button>
          </form>
        </Card>
      ) : null}

      {currentStep === "accounts" ? (
        <Card
          title={t("onboarding.steps.accounts.title" as never)}
          subtitle={t("onboarding.steps.accounts.copy" as never)}
        >
          <form className="stack-form" onSubmit={(event) => void handleAccountSubmit(event)}>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.accountName" as never)}</span>
                <input
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t("money.accountPlaceholder" as never)}
                  value={accountForm.name}
                />
              </label>
              <label className="field">
                <span>{t("money.balance" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      balance: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={accountForm.balance}
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {props.accounts.length > 0
                  ? t("common.continue" as never)
                  : t("onboarding.saveAccount" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void handleZeroBalance()}
                type="button"
              >
                {t("onboarding.zeroBalance" as never)}
              </button>
            </div>
          </form>
          {props.accounts.length > 0 ? (
            <ul className="data-list">
              {props.accounts.map((account) => (
                <li className="data-list__item" key={account.id}>
                  <div className="data-list__content">
                    <div>
                      <strong>{account.name}</strong>
                      <p>{formatCurrency(account.balance, account.currency)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {currentStep === "protected_money" ? (
        <Card
          title={t("onboarding.steps.protected_money.title" as never)}
          subtitle={t("onboarding.steps.protected_money.copy" as never)}
        >
          <form
            className="stack-form"
            onSubmit={(event) => void handleProtectedBalanceSubmit(event)}
          >
            <label className="field">
              <span>{t("onboarding.protectedBalance" as never)}</span>
              <input
                min="0"
                onChange={(event) => setProtectedBalance(event.target.value)}
                step="0.01"
                type="number"
                value={protectedBalance}
              />
            </label>
            <button className="primary-button" type="submit">
              {t("common.continue" as never)}
            </button>
          </form>
        </Card>
      ) : null}

      {currentStep === "income" ? (
        <Card
          title={t("onboarding.steps.income.title" as never)}
          subtitle={t("onboarding.steps.income.copy" as never)}
        >
          <form className="stack-form" onSubmit={(event) => void handleIncomeSubmit(event)}>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.recurringNamePlaceholder" as never)}</span>
                <input
                  onChange={(event) =>
                    setIncomeForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={incomeForm.name}
                />
              </label>
              <label className="field">
                <span>{t("money.amount" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setIncomeForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={incomeForm.amount}
                />
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.cadence" as never)}</span>
                <select
                  onChange={(event) =>
                    setIncomeForm((current) => ({
                      ...current,
                      frequency: event.target.value as "daily" | "weekly" | "monthly",
                    }))
                  }
                  value={incomeForm.frequency}
                >
                  <option value="monthly">{t("money.cadence.monthly" as never)}</option>
                  <option value="weekly">{t("money.cadence.weekly" as never)}</option>
                  <option value="daily">{t("money.cadence.daily" as never)}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("money.nextDueDate" as never)}</span>
                <input
                  onChange={(event) =>
                    setIncomeForm((current) => ({
                      ...current,
                      nextDueDate: event.target.value,
                    }))
                  }
                  type="date"
                  value={incomeForm.nextDueDate}
                />
              </label>
            </div>
            <label className="field">
              <span>{t("money.transactionAccount" as never)}</span>
              <select
                onChange={(event) =>
                  setIncomeForm((current) => ({
                    ...current,
                    accountId: event.target.value,
                  }))
                }
                value={incomeForm.accountId}
              >
                <option value="">{t("onboarding.accountOptional" as never)}</option>
                {props.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {incomeRecurring.length > 0
                  ? t("common.continue" as never)
                  : t("onboarding.saveIncome" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void handleSkipOptionalStep()}
                type="button"
              >
                {t("common.skip" as never)}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === "fixed_commitments" ? (
        <Card
          title={t("onboarding.steps.fixed_commitments.title" as never)}
          subtitle={t("onboarding.steps.fixed_commitments.copy" as never)}
        >
          <form
            className="stack-form"
            onSubmit={(event) => void handleCommitmentSubmit(event)}
          >
            <div className="field-grid">
              <label className="field">
                <span>{t("money.transactionDescription" as never)}</span>
                <input
                  onChange={(event) =>
                    setCommitmentForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder={t("money.namePlaceholder" as never)}
                  value={commitmentForm.name}
                />
              </label>
              <label className="field">
                <span>{t("money.amount" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setCommitmentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={commitmentForm.amount}
                />
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.cadence" as never)}</span>
                <select
                  onChange={(event) =>
                    setCommitmentForm((current) => ({
                      ...current,
                      frequency: event.target.value as "daily" | "weekly" | "monthly",
                    }))
                  }
                  value={commitmentForm.frequency}
                >
                  <option value="monthly">{t("money.cadence.monthly" as never)}</option>
                  <option value="weekly">{t("money.cadence.weekly" as never)}</option>
                  <option value="daily">{t("money.cadence.daily" as never)}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("money.nextDueDate" as never)}</span>
                <input
                  onChange={(event) =>
                    setCommitmentForm((current) => ({
                      ...current,
                      nextDueDate: event.target.value,
                    }))
                  }
                  type="date"
                  value={commitmentForm.nextDueDate}
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {expenseRecurring.length > 0
                  ? t("common.continue" as never)
                  : t("onboarding.saveCommitment" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void handleSkipOptionalStep()}
                type="button"
              >
                {t("common.skip" as never)}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === "goals" ? (
        <Card
          title={t("onboarding.steps.goals.title" as never)}
          subtitle={t("onboarding.steps.goals.copy" as never)}
        >
          <form className="stack-form" onSubmit={(event) => void handleGoalSubmit(event)}>
            <div className="field-grid">
              <label className="field">
                <span>{t("goals.name" as never)}</span>
                <input
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={goalForm.name}
                />
              </label>
              <label className="field">
                <span>{t("goals.target" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      targetAmount: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={goalForm.targetAmount}
                />
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>{t("goals.current" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      currentAmount: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={goalForm.currentAmount}
                />
              </label>
              <label className="field">
                <span>{t("goals.monthlyContribution" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      monthlyContribution: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={goalForm.monthlyContribution}
                />
              </label>
            </div>
            <label className="field">
              <span>{t("goals.deadline" as never)}</span>
              <input
                onChange={(event) =>
                  setGoalForm((current) => ({
                    ...current,
                    deadline: event.target.value,
                  }))
                }
                type="date"
                value={goalForm.deadline}
              />
            </label>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {props.goals.length > 0
                  ? t("common.continue" as never)
                  : t("onboarding.saveGoal" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void handleSkipOptionalStep()}
                type="button"
              >
                {t("common.skip" as never)}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === "budgets" ? (
        <Card
          title={t("onboarding.steps.budgets.title" as never)}
          subtitle={t("onboarding.steps.budgets.copy" as never)}
        >
          <form className="stack-form" onSubmit={(event) => void handleBudgetSubmit(event)}>
            <div className="field-grid">
              <label className="field">
                <span>{t("money.category" as never)}</span>
                <select
                  onChange={(event) =>
                    setBudgetForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  value={budgetForm.categoryId}
                >
                  <option value="">{t("onboarding.selectCategory" as never)}</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("money.amount" as never)}</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setBudgetForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  step="0.01"
                  type="number"
                  value={budgetForm.amount}
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit">
                {props.budgets.length > 0
                  ? t("common.continue" as never)
                  : t("onboarding.saveBudget" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void handleSkipOptionalStep()}
                type="button"
              >
                {t("common.skip" as never)}
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {currentStep === "review" ? (
        <>
          <Card
            title={t("onboarding.steps.review.title" as never)}
            subtitle={t("onboarding.steps.review.copy" as never)}
          >
            <div className="metric-grid">
              <div className="metric-card">
                <span>{t("today.available" as never)}</span>
                <strong>
                  {props.engineSnapshot
                    ? formatCurrency(
                        props.engineSnapshot.realAvailabilityNow.amount,
                        props.engineSnapshot.realAvailabilityNow.currency
                      )
                    : "—"}
                </strong>
              </div>
              <div className="metric-card">
                <span>{t("today.safeDailySpend" as never)}</span>
                <strong>
                  {props.engineSnapshot
                    ? formatCurrency(
                        props.engineSnapshot.safeDailySpend.amount,
                        props.engineSnapshot.safeDailySpend.currency
                      )
                    : "—"}
                </strong>
              </div>
              <div className="metric-card">
                <span>{t("onboarding.review.protected" as never)}</span>
                <strong>
                  {formatCurrency(
                    resolvedProfile.protected_balance,
                    resolvedProfile.currency
                  )}
                </strong>
              </div>
              <div className="metric-card">
                <span>{t("onboarding.review.commitments" as never)}</span>
                <strong>{expenseRecurring.length}</strong>
              </div>
            </div>
            {coachContent ? (
              <div className="onboarding-coach">
                <strong>{t("onboarding.review.coachTitle" as never)}</strong>
                <p className="helper-copy">{coachContent.summary}</p>
              </div>
            ) : null}
            <div className="inline-actions">
              <button
                className="primary-button"
                disabled={completionDisabled}
                onClick={() => void props.onComplete()}
                type="button"
              >
                {t("onboarding.complete" as never)}
              </button>
              <button
                className="secondary-button"
                onClick={() => void props.onCloseToToday()}
                type="button"
              >
                {t("onboarding.openToday" as never)}
              </button>
            </div>
            {!props.onboarding.can_complete ? (
              <p className="feedback feedback--error">
                {t("onboarding.completeBlocked" as never)}
              </p>
            ) : null}
          </Card>

          <Card
            title={t("onboarding.review.snapshotTitle" as never)}
            subtitle={t("onboarding.review.snapshotSubtitle" as never)}
          >
            <ul className="data-list">
              <li className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{t("onboarding.review.accounts" as never)}</strong>
                    <p>{props.accounts.length}</p>
                  </div>
                </div>
              </li>
              <li className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{t("onboarding.review.income" as never)}</strong>
                    <p>{incomeRecurring.length}</p>
                  </div>
                </div>
              </li>
              <li className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{t("onboarding.review.goals" as never)}</strong>
                    <p>{props.goals.length}</p>
                  </div>
                </div>
              </li>
              <li className="data-list__item">
                <div className="data-list__content">
                  <div>
                    <strong>{t("onboarding.review.budgets" as never)}</strong>
                    <p>{props.budgets.length}</p>
                  </div>
                </div>
              </li>
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}
