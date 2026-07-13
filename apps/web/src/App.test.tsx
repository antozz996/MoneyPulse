import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GoalsScreen, MoneyScreen } from "./App";
import { OnboardingScreen } from "./OnboardingScreen";
import { I18nProvider } from "./lib/i18n";

const idleStatus = { state: "idle" as const, message: null };

describe("planning screens", () => {
  it("renders the onboarding review shell", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <OnboardingScreen
          accounts={[]}
          budgets={[]}
          categories={[]}
          engineSnapshot={null}
          goals={[]}
          onboarding={{
            profile: {
              id: 1,
              user_id: "user-1",
              currency: "EUR",
              locale: "it-IT",
              salary_day: null,
              protected_balance: 0,
              risk_profile: "BALANCED",
              default_cycle_mode: "CALENDAR_MONTH",
              onboarding_status: "in_progress",
              onboarding_step: "review",
              onboarding_completed_at: null,
              setup_quality_score: 55,
              missing_setup_fields: ["income_schedule", "goals"],
              protected_balance_configured: true,
              zero_balance_declared: true,
              cycle_configured: true,
              status: "active",
              created_at: "",
              updated_at: ""
            },
            can_complete: true,
            recommended_next_action: "review",
            has_accounts: false,
            has_income_schedule: false,
            has_fixed_commitments: false,
            has_goals: false,
            has_budgets: false,
            has_transaction_history: false
          }}
          onCloseToToday={() => undefined}
          onComplete={async () => undefined}
          onCreateAccount={async () => undefined}
          onCreateBudget={async () => undefined}
          onCreateGoal={async () => undefined}
          onCreateRecurringEvent={async () => undefined}
          onSkip={async () => undefined}
          onUpdate={async () => undefined}
          recurringEvents={[]}
          status={idleStatus}
        />
      </I18nProvider>
    );

    expect(markup).toContain("Set up your money reality");
    expect(markup).toContain("Setup snapshot");
    expect(markup).toContain("Complete setup");
  });

  it("renders the budget and goal forms", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <GoalsScreen
          budgetForm={{
            categoryId: "",
            amount: "",
            currency: "EUR",
            period: "MONTHLY"
          }}
          budgetStatus={idleStatus}
          budgetSummary={{ currency: "EUR", totalActive: 0 }}
          budgets={[]}
          budgetsState="success"
          categories={[
            {
              id: 1,
              user_id: "user-1",
              name: "Housing",
              key: "housing",
              entry_type: "expense",
              icon_key: "home",
              color_key: "slate",
              is_system: true,
              status: "active",
              created_at: "",
              updated_at: ""
            }
          ]}
          editingBudgetId={null}
          editingGoalId={null}
          form={{
            name: "",
            targetAmount: "",
            currentAmount: "",
            monthlyContribution: "",
            priority: "IMPORTANT",
            deadline: "",
            currency: "EUR",
            kind: "goal"
          }}
          goalStatus={idleStatus}
          goals={[]}
          goalsState="success"
          loadError={null}
          onBudgetFormChange={() => undefined}
          onBudgetSubmit={async () => undefined}
          onDeleteBudget={async () => undefined}
          onDeleteGoal={async () => undefined}
          onEditBudget={() => undefined}
          onEditGoal={() => undefined}
          onFormChange={() => undefined}
          onRetry={async () => undefined}
          onSubmit={async () => undefined}
          resetBudgetForm={() => undefined}
          resetGoalForm={() => undefined}
          summary={{
            currency: "EUR",
            totalTargets: 0,
            totalReserved: 0,
            totalPlanned: 0
          }}
        />
      </I18nProvider>
    );

    expect(markup).toContain("Budgets");
    expect(markup).toContain("Goals");
    expect(markup).toContain('data-testid="budget-form"');
    expect(markup).toContain('data-testid="goal-form"');
  });

  it("renders the recurring management form", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MoneyScreen
          accountForm={{ name: "", balance: "", currency: "EUR" }}
          accountStatus={idleStatus}
          accounts={[]}
          accountsState="success"
          categories={[]}
          editingAccountId={null}
          editingRecurringEventId={null}
          editingTransactionId={null}
          loadError={null}
          moneySummary={{
            currency: "EUR",
            totalBalance: 0,
            totalIncome: 0,
            totalExpenses: 0,
            activeRecurring: 0
          }}
          onAccountFormChange={() => undefined}
          onDeleteAccount={async () => undefined}
          onDeleteRecurringEvent={async () => undefined}
          onDeleteTransaction={async () => undefined}
          onEditAccount={() => undefined}
          onEditRecurringEvent={() => undefined}
          onEditTransaction={() => undefined}
          onRecurringEventFormChange={() => undefined}
          onRetry={async () => undefined}
          onSaveAccount={async () => undefined}
          onSaveRecurringEvent={async () => undefined}
          onSaveTransaction={async () => undefined}
          onTransactionFormChange={() => undefined}
          recurringEventForm={{
            accountId: "",
            name: "",
            amount: "",
            currency: "EUR",
            direction: "expense",
            category: "committed",
            frequency: "monthly",
            nextDueDate: "2026-07-12",
            status: "active"
          }}
          recurringEventStatus={idleStatus}
          recurringEvents={[]}
          recurringEventsState="success"
          resetAccountForm={() => undefined}
          resetRecurringEventForm={() => undefined}
          resetTransactionForm={() => undefined}
          transactionForm={{
            description: "",
            merchant: "",
            accountId: "",
            categoryId: "",
            amount: "",
            currency: "EUR",
            type: "expense",
            date: "2026-07-12"
          }}
          transactionStatus={idleStatus}
          transactions={[]}
          transactionsState="success"
        />
      </I18nProvider>
    );

    expect(markup).toContain("Recurring events");
    expect(markup).toContain('data-testid="recurring-event-form"');
  });
});
