import { describe, expect, it } from "vitest";
import { TEST_CASES, runTestCase } from "./test-cases";
import { evaluateLine, permittedAdjustedRate, resolveGrade, type EngineContext } from "./pricing-engine";
import { buildContext, fixtureContext, statesWithVerified, withOverrideConfirmed, type FixtureState } from "./term-state";
import { fixtureById } from "@/data/fixtures";
import type { EngineTerm, InvoiceLine } from "@/data/types";
import { formatINR, parseRupees, amountFor } from "./money";

describe("PRD 8.1 and 8.2 fixtures against the engine", () => {
  for (const tc of TEST_CASES) {
    it(`${tc.id} [${tc.state}]: ${tc.description}`, () => {
      expect(runTestCase(tc).mismatches).toEqual([]);
    });
  }
});

const S09 = fixtureById("S09")!.line;
const withTerms = (state: FixtureState, edit: (terms: EngineTerm[]) => EngineTerm[]): EngineContext => {
  const ctx = fixtureContext(state);
  return { ...ctx, terms: edit(ctx.terms.map((t) => ({ ...t }))) };
};
const patch = (id: string, p: Partial<EngineTerm>) => (terms: EngineTerm[]) =>
  terms.map((t) => (t.id === id ? { ...t, ...p } : t));

describe("PRD 8.3 unit tests", () => {
  it("ADJ01: permitted increase is the lesser of the cap and the stated index", () => {
    expect(permittedAdjustedRate(52000, 3, 2.5)).toBe(53300);
    expect(permittedAdjustedRate(52000, 3, 4)).toBe(53560);
    const r = evaluateLine({ ...S09, billedRatePaise: 53560 }, withTerms("RULED-B", patch("T09", { statedCpiPct: 4, ratePaise: 53560 })));
    expect(r.status).toBe("Match");
    expect(r.applicableRatePaise).toBe(53560);
  });

  it("ADJ02: a notice under the required days has no effect under Reading B", () => {
    const r = evaluateLine(S09, withTerms("RULED-B", patch("T09", { noticeDate: "2026-03-01" })));
    expect(r.adjustment).toBeUndefined();
    expect(r.applicableRatePaise).toBe(52000);
    expect(r.status).toBe("Potential discrepancy");
  });

  it("ADJ03: a claimed rate above the permitted rate is capped and the excess noted", () => {
    const r = evaluateLine({ ...S09, billedRatePaise: 54000 }, withTerms("RULED-B", patch("T09", { ratePaise: 54000 })));
    expect(r.applicableRatePaise).toBe(53300);
    expect(r.adjustment?.excessOverPermittedPaise).toBe(700);
    expect(r.differencePaise).toBe(70000);
    expect(r.explanation.join(" ")).toContain("above the permitted rate");
  });

  it("ADJ04: rounding to the paisa, half up", () => {
    expect(permittedAdjustedRate(52020, 3, 2.5)).toBe(53321); // 53320.5
    expect(permittedAdjustedRate(52010, 3, 2.5)).toBe(53310); // 53310.25
    expect(permittedAdjustedRate(52030, 3, 2.5)).toBe(53331); // 53330.75
  });

  it("MON01: decimal-safe money with fractional hours and odd paise", () => {
    expect(amountFor(7.5, 53300)).toBe(399750);
    expect(amountFor(0.1, 33333)).toBe(3333);
    expect(amountFor(33.33, 99999)).toBe(3332967);
    expect(amountFor(0.29, 100)).toBe(29);
    expect(formatINR(10500000)).toBe("₹1,05,000");
    expect(formatINR(1500000)).toBe("₹15,000");
    expect(formatINR(53560)).toBe("₹535.60");
    expect(formatINR(1234567800)).toBe("₹1,23,45,678");
    expect(parseRupees("1,200")).toBe(120000);
    expect(parseRupees("533.5")).toBe(53350);
    expect(parseRupees("abc")).toBeNull();
  });

  it("DATE01: effective dates are inclusive at both ends", () => {
    const ctx = withTerms("VR", patch("T02", { effectiveTo: "2026-09-30" }));
    const line: InvoiceLine = { ...fixtureById("S02")!.line };
    const last = evaluateLine({ ...line, serviceStart: "2026-09-30", serviceEnd: "2026-09-30" }, ctx);
    expect(last.applicableRatePaise).toBe(105000);
    const after = evaluateLine({ ...line, serviceStart: "2026-10-01", serviceEnd: "2026-10-01" }, ctx);
    expect(after.applicableRatePaise).toBe(120000);
    const first = evaluateLine({ ...line, serviceStart: "2026-08-01", serviceEnd: "2026-08-01" }, fixtureContext("VR"));
    expect(first.applicableRatePaise).toBe(105000);
    const across = evaluateLine({ ...line, serviceStart: "2026-09-25", serviceEnd: "2026-10-05" }, ctx);
    expect(across.needs?.map((n) => n.kind)).toEqual(["split"]);
  });

  it("C01: an unsigned draft never governs, splits or creates a location scenario", () => {
    const ctx = fixtureContext("VR");
    const pune = fixtureById("S06")!.line;
    const r = evaluateLine(pune, ctx);
    expect(r.applicableRatePaise).toBe(120000);
    expect(r.citedTermIds).not.toContain("T10");
    const across = evaluateLine({ ...pune, serviceStart: "2026-09-20", serviceEnd: "2026-10-10" }, ctx);
    expect(across.needs).toBeUndefined();
    const blank = evaluateLine({ ...pune, location: "" }, ctx);
    expect(blank.outcomes?.map((o) => o.label) ?? []).not.toContain("If Pune");
  });

  it("C02: a supplier notice never governs without a Reading B ruling", () => {
    for (const state of ["SEED", "VR", "CR", "RULED-A"] as const) {
      const r = evaluateLine(S09, fixtureContext(state));
      expect(r.applicableRatePaise === null || r.applicableRatePaise === 52000).toBe(true);
    }
  });

  it("C03: an unruled notice never creates a split request", () => {
    const line = { ...S09, serviceStart: "2026-03-15", serviceEnd: "2026-04-15" };
    for (const state of ["SEED", "VR", "CR"] as const) {
      expect(evaluateLine(line, fixtureContext(state)).needs).toBeUndefined();
    }
  });

  it("C04: an unverified signed amendment yields Awaiting verification for a line it affects", () => {
    const amendment: EngineTerm = {
      id: "U06",
      kind: "rate",
      title: "Uploaded amendment: L3 Hyderabad",
      docId: "UPLOAD-AMD",
      clauseId: "1",
      quote: "L3 Hyderabad ₹780 per hour",
      grade: "L3",
      location: "Hyderabad",
      ratePaise: 78000,
      effectiveFrom: "2026-09-01",
      replaces: "T04",
      initialStatus: "Proposed",
      status: "Proposed",
      signed: true,
      overrideVerified: false,
    };
    const r = evaluateLine(fixtureById("S08")!.line, withTerms("VR", (t) => [...t, amendment]));
    expect(r.status).toBe("Awaiting verification");
    expect(r.blockers?.[0]?.termIds).toContain("U06");
    expect(r.expectedPaise).toBeNull();
  });
});

