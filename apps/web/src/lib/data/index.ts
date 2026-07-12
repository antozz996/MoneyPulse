import { apiDataSource } from "./apiDataSource";
import { demoDataSource } from "./demoDataSource";
import type { FinancialDataSource, FinancialDataSourceOptions } from "./types";

export * from "./apiDataSource";
export * from "./demoDataSource";
export * from "./mappers";
export * from "./types";

export function resolveFinancialDataSource(
  options: FinancialDataSourceOptions
): FinancialDataSource {
  return options.authenticated ? apiDataSource : demoDataSource;
}
