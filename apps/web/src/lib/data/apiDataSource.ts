import { api } from "../api";
import { fromFinancialDataResponse, type FinancialDataBundle, type FinancialDataSource } from "./types";

export const apiDataSource: FinancialDataSource = {
  async load(): Promise<FinancialDataBundle> {
    return fromFinancialDataResponse(await api.getFinancialData());
  }
};
