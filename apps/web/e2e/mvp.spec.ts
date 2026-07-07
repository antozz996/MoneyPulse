import { expect, test, type Page } from "@playwright/test";

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const tomorrowForInput = tomorrow.toISOString().slice(0, 10);
const tomorrowForDisplay = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric"
}).format(tomorrow);
const authEmail = "playwright@example.com";
const authPassword = "password123";

async function openAuthenticatedScreen(page: Page, hash: string) {
  await page.goto(`/${hash}`);

  const authForm = page.getByTestId("auth-form");
  const needsAuthentication = await authForm.isVisible().catch(() => false);

  if (!needsAuthentication) {
    return;
  }

  await page.getByRole("button", { name: "Login" }).click();
  await authForm.getByLabel("Email").fill(authEmail);
  await authForm.getByLabel("Password").fill(authPassword);
  await authForm.getByRole("button", { name: "Login" }).click();

  const invalidCredentials = await page
    .getByText("Invalid email or password.")
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  if (invalidCredentials) {
    await page.getByRole("button", { name: "Register" }).click();
    await authForm.getByLabel("Name").fill("Playwright User");
    await authForm.getByLabel("Email").fill(authEmail);
    await authForm.getByLabel("Password").fill(authPassword);
    await authForm.getByRole("button", { name: "Create account" }).click();
  }

  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await page.goto(`/${hash}`);
}

