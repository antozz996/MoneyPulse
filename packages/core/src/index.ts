export {
  calculateAvailableToSpend,
  calculateDailySafeToSpend,
  confidence,
  createDecisionEngine,
  evaluatePurchase,
  forecast
} from "./decision-engine";
export {
  DOCUMENTED_INPUTS,
  createFinancialSnapshot,
  createPurchaseCandidate,
  getNormalizedFinancialInputs,
  getSnapshotCurrency
} from "./domain/entities";
export {
  addMoney,
  assertSameCurrency,
  clampMoneyToZero,
  createCurrency,
  createModelVersion,
  createMoney,
  createNonNegativeMoney,
  isGreaterThanMoney,
  isZeroMoney,
  negateMoney,
  subtractMoney,
  sumMoney
} from "./domain/value-objects";
export type {
  AvailableToSpendResult,
  Currency,
  DecisionConfidence,
  DecisionEngine,
  DailyDecisionInput,
  DailyDecisionOutput,
  FinancialSnapshot,
  FinancialSnapshotInput,
  ForecastResult,
  ModelVersion,
  Money,
  NormalizedFinancialInputs,
  PurchaseCandidate,
  PurchaseCandidateInput,
  PurchaseDecision,
  PurchaseEvaluation,
  RiskLevel
} from "./types";

