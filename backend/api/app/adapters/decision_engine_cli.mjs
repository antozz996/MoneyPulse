import {
  calculateAvailableToSpend,
  calculateDailySafeToSpend,
  confidence,
  createFinancialSnapshot,
  createPurchaseCandidate,
  evaluatePurchase,
  forecast
} from "./core_dist/index.js";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  const command = JSON.parse(raw);
  const snapshot = createFinancialSnapshot(command.snapshot);
  const available = calculateAvailableToSpend(snapshot);
  const summary = calculateDailySafeToSpend(command.snapshot);
  const baseConfidence = confidence(snapshot);

  if (command.action === "today") {
    process.stdout.write(
      JSON.stringify({
        available_to_spend_today: summary.safeToSpendToday,
        risk_level: summary.riskLevel,
        currency: summary.currency,
        model_version: summary.modelVersion,
        explanations: [...summary.explanations],
        inputs: {
          available_balance: available.normalizedInputs.availableBalance.amount,
          expected_income_today: available.normalizedInputs.expectedIncomeToday.amount,
          essential_obligations: available.normalizedInputs.essentialObligations.amount,
          committed_spending: available.normalizedInputs.committedSpending.amount,
          safety_buffer: available.normalizedInputs.safetyBuffer.amount,
          planned_goal_contribution:
            available.normalizedInputs.plannedGoalContribution.amount
        },
        confidence: {
          mode: baseConfidence.mode,
          input_completeness: baseConfidence.inputCompleteness,
          uses_documented_inputs_only: baseConfidence.usesDocumentedInputsOnly,
          purchase_context: baseConfidence.purchaseContext,
          supported_inputs: [...baseConfidence.supportedInputs],
          model_version: baseConfidence.modelVersion
        }
      })
    );
    return;
  }

  const purchase = createPurchaseCandidate(command.purchase);
  const evaluation = evaluatePurchase(snapshot, purchase);
  const projection = forecast(snapshot, purchase);
  const purchaseConfidence = confidence(snapshot, purchase);

  process.stdout.write(
    JSON.stringify({
      current_available_to_spend: evaluation.currentAvailableToSpend.amount,
      purchase_amount: evaluation.purchaseAmount.amount,
      available_to_spend_after_purchase:
        evaluation.availableToSpendAfterPurchase.amount,
      delta: projection.delta.amount,
      can_afford: evaluation.canAfford,
      decision: evaluation.decision,
      currency: evaluation.currentAvailableToSpend.currency,
      model_version: evaluation.modelVersion,
      explanations: [...evaluation.explanations],
      confidence: {
        mode: purchaseConfidence.mode,
        input_completeness: purchaseConfidence.inputCompleteness,
        uses_documented_inputs_only:
          purchaseConfidence.usesDocumentedInputsOnly,
        purchase_context: purchaseConfidence.purchaseContext,
        supported_inputs: [...purchaseConfidence.supportedInputs],
        model_version: purchaseConfidence.modelVersion
      }
    })
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown adapter error";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