test.describe("MoneyPulse private beta flow", () => {
  test.describe.configure({ mode: "serial" });

  test("Account create and edit", async ({ page }) => {
    await openAuthenticatedScreen(page, "#money");

    const accountForm = page.getByTestId("account-form");
    await accountForm.getByLabel("Account name").fill("Main account");
    await accountForm.getByLabel("Balance").fill("2000");
    await accountForm.getByLabel("Currency").fill("EUR");
    await accountForm.getByRole("button", { name: "Add account" }).click();

    await expect(page.getByText("Account added.")).toBeVisible();
    await expect(page.getByTestId("accounts-list")).toContainText("Main account");
    await expect(page.getByTestId("accounts-list")).toContainText("€2,000.00");

    await page.getByTestId("account-edit-1").click();
    await accountForm.getByLabel("Balance").fill("2100");
    await accountForm.getByRole("button", { name: "Update account" }).click();

    await expect(page.getByText("Account updated.")).toBeVisible();
    await expect(page.getByTestId("accounts-list")).toContainText("€2,100.00");
  });

  test("Transaction create and edit", async ({ page }) => {
    await openAuthenticatedScreen(page, "#money");

    const transactionForm = page.getByTestId("transaction-form");
    await transactionForm.getByLabel("Name").fill("Rent");
    await transactionForm.getByLabel("Amount").fill("450");
    await transactionForm.getByLabel("Direction").selectOption("expense");
    await transactionForm.getByLabel("Category").selectOption("essential");
    await transactionForm.getByLabel("Date").fill(tomorrowForInput);
    await transactionForm.getByLabel("Currency").fill("EUR");
    await transactionForm.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByText("Transaction added.")).toBeVisible();
    await expect(page.getByTestId("transactions-list")).toContainText("Rent");
    await expect(page.getByTestId("transactions-list")).toContainText("€450.00");

    await page.getByTestId("transaction-edit-1").click();
    await transactionForm.getByLabel("Amount").fill("425");
    await transactionForm.getByRole("button", { name: "Update transaction" }).click();

    await expect(page.getByText("Transaction updated.")).toBeVisible();
    await expect(page.getByTestId("transactions-list")).toContainText("€425.00");
  });

  test("Goal create and edit", async ({ page }) => {
    await openAuthenticatedScreen(page, "#goals");

    const goalForm = page.getByTestId("goal-form");
    await goalForm.getByLabel("Name").fill("Emergency buffer");
    await goalForm.getByLabel("Target").fill("3000");
    await goalForm.getByLabel("Planned").fill("0");
    await goalForm.getByLabel("Reserved").fill("400");
    await goalForm.getByLabel("Kind").selectOption("safety_buffer");
    await goalForm.getByLabel("Currency").fill("EUR");
    await goalForm.getByRole("button", { name: "Save goal" }).click();

    await expect(page.getByText("Goal saved.")).toBeVisible();
    await expect(page.getByTestId("goals-list")).toContainText("Emergency buffer");
    await expect(page.getByTestId("goals-list")).toContainText("€3,000.00");

    await page.getByTestId("goal-edit-1").click();
    await goalForm.getByLabel("Reserved").fill("500");
    await goalForm.getByRole("button", { name: "Update goal" }).click();

    await expect(page.getByText("Goal updated.")).toBeVisible();
    await expect(page.getByTestId("goals-list")).toContainText("€500.00 reserved");
  });

  test("Recurring event create, edit, and delete", async ({ page }) => {
    await openAuthenticatedScreen(page, "#money");

    const recurringEventForm = page.getByTestId("recurring-event-form");
    await recurringEventForm.getByLabel("Name").fill("Salary advance");
    await recurringEventForm.getByLabel("Amount").fill("50");
    await recurringEventForm.getByLabel("Direction").selectOption("income");
    await recurringEventForm.getByLabel("Cadence").selectOption("daily");
    await recurringEventForm.getByLabel("Start date").fill(tomorrowForInput);
    await recurringEventForm.getByLabel("Currency").fill("EUR");
    await recurringEventForm.getByRole("button", { name: "Add recurring event" }).click();

    await expect(page.getByText("Recurring event added.")).toBeVisible();
    await expect(page.getByTestId("recurring-events-list")).toContainText("Salary advance");
    await expect(page.getByTestId("recurring-events-list")).toContainText("€50.00");

    await page.getByTestId("recurring-event-edit-1").click();
    await recurringEventForm.getByLabel("Amount").fill("75");
    await recurringEventForm
      .getByRole("button", { name: "Update recurring event" })
      .click();

    await expect(page.getByText("Recurring event updated.")).toBeVisible();
    await expect(page.getByTestId("recurring-events-list")).toContainText("€75.00");

    await page.getByTestId("recurring-event-delete-1").click();
    await expect(page.getByText("Recurring event deleted.")).toBeVisible();
    await expect(page.getByText("No recurring events yet.")).toBeVisible();
  });

  test("Today loads real backend data", async ({ page }) => {
    await openAuthenticatedScreen(page, "#today");

    await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
    await expect(page.getByTestId("today-available-to-spend")).toHaveText("€1,600.00");
    await expect(page.getByTestId("today-risk-level")).toHaveText("Safe");
    await expect(page.getByTestId("today-next-checkpoint")).toHaveText(
      `${tomorrowForDisplay} · €425.00`
    );
  });

  test("Before You Buy returns and displays a real decision", async ({ page }) => {
    await openAuthenticatedScreen(page, "#buy");

    const buyForm = page.getByTestId("buy-form");
    await buyForm.getByLabel("Item").fill("Running shoes");
    await buyForm.getByLabel("Price").fill("120");
    await buyForm.getByLabel("Currency").fill("EUR");
    await buyForm.getByRole("button", { name: "Check this purchase" }).click();

    await expect(page.getByRole("heading", { name: "Decision" })).toBeVisible();
    await expect(page.getByTestId("buy-decision-label")).toHaveText("Safe");
    await expect(page.getByTestId("buy-remaining-after-purchase")).toHaveText("€1,480.00");
    await expect(page.getByTestId("buy-decision-summary")).toContainText("Remaining after purchase");
    await expect(page.getByText("Projected remaining discretionary headroom")).toBeVisible();

    await page.getByRole("button", { name: "Back to Today" }).click();
    await expect(page).toHaveURL(/#today$/);
    await expect(page.getByTestId("today-available-to-spend")).toHaveText("€1,600.00");
  });

  test("Transaction, goal, and account delete", async ({ page }) => {
    await openAuthenticatedScreen(page, "#money");

    await page.getByTestId("transaction-delete-1").click();
    await expect(page.getByText("Transaction deleted.")).toBeVisible();
    await expect(page.getByText("No transactions yet.")).toBeVisible();

    await openAuthenticatedScreen(page, "#goals");
    await page.getByTestId("goal-delete-1").click();
    await expect(page.getByText("Goal deleted.")).toBeVisible();
    await expect(page.getByText("No goals yet.")).toBeVisible();

    await openAuthenticatedScreen(page, "#money");
    await page.getByTestId("account-delete-1").click();
    await expect(page.getByText("Account deleted.")).toBeVisible();
    await expect(page.getByText("No accounts yet.")).toBeVisible();
  });
});
