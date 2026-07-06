type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type Currency = Brand<string, "Currency">;
export type ModelVersion = Brand<string, "ModelVersion">;

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
}

function normalizeAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function ensureFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return normalizeAmount(value);
}

export function createCurrency(value: string): Currency {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Currency must not be empty.");
  }

  return normalized as Currency;
}

export function createModelVersion(value: string): ModelVersion {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Model version must not be empty.");
  }

  return normalized as ModelVersion;
}

export function createMoney(amount: number, currency: Currency): Money {
  return {
    amount: ensureFiniteNumber(amount, "Money amount"),
    currency
  };
}

export function createNonNegativeMoney(amount: number, currency: Currency): Money {
  const money = createMoney(amount, currency);

  if (money.amount < 0) {
    throw new Error("Money amount must be non-negative.");
  }

  return money;
}

export function assertSameCurrency(left: Money, right: Money): Currency {
  if (left.currency !== right.currency) {
    throw new Error("Money values must use the same currency.");
  }

  return left.currency;
}

export function addMoney(left: Money, right: Money): Money {
  return createMoney(left.amount + right.amount, assertSameCurrency(left, right));
}

export function subtractMoney(left: Money, right: Money): Money {
  return createMoney(left.amount - right.amount, assertSameCurrency(left, right));
}

export function clampMoneyToZero(money: Money): Money {
  return money.amount < 0 ? createMoney(0, money.currency) : money;
}

export function negateMoney(money: Money): Money {
  return createMoney(money.amount * -1, money.currency);
}

export function sumMoney(values: readonly Money[]): Money {
  const [first, ...rest] = values;

  if (!first) {
    throw new Error("sumMoney requires at least one money value.");
  }

  return rest.reduce(addMoney, first);
}

export function isZeroMoney(money: Money): boolean {
  return money.amount === 0;
}

export function isGreaterThanMoney(left: Money, right: Money): boolean {
  assertSameCurrency(left, right);
  return left.amount > right.amount;
}

