import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

function buildStableTomorrowFixture() {
  const tomorrow = new Date();
  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowForInput = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0")
  ].join("-");

  const tomorrowForDisplay = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(tomorrow);

  return {
    tomorrowForInput,
    tomorrowForDisplay
  };
}

const { tomorrowForInput, tomorrowForDisplay } = buildStableTomorrowFixture();
const authPassword = "password123";
const apiPort = Number(process.env.MONEYPULSE_PLAYWRIGHT_API_PORT ?? "8012");
const apiBaseUrl = process.env.MONEYPULSE_E2E_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;

type AuthSession = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: {
    id: string;
    name: string;
    email: string;
    created_at: string;
  };
};

type SeededAuthSession = {
  email: string;
  password: string;
  session: AuthSession;
};

function buildUniqueEmail(label: string): string {
  const normalized = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `playwright-${normalized}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function authorizedPost(
  request: APIRequestContext,
  session: AuthSession,
  path: string,
  data: Record<string, unknown>
) {
  const response = await request.post(`${apiBaseUrl}${path}`, {
    data,
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  expect(response.ok()).toBe(true);
  return response;
}

async function createAuthenticatedSession(page: Page, label: string): Promise<SeededAuthSession> {
  const email = buildUniqueEmail(label);
  const response = await page.request.post(`${apiBaseUrl}/auth/register`, {
    data: {
      name: "Playwright User",
      email,
      password: authPassword
    }
  });

  expect(response.ok()).toBe(true);
  const session = (await response.json()) as AuthSession;
  const onboardingResponse = await page.request.patch(`${apiBaseUrl}/onboarding`, {
    data: {
      onboarding_status: "skipped"
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  });
  expect(onboardingResponse.ok()).toBe(true);

  return {
    email,
    password: authPassword,
    session
  };
}

async function openAuthenticatedScreen(page: Page, auth: SeededAuthSession, hash: string) {
  await page.addInitScript((nextSession) => {
    window.localStorage.setItem("moneypulse-session", JSON.stringify(nextSession));
  }, auth.session);

  await page.goto(`/${hash}`);
  const onboardingScreen = page.getByTestId("onboarding-screen");
  if (await onboardingScreen.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Finish later" }).click();
    await page.goto(`/${hash}`);
  }
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

function listItemByText(page: Page, listTestId: string, text: string) {
  return page.getByTestId(listTestId).locator("li").filter({ hasText: text }).first();
}

async function bootstrapEmptySession(page: Page, hash: string, label: string) {
  const auth = await createAuthenticatedSession(page, label);
  await openAuthenticatedScreen(page, auth, hash);
  return auth;
}

async function bootstrapSessionWithAccount(page: Page, hash: string, label: string, balance = 1200) {
  const auth = await createAuthenticatedSession(page, label);
  await authorizedPost(page.request, auth.session, "/accounts", {
    name: "Main account",
    balance,
    currency: "EUR"
  });
  await openAuthenticatedScreen(page, auth, hash);
  return auth;
}

async function bootstrapTodayScenario(page: Page, hash: string, label: string) {
  const auth = await createAuthenticatedSession(page, label);
  await authorizedPost(page.request, auth.session, "/accounts", {
    name: "Main account",
    balance: 2100,
    currency: "EUR"
  });
  await authorizedPost(page.request, auth.session, "/transactions", {
    name: "Rent",
    amount: 425,
    currency: "EUR",
    direction: "expense",
    category: "essential",
    effective_date: tomorrowForInput
  });
  await openAuthenticatedScreen(page, auth, hash);
  return auth;
}

async function bootstrapMoneyInsightsScenario(page: Page, hash: string, label: string) {
  const auth = await createAuthenticatedSession(page, label);
  await authorizedPost(page.request, auth.session, "/accounts", {
    name: "Responsive account",
    balance: 1200,
    currency: "EUR"
  });
  await authorizedPost(page.request, auth.session, "/transactions", {
    name: "Responsive rent",
    amount: 320,
    currency: "EUR",
    direction: "expense",
    category: "essential",
    effective_date: tomorrowForInput
  });
  await authorizedPost(page.request, auth.session, "/recurring-items", {
    name: "Responsive salary",
    amount: 80,
    currency: "EUR",
    type: "income",
    frequency: "weekly",
    next_due_date: tomorrowForInput,
    status: "active"
  });
  await openAuthenticatedScreen(page, auth, hash);
  return auth;
}

async function bootstrapDeleteScenario(page: Page, hash: string, label: string) {
  const auth = await createAuthenticatedSession(page, label);
  const accountResponse = await authorizedPost(page.request, auth.session, "/accounts", {
    name: "Main account",
    balance: 1000,
    currency: "EUR"
  });
  await authorizedPost(page.request, auth.session, "/transactions", {
    account_id: (await accountResponse.json()).id,
    amount: 450,
    currency: "EUR",
    type: "expense",
    date: tomorrowForInput,
    description: "Rent"
  });
  await authorizedPost(page.request, auth.session, "/goals", {
    name: "Emergency buffer",
    target_amount: 3000,
    current_amount: 400,
    monthly_contribution: 0,
    priority: "ESSENTIAL",
    currency: "EUR",
    kind: "goal"
  });
  await openAuthenticatedScreen(page, auth, hash);
  return auth;
}

test.describe("MoneyPulse private beta flow", () => {
  test("Account create and edit", async ({ page }) => {
    await bootstrapEmptySession(page, "#money", "account-create-edit");

    const accountForm = page.getByTestId("account-form");
    await accountForm.getByLabel("Account name").fill("Main account");
    await accountForm.getByLabel("Balance").fill("2000");
    await accountForm.getByLabel("Currency").fill("EUR");
    await accountForm.getByRole("button", { name: "Add account" }).click();

    await expect(page.getByText("Account added.")).toBeVisible();
    await expect(page.getByTestId("accounts-list")).toContainText("Main account");
    await expect(page.getByTestId("accounts-list")).toContainText("€2,000.00");

    await listItemByText(page, "accounts-list", "Main account")
      .getByRole("button", { name: "Edit" })
      .click();
    await accountForm.getByLabel("Balance").fill("2100");
    await accountForm.getByRole("button", { name: "Update account" }).click();

    await expect(page.getByText("Account updated.")).toBeVisible();
    await expect(page.getByTestId("accounts-list")).toContainText("€2,100.00");
  });

  test("Transaction create and edit", async ({ page }) => {
    await bootstrapSessionWithAccount(page, "#money", "transaction-create-edit");

    const transactionForm = page.getByTestId("transaction-form");
    await transactionForm.getByLabel("Description").fill("Rent");
    await transactionForm.getByLabel("Amount").fill("450");
    await transactionForm.getByLabel("Type").selectOption("expense");
    await transactionForm.getByLabel("Account").selectOption({ label: "Main account" });
    await transactionForm.getByLabel("Category").selectOption({ label: "Housing" });
    await transactionForm.getByLabel("Date").fill(tomorrowForInput);
    await transactionForm.getByLabel("Currency").fill("EUR");
    await transactionForm.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByText("Transaction added.")).toBeVisible();
    await expect(page.getByTestId("transactions-list")).toContainText("Rent");
    await expect(page.getByTestId("transactions-list")).toContainText("€450.00");

    await listItemByText(page, "transactions-list", "Rent")
      .getByRole("button", { name: "Edit" })
      .click();
    await transactionForm.getByLabel("Amount").fill("425");
    await transactionForm.getByRole("button", { name: "Update transaction" }).click();

    await expect(page.getByText("Transaction updated.")).toBeVisible();
    await expect(page.getByTestId("transactions-list")).toContainText("€425.00");
  });

  test("Transaction categorization suggestion learns from user correction", async ({ page }) => {
    await bootstrapSessionWithAccount(page, "#money", "categorization-learning");

    const transactionForm = page.getByTestId("transaction-form");
    await transactionForm.getByLabel("Description").fill("PAYPAL *NETFLIX.COM");
    await transactionForm.getByLabel("Amount").fill("12");
    await expect(page.getByTestId("transaction-categorization-suggestion")).toContainText(
      "Netflix"
    );
    await transactionForm.getByLabel("Category").selectOption({ label: "Groceries" });
    await transactionForm.getByLabel("Apply to similar").selectOption("yes");
    await transactionForm.getByLabel("Date").fill(tomorrowForInput);
    await transactionForm.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByText("Transaction added.")).toBeVisible();

    await transactionForm.getByLabel("Description").fill("PAYPAL *NETFLIX.COM");
    await transactionForm.getByLabel("Amount").fill("9");
    await expect(page.getByTestId("transaction-categorization-suggestion")).toContainText(
      "Groceries"
    );
  });

  test("CSV import previews and imports a transaction", async ({ page }) => {
    await bootstrapSessionWithAccount(page, "#money", "csv-import");

    const importForm = page.getByTestId("csv-import-form");
    await importForm.locator('input[type="file"]').setInputFiles({
      name: "bank.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Date,Description,Amount\n2026-07-14,Cinema,-25.40\n")
    });

    await importForm.getByRole("button", { name: "Preview import" }).click();

    await expect(page.getByTestId("csv-import-preview-list")).toContainText("Cinema");
    await expect(page.getByTestId("csv-import-selected-count")).toContainText("1 row selected");

    await importForm.getByRole("button", { name: "Import selected rows" }).click();

    await expect(page.getByTestId("csv-import-summary")).toContainText(
      "CSV import complete: 1 imported, 0 skipped, 0 errors."
    );
    await expect(page.getByTestId("transactions-list")).toContainText("Cinema");
  });

  test("Goal create and edit", async ({ page }) => {
    await bootstrapEmptySession(page, "#goals", "goal-create-edit");

    const goalForm = page.getByTestId("goal-form");
    await goalForm.getByLabel("Name").fill("Emergency buffer");
    await goalForm.getByLabel("Target").fill("3000");
    await goalForm.getByLabel("Current amount").fill("400");
    await goalForm.getByLabel("Monthly contribution").fill("0");
    await goalForm.getByLabel("Priority").selectOption("ESSENTIAL");
    await goalForm.getByLabel("Currency").fill("EUR");
    await goalForm.getByRole("button", { name: "Save goal" }).click();

    await expect(page.getByText("Goal saved.")).toBeVisible();
    await expect(page.getByTestId("goals-list")).toContainText("Emergency buffer");
    await expect(page.getByTestId("goals-list")).toContainText("€3,000.00");

    await listItemByText(page, "goals-list", "Emergency buffer")
      .getByRole("button", { name: "Edit" })
      .click();
    await goalForm.getByLabel("Current amount").fill("500");
    await goalForm.getByRole("button", { name: "Update goal" }).click();

    await expect(page.getByText("Goal updated.")).toBeVisible();
    await expect(page.getByTestId("goals-list")).toContainText("€500.00");
  });

  test("Budget create and delete", async ({ page }) => {
    await bootstrapEmptySession(page, "#goals", "budget-create-delete");

    const budgetForm = page.getByTestId("budget-form");
    await budgetForm.getByLabel("Category").selectOption({ label: "Housing" });
    await budgetForm.getByLabel("Amount").fill("900");
    await budgetForm.getByLabel("Period").selectOption("MONTHLY");
    await budgetForm.getByLabel("Currency").fill("EUR");
    await budgetForm.getByRole("button", { name: "Save budget" }).click();

    await expect(page.getByText("Budget saved.")).toBeVisible();
    await expect(page.getByTestId("budgets-list")).toContainText("Housing");
    await expect(page.getByTestId("budgets-list")).toContainText("€900.00");

    await listItemByText(page, "budgets-list", "Housing")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Budget deleted.")).toBeVisible();
  });

  test("Recurring event create, edit, and delete", async ({ page }) => {
    await bootstrapSessionWithAccount(page, "#money", "recurring-crud");

    const recurringEventForm = page.getByTestId("recurring-event-form");
    await recurringEventForm.getByLabel("Name").fill("Gym membership");
    await recurringEventForm.getByLabel("Amount").fill("50");
    await recurringEventForm.getByLabel("Account").selectOption({ label: "Main account" });
    await recurringEventForm.getByLabel("Direction").selectOption("expense");
    await recurringEventForm.getByLabel("Category").selectOption("committed");
    await recurringEventForm.getByLabel("Cadence").selectOption("daily");
    await recurringEventForm.getByLabel("Next due date").fill(tomorrowForInput);
    await recurringEventForm.getByLabel("Currency").fill("EUR");
    await recurringEventForm.getByRole("button", { name: "Add recurring event" }).click();

    await expect(page.getByText("Recurring event added.")).toBeVisible();
    await expect(page.getByTestId("recurring-events-list")).toContainText("Gym membership");
    await expect(page.getByTestId("recurring-events-list")).toContainText("€50.00");

    await listItemByText(page, "recurring-events-list", "Gym membership")
      .getByRole("button", { name: "Edit" })
      .click();
    await recurringEventForm.getByLabel("Amount").fill("75");
    await recurringEventForm
      .getByRole("button", { name: "Update recurring event" })
      .click();

    await expect(page.getByText("Recurring event updated.")).toBeVisible();
    await expect(page.getByTestId("recurring-events-list")).toContainText("€75.00");

    await listItemByText(page, "recurring-events-list", "Gym membership")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Recurring event deleted.")).toBeVisible();
    await expect(page.getByText("No recurring events yet.")).toBeVisible();
  });

  test("Today loads real backend data", async ({ page }) => {
    await bootstrapTodayScenario(page, "#today", "today-real-data");

    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByTestId("today-available-to-spend")).toHaveText("€2,100.00");
    await expect(page.getByTestId("today-risk-level")).toHaveText("Safe");
    await expect(page.getByTestId("today-next-checkpoint")).toContainText(
      `${tomorrowForDisplay} · €425.00`
    );
  });

  test("Before You Buy returns and displays a real decision", async ({ page }) => {
    await bootstrapTodayScenario(page, "#buy", "before-you-buy");

    const buyForm = page.getByTestId("buy-form");
    await buyForm.getByLabel("Item").fill("Running shoes");
    await buyForm.getByLabel("Price").fill("120");
    await buyForm.getByLabel("Currency").fill("EUR");
    await buyForm.getByRole("button", { name: "Check this purchase" }).click();

    await expect(page.getByRole("heading", { name: "Decision" })).toBeVisible();
    await expect(page.getByTestId("buy-decision-label")).toHaveText("Safe");
    await expect(page.getByTestId("buy-remaining-after-purchase")).toHaveText("€1,980.00");
    await expect(page.getByTestId("buy-decision-summary")).toContainText("Remaining after purchase");
    await expect(page.getByText("Projected remaining discretionary headroom")).toBeVisible();

    await page.getByRole("button", { name: "Back to Today" }).click();
    await expect(page).toHaveURL(/#today$/);
    await expect(page.getByTestId("today-available-to-spend")).toHaveText("€2,100.00");
  });

  test("Copilot returns a deterministic mock answer", async ({ page }) => {
    await bootstrapMoneyInsightsScenario(page, "#copilot", "copilot");

    await expect(page.getByRole("heading", { name: "Copilot", exact: true })).toBeVisible();
    await page.getByTestId("copilot-prompt-1").click();

    await expect(page.getByTestId("copilot-thread")).toContainText(/GREEN|YELLOW|RED|BLACK/);
    await expect(page.getByTestId("copilot-thread")).toContainText("€");
  });

  test("Transaction, goal, and account delete", async ({ page }) => {
    await bootstrapDeleteScenario(page, "#money", "delete-flow");

    await listItemByText(page, "transactions-list", "Rent")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Transaction deleted.")).toBeVisible();
    await expect(page.getByText("No transactions yet.")).toBeVisible();

    await page.goto("/#goals");
    await listItemByText(page, "goals-list", "Emergency buffer")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Goal deleted.")).toBeVisible();
    await expect(page.getByText("No goals yet.")).toBeVisible();

    await page.goto("/#money");
    await listItemByText(page, "accounts-list", "Main account")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Account deleted.")).toBeVisible();
    await expect(page.getByText("No accounts yet.")).toBeVisible();
  });

  test("Logout, session expiry, and login recovery", async ({ page }) => {
    const auth = await bootstrapEmptySession(page, "#today", "logout-recovery");

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByTestId("auth-form")).toBeVisible();
    await page.getByLabel("Email").fill(auth.email);
    await page.getByLabel("Password").fill(auth.password);
    await page.getByTestId("auth-form").getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

    let expireNextTodayRequest = true;
    await page.route("**/today", async (route) => {
      if (expireNextTodayRequest) {
        expireNextTodayRequest = false;
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "authentication_error",
              message: "Authentication required."
            }
          })
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/?playwright-session-expired=1#today");
    await expect(page.getByTestId("auth-form")).toBeVisible();
    await expect(page.getByText("Your session expired. Please sign in again.")).toBeVisible();

    await page.getByLabel("Email").fill(auth.email);
    await page.getByLabel("Password").fill(auth.password);
    await page.getByTestId("auth-form").getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  });

  test("Bank sync mock and coach-backed today flow", async ({ page }) => {
    await bootstrapMoneyInsightsScenario(page, "#insights", "bank-sync");

    await page.getByTestId("bank-connect-mock").click();
    await expect(page.getByText("Mock Bank Sandbox connected.")).toBeVisible();
    await expect(page.getByTestId("bank-connections-list")).toContainText("Mock Bank Sandbox");

    await page.getByRole("button", { name: "Sync all" }).click();
    await expect(page.getByText(/Sync complete:/)).toBeVisible();

    await page.goto("/#money");
    await expect(page.getByTestId("accounts-list")).toContainText("Mock checking");
    await expect(page.getByTestId("accounts-list")).toContainText("Bank sync");
    await expect(page.getByTestId("transactions-list")).toContainText("Mock payroll");
    await expect(page.getByTestId("transactions-list")).toContainText("Bank sync");

    await page.goto("/#today");
    await expect(page.getByTestId("today-available-to-spend")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coach", exact: true })).toBeVisible();
  });

  test("Responsive layouts stay within the viewport", async ({ page }) => {
    await bootstrapSessionWithAccount(page, "#money", "responsive-layouts");

    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/#money");
      await expect(page.getByTestId("account-form")).toBeVisible();

      const noHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });

      expect(noHorizontalOverflow).toBe(true);
    }
  });

  test("Language switching persists across reload", async ({ page }) => {
    await bootstrapMoneyInsightsScenario(page, "#insights", "language-switching");

    await page.getByTestId("language-select").selectOption("it");
    await expect(
      page.getByRole("heading", { name: "Lingua e area", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sincronizza tutto" })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Lingua e area", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sincronizza tutto" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "it");
  });
});
