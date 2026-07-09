import { addMonths } from "./dateCycle";
import { createEngineDecision } from "./decisionEngine";
import { clampMoneyToZero, compareMoney, createMoneyAmount, divideMoney, subtractMoney, sumMoney } from "./money";
import { assessRisk } from "./riskEngine";
import { buildFinancialSnapshot } from "./snapshotEngine";
import type {
  Account,
  AffordabilityInput,
  AffordabilityResult,
  FutureCommitment,
  MoneyAmount,
  RiskLevel
} from "./types";

function normalizeCurrentCycleImpact(
  purchaseAmount: MoneyAmount,
  installments: AffordabilityInput["installments"]
): MoneyAmount {
  if (!installments || installments.count <= 1) {
    return purchaseAmount;
  }

  return installments.amount
    ? createMoneyAmount(installments.amount.amount, installments.amount.currency)
    : divideMoney(purchaseAmount, installments.count);
}

function buildFutureCommitments(
  purchaseAmount: MoneyAmount,
  description: string | undefined,
  installments: AffordabilityInput["installments"],
  currentCycleImpact: MoneyAmount,
  purchaseDate: string
): FutureCommitment[] {
  if (!installments || installments.count <= 1) {
    return [];
  }

  const perInstallment =
    installments.amount ??
    divideMoney(purchaseAmount, installments.count);
  const commitments: FutureCommitment[] = [];

  for (let index = 1; index < installments.count; index += 1) {
    commitments.push({
      dueDate: addMonths(installments.startDate ?? purchaseDate, index),
      amount: perInstallment,
      label: description?.trim() ? `${description} installment ${index + 1}` : `Installment ${index + 1}`,
      type: "INSTALLMENT"
    });
  }

  return commitments;
}

function applyImmediatePurchase(accounts: readonly Account[], impact: MoneyAmount): Account[] {
  const [firstAccount, ...rest] = accounts;

  if (!firstAccount) {
    return [];
  }

  return [
    {
      ...firstAccount,
      balance: subtractMoney(firstAccount.balance, impact)
    },
    ...rest
  ];
}

function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["GREEN", "YELLOW", "RED", "BLACK"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))];
}

export function simulatePurchase(input: AffordabilityInput): AffordabilityResult {
  const purchaseDate = input.purchaseDate ?? input.profile.today ?? new Date().toISOString().slice(0, 10);
  const snapshotBefore = buildFinancialSnapshot(input);
  const riskBefore = assessRisk(snapshotBefore, input.profile);
  const currentCycleImpact = normalizeCurrentCycleImpact(input.purchaseAmount, input.installments);
  const futureCommitments = buildFutureCommitments(
    input.purchaseAmount,
    input.description,
    input.installments,
    currentCycleImpact,
    purchaseDate
  );
  const snapshotAfter = buildFinancialSnapshot({
    ...input,
    accounts: applyImmediatePurchase(input.accounts, currentCycleImpact)
  });
  const riskAfterBase = assessRisk(snapshotAfter, input.profile);
  const futureCommitmentTotal = sumMoney(
    futureCommitments.map((commitment) => commitment.amount),
    input.purchaseAmount.currency
  );
  const futurePressureLevel =
    futureCommitments.length === 0
      ? riskAfterBase.level
      : compareMoney(futureCommitmentTotal, snapshotAfter.projectedAvailability) > 0
        ? "RED"
        : compareMoney(futureCommitmentTotal, currentCycleImpact) > 0
          ? maxRiskLevel(riskAfterBase.level, "YELLOW")
          : riskAfterBase.level;
  const riskAfter =
    futurePressureLevel === riskAfterBase.level
      ? riskAfterBase
      : {
          ...riskAfterBase,
          level: futurePressureLevel,
          reasons: [
            ...riskAfterBase.reasons,
            "Future installment commitments reduce room in the next cycles."
          ],
          confidence: Math.min(riskAfterBase.confidence, 0.9)
        };
  const decision = createEngineDecision(riskAfter);

  return {
    snapshotBefore,
    snapshotAfter,
    riskBefore,
    riskAfter,
    purchaseAmount: input.purchaseAmount,
    currentCycleImpact,
    futureCommitments,
    decision
  };
}
