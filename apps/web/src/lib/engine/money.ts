import type { MoneyAmount } from "./types";

function roundAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteAmount(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return roundAmount(value);
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();

  if (!normalized) {
    throw new Error("Currency must not be empty.");
  }

  return normalized;
}

export function createMoneyAmount(amount: number, currency: string): MoneyAmount {
  return {
    amount: assertFiniteAmount(amount, "Money amount"),
    currency: normalizeCurrency(currency)
  };
}

export function zeroMoney(currency: string): MoneyAmount {
  return createMoneyAmount(0, currency);
}

export function assertSameCurrency(left: MoneyAmount, right: MoneyAmount): string {
  if (normalizeCurrency(left.currency) !== normalizeCurrency(right.currency)) {
    throw new Error("Money amounts must use the same currency.");
  }

  return normalizeCurrency(left.currency);
}

export function addMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return createMoneyAmount(left.amount + right.amount, assertSameCurrency(left, right));
}

export function subtractMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return createMoneyAmount(left.amount - right.amount, assertSameCurrency(left, right));
}

export function multiplyMoney(value: MoneyAmount, multiplier: number): MoneyAmount {
  return createMoneyAmount(value.amount * assertFiniteAmount(multiplier, "Multiplier"), value.currency);
}

export function divideMoney(value: MoneyAmount, divisor: number): MoneyAmount {
  const normalizedDivisor = assertFiniteAmount(divisor, "Divisor");

  if (normalizedDivisor === 0) {
    throw new Error("Divisor must not be zero.");
  }

  return createMoneyAmount(value.amount / normalizedDivisor, value.currency);
}

export function absMoney(value: MoneyAmount): MoneyAmount {
  return createMoneyAmount(Math.abs(value.amount), value.currency);
}

export function maxMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return left.amount >= right.amount ? left : right;
}

export function minMoney(left: MoneyAmount, right: MoneyAmount): MoneyAmount {
  return left.amount <= right.amount ? left : right;
}

export function clampMoneyToZero(value: MoneyAmount): MoneyAmount {
  return value.amount < 0 ? zeroMoney(value.currency) : createMoneyAmount(value.amount, value.currency);
}

export function compareMoney(left: MoneyAmount, right: MoneyAmount): number {
  assertSameCurrency(left, right);
  return left.amount === right.amount ? 0 : left.amount > right.amount ? 1 : -1;
}

export function sumMoney(values: readonly MoneyAmount[], currency: string): MoneyAmount {
  return values.reduce(
    (total, value) => addMoney(total, value),
    zeroMoney(currency)
  );
}

export function isPositiveMoney(value: MoneyAmount): boolean {
  return value.amount > 0;
}

export function isNegativeMoney(value: MoneyAmount): boolean {
  return value.amount < 0;
}

export function isZeroMoney(value: MoneyAmount): boolean {
  return value.amount === 0;
}
