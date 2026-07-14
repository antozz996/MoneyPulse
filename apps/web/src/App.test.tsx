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
          csvImportForm={{
            fileName: "",
            fileContentBase64: "",
            accountId: "",
            currency: "EUR",
            confirmDuplicateCandidates: false,
            mapping: {
              date: "",
              description: "",
              merchant: "",
              amount: "",
              debit: "",
              credit: "",
              currency: ""
            }
          }}
          csvImportPreview={null}
          csvImportStatus={idleStatus}
          csvImportSummary={null}
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
          onCsvImportFileChange={async () => undefined}
          onCsvImportFormChange={() => undefined}
          onCsvImportPreviewChange={() => undefined}
          onCommitCsvImport={async () => undefined}
          onDeleteAccount={async () => undefined}
          onDeleteRecurringEvent={async () => undefined}
          onDeleteTransaction={async () => undefined}
          onEditAccount={() => undefined}
          onEditRecurringEvent={() => undefined}
          onEditTransaction={() => undefined}
          onAcceptTransactionSuggestion={() => undefined}
          onPreviewCsvImport={async () => undefined}
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
            date: "2026-07-12",
            applyToSimilar: false
          }}
          transactionSuggestion={null}
          transactionStatus={idleStatus}
          transactions={[]}
          transactionsState="success"
        />
      </I18nProvider>
    );

    expect(markup).toContain("Recurring events");
    expect(markup).toContain('data-testid="recurring-event-form"');
    expect(markup).toContain('data-testid="csv-import-form"');
  });

  it("renders transaction categorization guidance", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MoneyScreen
          accountForm={{ name: "", balance: "", currency: "EUR" }}
          accountStatus={idleStatus}
          accounts={[]}
          accountsState="success"
          categories={[
            {
              id: 7,
              user_id: "user-1",
              name: "Utilities",
              key: "utilities",
              entry_type: "expense",
              icon_key: "bolt",
              color_key: "amber",
              is_system: true,
              status: "active",
              created_at: "",
              updated_at: ""
            }
          ]}
          csvImportForm={{
            fileName: "",
            fileContentBase64: "",
            accountId: "",
            currency: "EUR",
            confirmDuplicateCandidates: false,
            mapping: {
              date: "",
              description: "",
              merchant: "",
              amount: "",
              debit: "",
              credit: "",
              currency: ""
            }
          }}
          csvImportPreview={null}
          csvImportStatus={idleStatus}
          csvImportSummary={null}
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
          onCsvImportFileChange={async () => undefined}
          onCsvImportFormChange={() => undefined}
          onCsvImportPreviewChange={() => undefined}
          onCommitCsvImport={async () => undefined}
          onDeleteAccount={async () => undefined}
          onDeleteRecurringEvent={async () => undefined}
          onDeleteTransaction={async () => undefined}
          onEditAccount={() => undefined}
          onEditRecurringEvent={() => undefined}
          onEditTransaction={() => undefined}
          onAcceptTransactionSuggestion={() => undefined}
          onPreviewCsvImport={async () => undefined}
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
            description: "ADDEBITO SEPA VODAFONE",
            merchant: "",
            accountId: "",
            categoryId: "",
            amount: "35",
            currency: "EUR",
            type: "expense",
            date: "2026-07-12",
            applyToSimilar: false
          }}
          transactionSuggestion={{
            source_row_number: null,
            suggested_category_id: 7,
            normalized_merchant: "Vodafone",
            confidence: 0.91,
            matched_rule_source: "merchant_alias",
            explanation: "Recognized the merchant as Vodafone.",
            needs_review: false,
            warnings: []
          }}
          transactionStatus={idleStatus}
          transactions={[]}
          transactionsState="success"
        />
      </I18nProvider>
    );

    expect(markup).toContain("Use suggestion");
    expect(markup).toContain("Vodafone");
  });

  it("renders CSV preview warnings and summary", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <MoneyScreen
          accountForm={{ name: "", balance: "", currency: "EUR" }}
          accountStatus={idleStatus}
          accounts={[
            {
              id: 1,
              name: "Main",
              balance: 1000,
              currency: "EUR",
              source: "manual",
              created_at: "2026-07-12T00:00:00Z"
            }
          ]}
          accountsState="success"
          categories={[]}
          csvImportForm={{
            fileName: "bank.csv",
            fileContentBase64: "YQ==",
            accountId: "1",
            currency: "EUR",
            confirmDuplicateCandidates: false,
            mapping: {
              date: "Date",
              description: "Description",
              merchant: "",
              amount: "Amount",
              debit: "",
              credit: "",
              currency: ""
            }
          }}
          csvImportPreview={{
            batch_identifier: "batch-1",
            filename: "bank.csv",
            detected_delimiter: ",",
            detected_encoding: "utf-8",
            detected_mapping: {},
            available_columns: ["Date", "Description", "Amount"],
            rows: [
              {
                source_row_number: 2,
                date: "2026-07-12",
                description: "Cinema",
                merchant: null,
                amount: 25.4,
                type: "expense",
                account_id: 1,
                category_id: null,
                suggested_category_id: null,
                currency: "EUR",
                selected: false,
                confidence: 0.74,
                normalized_merchant: "Cinema",
                explanation: "Not enough signal to suggest a reliable category yet.",
                matched_rule_source: "fallback",
                needs_review: true,
                apply_to_similar: false,
                warnings: ["Potential duplicate detected from an existing transaction."],
                duplicate_candidate: true
              }
            ],
            rejected_rows: [
              {
                source_row_number: 3,
                code: "row_invalid",
                message: "Amount is required."
              }
            ],
            preview_fingerprint: "fingerprint-1",
            warnings: ["Multiple accounts detected."],
            generated_at: "2026-07-12T00:00:00Z"
          }}
          csvImportStatus={idleStatus}
          csvImportSummary={{
            batch_id: 1,
            batch_identifier: "batch-1",
            imported_count: 1,
            skipped_count: 0,
            error_count: 0,
            warnings: []
          }}
          editingAccountId={null}
          editingRecurringEventId={null}
          editingTransactionId={null}
          loadError={null}
          moneySummary={{
            currency: "EUR",
            totalBalance: 1000,
            totalIncome: 0,
            totalExpenses: 0,
            activeRecurring: 0
          }}
          onAccountFormChange={() => undefined}
          onCsvImportFileChange={async () => undefined}
          onCsvImportFormChange={() => undefined}
          onCsvImportPreviewChange={() => undefined}
          onCommitCsvImport={async () => undefined}
          onDeleteAccount={async () => undefined}
          onDeleteRecurringEvent={async () => undefined}
          onDeleteTransaction={async () => undefined}
          onEditAccount={() => undefined}
          onEditRecurringEvent={() => undefined}
          onEditTransaction={() => undefined}
          onAcceptTransactionSuggestion={() => undefined}
          onPreviewCsvImport={async () => undefined}
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
            date: "2026-07-12",
            applyToSimilar: false
          }}
          transactionSuggestion={null}
          transactionStatus={idleStatus}
          transactions={[]}
          transactionsState="success"
        />
      </I18nProvider>
    );

    expect(markup).toContain("CSV import");
    expect(markup).toContain("Potential duplicate detected");
    expect(markup).toContain("Import summary");
  });
});
