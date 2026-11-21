import { describe, expect, it } from "vitest";
import { formatRupees, readWhole, WORKED_DEFAULTS, workedExample } from "./about-calculators";

describe("Worked example calculator", () => {
  it("gives 1,92,000, 1,76,000 and 16,000 with the defaults", () => {
    const r = workedExample(WORKED_DEFAULTS);
    expect(r.invoiceAmount).toBe(192000);
    expect(r.contractAmount).toBe(176000);
    expect(r.difference).toBe(16000);
    expect(formatRupees(r.invoiceAmount)).toBe("₹1,92,000");
    expect(formatRupees(r.contractAmount)).toBe("₹1,76,000");
    expect(formatRupees(r.difference)).toBe("₹16,000");
  });

  it("passes the PO check and flags the contract check on the defaults", () => {
    const r = workedExample(WORKED_DEFAULTS);
    expect(r.poRate).toBe(1200);
    expect(r.poCheckPasses).toBe(true);
    expect(r.contractFlagged).toBe(true);
  });

  it("does not flag the contract check when the amendment does not lower the rate", () => {
    expect(
      workedExample({ hours: 160, originalRate: 1200, amendedRate: 1200 }).contractFlagged,
    ).toBe(false);
    const up = workedExample({ hours: 10, originalRate: 1000, amendedRate: 1100 });
    expect(up.difference).toBe(-1000);
    expect(up.contractFlagged).toBe(false);
  });

  it("reads whole non negative numbers from fields", () => {
    expect(readWhole("160", 10000)).toBe(160);
    expect(readWhole("", 10000)).toBe(0);
    expect(readWhole("-5", 10000)).toBe(0);
    expect(readWhole("abc", 10000)).toBe(0);
    expect(readWhole("99999", 10000)).toBe(10000);
  });
});
