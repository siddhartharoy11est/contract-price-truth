import { describe, expect, it } from "vitest";
import {
  AUTONOMY_DEFAULTS,
  autonomyLevel,
  formatRupees,
  readWhole,
  WORKED_DEFAULTS,
  workedExample,
} from "./about-calculators";

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

describe("Autonomy calculator", () => {
  const ready = { acceptedPct: 95, termsReviewed: 200, wrongPct: 0.9, daysStable: 0 };

  it("keeps Level 1 on with the defaults", () => {
    const r = autonomyLevel(AUTONOMY_DEFAULTS);
    expect(r.level).toBe(1);
    expect(r.level2Unlocked).toBe(false);
    expect(r.level2Missing).toHaveLength(3);
  });

  it("locks Level 2 at 94 percent, at 199 terms or at 1 percent wrong", () => {
    expect(autonomyLevel({ ...ready, acceptedPct: 94 }).level2Unlocked).toBe(false);
    expect(autonomyLevel({ ...ready, termsReviewed: 199 }).level2Unlocked).toBe(false);
    expect(autonomyLevel({ ...ready, wrongPct: 1 }).level2Unlocked).toBe(false);
    expect(autonomyLevel({ ...ready, wrongPct: 1 }).level2Missing).toEqual([
      "Wrong in the sample is 1%. It needs to be under 1%.",
    ]);
  });

  it("unlocks Level 2 at 95 percent, 200 terms and 0.9 percent wrong", () => {
    const r = autonomyLevel(ready);
    expect(r.level2Unlocked).toBe(true);
    expect(r.level).toBe(2);
  });

  it("locks Level 3 at 89 days and unlocks it at 90", () => {
    expect(autonomyLevel({ ...ready, daysStable: 89 }).level3Unlocked).toBe(false);
    expect(autonomyLevel({ ...ready, daysStable: 90 }).level3Unlocked).toBe(true);
    expect(autonomyLevel({ ...ready, daysStable: 90 }).level).toBe(3);
  });

  it("keeps Level 3 locked while Level 2 is locked, whatever the days", () => {
    const r = autonomyLevel({ ...ready, acceptedPct: 94, daysStable: 120 });
    expect(r.level3Unlocked).toBe(false);
    expect(r.level3Missing).toEqual(["Level 2 has to be unlocked first."]);
  });
});
