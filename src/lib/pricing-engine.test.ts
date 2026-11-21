import { describe, expect, it } from "vitest";
import { TEST_CASES, runTestCase } from "./test-cases";
import { evaluateLine, resolveGrade, PO_AGREES_NOTE } from "./pricing-engine";
import { buildContext, statesWithVerified } from "./term-state";
import { fixtureById } from "@/data/fixtures";
import { formatINR, parseRupees, amountFor } from "./money";

describe("fixtures S01 to S11 against the engine", () => {
  for (const tc of TEST_CASES) {
    it(`${tc.id}: ${tc.description}`, () => {
      const run = runTestCase(tc);
      expect(run.mismatches).toEqual([]);
    });
  }
});

describe("engine rules", () => {
  const ctx = buildContext(statesWithVerified(["T02", "T04"]), {});

  it("adds the PO note when the PO agrees with an over-billed invoice", () => {
    const r = evaluateLine(fixtureById("S01")!.line, ctx);
    expect(r.poNote).toBe(PO_AGREES_NOTE);
  });

  it("never uses the draft Pune rate of ₹990", () => {
    const r = evaluateLine(fixtureById("S06")!.line, ctx);
    expect(r.applicableRatePaise).toBe(120000);
    expect(r.citedTermIds).not.toContain("T10");
  });

  it("shows no amounts while awaiting verification", () => {
    const r = evaluateLine(fixtureById("S08")!.line, buildContext(statesWithVerified([]), {}));
    expect(r.status).toBe("Awaiting verification");
    expect(r.expectedPaise).toBeNull();
    expect(r.differencePaise).toBeNull();
  });

  it("flags billing below contract as information", () => {
    const r = evaluateLine({ ...fixtureById("S03")!.line, billedRatePaise: 110000 }, ctx);
    expect(r.status).toBe("Billed below contract");
    expect(r.differencePaise).toBe(-1000000);
  });

  it("does not give an uplift to grades without a notice", () => {
    const r = evaluateLine({ ...fixtureById("S03")!.line, billedRatePaise: 123600 }, ctx);
    expect(r.status).toBe("Potential discrepancy");
    expect(r.applicableRatePaise).toBe(120000);
  });

  it("does not infer a grade from text like Analyst", () => {
    expect(resolveGrade("Analyst")).toBeNull();
    expect(resolveGrade("QA Analyst")).toBe("L2");
    expect(resolveGrade("Senior Software Engineer (Grade L4)")).toBe("L4");
  });
});

describe("money", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatINR(10500000)).toBe("₹1,05,000");
    expect(formatINR(1500000)).toBe("₹15,000");
    expect(formatINR(53560)).toBe("₹535.60");
    expect(formatINR(1234567800)).toBe("₹1,23,45,678");
  });
  it("parses rupees into paise", () => {
    expect(parseRupees("1,200")).toBe(120000);
    expect(parseRupees("533.5")).toBe(53350);
    expect(parseRupees("abc")).toBeNull();
  });
  it("multiplies hours by rate without float drift", () => {
    expect(amountFor(100, 105000)).toBe(10500000);
    expect(amountFor(7.5, 53300)).toBe(399750);
  });
});
