import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatDecisionLabel } from "./format";

describe("format helpers", () => {
  it("formats currency values for the UI", () => {
    expect(formatCurrency(705, "EUR")).toContain("705");
    expect(formatCurrency(-100, "EUR")).toContain("100");
  });

  it("formats ISO dates for screen labels", () => {
    expect(formatDate("2026-07-07")).toContain("2026");
  });

  it("formats decision labels", () => {
    expect(formatDecisionLabel("safe")).toBe("Safe");
    expect(formatDecisionLabel("caution")).toBe("Caution");
    expect(formatDecisionLabel("hold")).toBe("Hold");
  });
});
