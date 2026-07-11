function normalizeAmount(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}
function ensureFiniteNumber(value, label) {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number.`);
    }
    return normalizeAmount(value);
}
export function createCurrency(value) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
        throw new Error("Currency must not be empty.");
    }
    return normalized;
}
export function createModelVersion(value) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("Model version must not be empty.");
    }
    return normalized;
}
export function createMoney(amount, currency) {
    return {
        amount: ensureFiniteNumber(amount, "Money amount"),
        currency
    };
}
export function createNonNegativeMoney(amount, currency) {
    const money = createMoney(amount, currency);
    if (money.amount < 0) {
        throw new Error("Money amount must be non-negative.");
    }
    return money;
}
export function assertSameCurrency(left, right) {
    if (left.currency !== right.currency) {
        throw new Error("Money values must use the same currency.");
    }
    return left.currency;
}
export function addMoney(left, right) {
    return createMoney(left.amount + right.amount, assertSameCurrency(left, right));
}
export function subtractMoney(left, right) {
    return createMoney(left.amount - right.amount, assertSameCurrency(left, right));
}
export function clampMoneyToZero(money) {
    return money.amount < 0 ? createMoney(0, money.currency) : money;
}
export function negateMoney(money) {
    return createMoney(money.amount * -1, money.currency);
}
export function sumMoney(values) {
    const [first, ...rest] = values;
    if (!first) {
        throw new Error("sumMoney requires at least one money value.");
    }
    return rest.reduce(addMoney, first);
}
export function isZeroMoney(money) {
    return money.amount === 0;
}
export function isGreaterThanMoney(left, right) {
    assertSameCurrency(left, right);
    return left.amount > right.amount;
}
