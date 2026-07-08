import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, getLocale } from "./format";

describe("format helpers", () => {
  it("maps supported languages to locales", () => {
    expect(getLocale("en")).toBe("en-GB");
    expect(getLocale("it")).toBe("it-IT");
    expect(getLocale("fr")).toBe("fr-FR");
    expect(getLocale("es")).toBe("es-ES");
  });

  it("formats currency values with locale-aware separators", () => {
    expect(formatCurrency(1234.5, "EUR", "en")).toBe("€1,234.50");
    expect(formatCurrency(1234.5, "EUR", "it")).toContain("1234,50");
    expect(formatCurrency(1234.5, "EUR", "fr")).toContain("1");
    expect(formatCurrency(1234.5, "EUR", "es")).toContain("1234,50");
  });

  it("formats ISO dates with locale-aware output", () => {
    expect(formatDate("2026-07-07", "en")).toContain("2026");
    expect(formatDate("2026-07-07", "it")).toContain("2026");
    expect(formatDate("2026-07-07", "fr")).toContain("2026");
    expect(formatDate("2026-07-07", "es")).toContain("2026");
  });
});
