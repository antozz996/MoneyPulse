import { calculateDailySafeToSpend } from "@moneypulse/core";
import { Card, PrimaryButton } from "@moneypulse/ui";

const dailyBriefing = calculateDailySafeToSpend({
  availableBalance: 1650,
  expectedIncomeToday: 0,
  essentialObligations: 420,
  committedSpending: 75,
  safetyBuffer: 300,
  plannedGoalContribution: 150,
  currency: "EUR",
  modelVersion: "1.0.0"
});

export default function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Decision Intelligence for Personal Finance</p>
        <h1>Know tomorrow. Decide today.</h1>
        <p className="lede">
          MoneyPulse turns balances, commitments, and goals into a clear daily
          answer before the user spends.
        </p>
      </section>

      <Card
        title="Today"
        subtitle="A deterministic recommendation built from the current scaffold."
      >
        <div className="amount-row">
          <span>Safe to spend today</span>
          <strong>
            {dailyBriefing.currency} {dailyBriefing.safeToSpendToday.toFixed(2)}
          </strong>
        </div>
        <div className="status-pill status-pill--safe">{dailyBriefing.riskLevel}</div>
        <ul className="reason-list">
          {dailyBriefing.explanations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <PrimaryButton label="Simulate a purchase" />
      </Card>
    </main>
  );
}