describe("override links", () => {
  it("a Verified amending term with an unconfirmed link waits, confirming the link gives the verdict", () => {
    const line = fixtureById("S01")!.line;
    const states = statesWithVerified(["T02", "T04"]);
    const before = evaluateLine(line, buildContext(states, {}));
    expect(before.status).toBe("Awaiting verification");
    expect(before.explanation.join(" ")).toContain("Relationship between T01 and T02 not confirmed");
    expect(before.expectedPaise).toBeNull();
    states["T02"] = withOverrideConfirmed(states["T02"]!, true);
    const after = evaluateLine(line, buildContext(states, {}));
    expect(after.status).toBe("Potential discrepancy");
    expect(after.differencePaise).toBe(1500000);
  });
});

describe("engine rules", () => {
  it("does not infer a role from text like Analyst", () => {
    expect(resolveGrade("Analyst")).toBeNull();
    expect(resolveGrade("QA Analyst")).toBe("L2");
    expect(resolveGrade("Senior Software Engineer (Grade L4)")).toBe("L4");
  });

  it("orders blockers: Needs information, then Awaiting verification, then Needs Legal", () => {
    const blr: EngineTerm = {
      ...fixtureContext("CR").terms.find((t) => t.id === "T05")!,
      id: "X01",
      location: "Bengaluru",
      ratePaise: 50000,
    };
    const r = evaluateLine({ ...S09, location: "" }, withTerms("CR", (t) => [...t, blr]));
    expect(r.blockers?.map((b) => b.status)).toEqual(["Needs information", "Needs Legal"]);
    expect(r.status).toBe("Needs information");
    const l2 = evaluateLine({ ...S09, serviceStart: "2026-07-25", serviceEnd: "2026-08-08" }, withTerms("CR", patch("T05", { status: "Proposed" })));
    expect(l2.blockers?.map((b) => b.status)).toEqual(["Awaiting verification", "Needs Legal"]);
    expect(l2.status).toBe("Awaiting verification");
  });

  it("the conflict is in scope whatever amount Finance typed", () => {
    for (const billed of [52000, 53300, 54000, 99900]) {
      expect(evaluateLine({ ...S09, billedRatePaise: billed }, fixtureContext("CR")).status).toBe("Needs Legal");
    }
  });
});
