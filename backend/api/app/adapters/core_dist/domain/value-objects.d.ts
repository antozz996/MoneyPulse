type Brand<TValue, TBrand extends string> = TValue & {
    readonly __brand: TBrand;
};
export type Currency = Brand<string, "Currency">;
export type ModelVersion = Brand<string, "ModelVersion">;
export interface Money {
    readonly amount: number;
    readonly currency: Currency;
}
export declare function createCurrency(value: string): Currency;
export declare function createModelVersion(value: string): ModelVersion;
export declare function createMoney(amount: number, currency: Currency): Money;
export declare function createNonNegativeMoney(amount: number, currency: Currency): Money;
export declare function assertSameCurrency(left: Money, right: Money): Currency;
export declare function addMoney(left: Money, right: Money): Money;
export declare function subtractMoney(left: Money, right: Money): Money;
export declare function clampMoneyToZero(money: Money): Money;
export declare function negateMoney(money: Money): Money;
export declare function sumMoney(values: readonly Money[]): Money;
export declare function isZeroMoney(money: Money): boolean;
export declare function isGreaterThanMoney(left: Money, right: Money): boolean;
export {};
