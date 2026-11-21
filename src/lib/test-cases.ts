import { fixtureById } from "@/data/fixtures";
import type { InvoiceLine, Reading } from "@/data/types";
import { evaluateLine, type PriceResult, type ResultStatus } from "./pricing-engine";
import { buildContext, initialTermStates, statesWithVerified } from "./term-state";

export interface TestCase {
  id: string;
  description: string;
  fixtureId: string;
  override?: Partial<InvoiceLine>;
  /** "seed" uses the initial statuses; "verified" verifies T02 and T04. */
  scenario: "seed" | "verified";
  ruling?: Reading;
  expected: {
    status: ResultStatus;
    ratePaise?: number;
    differencePaise?: number;
    needKind?: "location" | "split" | "grade";
    outcomes?: { label: string; ratePaise: number; differencePaise: number }[];
  };
}

export const TEST_CASES: TestCase[] = [
  { id: "S01a", description: "S01 before T02 is Verified", fixtureId: "S01", scenario: "seed", expected: { status: "Awaiting verification" } },
  { id: "S01", description: "L4 Bengaluru billed at old rate", fixtureId: "S01", scenario: "verified", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000 } },
  { id: "S02", description: "L4 Bengaluru billed at amended rate", fixtureId: "S02", scenario: "verified", expected: { status: "Match", ratePaise: 105000, differencePaise: 0 } },
  { id: "S03", description: "L4 Pune keeps Schedule A rate", fixtureId: "S03", scenario: "verified", expected: { status: "Match", ratePaise: 120000, differencePaise: 0 } },
  { id: "S04", description: "Day before amendment takes effect", fixtureId: "S04", scenario: "verified", expected: { status: "Match", ratePaise: 120000, differencePaise: 0 } },
  { id: "S05", description: "Effective date is inclusive", fixtureId: "S05", scenario: "verified", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000 } },
  { id: "S06", description: "Unsigned draft is ignored", fixtureId: "S06", scenario: "verified", expected: { status: "Match", ratePaise: 120000, differencePaise: 0 } },
  {
    id: "S07",
    description: "Location missing and rate depends on it",
    fixtureId: "S07",
    scenario: "verified",
    expected: {
      status: "Needs information",
      needKind: "location",
      outcomes: [
        { label: "If Bengaluru", ratePaise: 105000, differencePaise: 1500000 },
        { label: "If another center", ratePaise: 120000, differencePaise: 0 },
      ],
    },
  },
  { id: "S07+", description: "S07 after Bengaluru is supplied", fixtureId: "S07", override: { location: "Bengaluru" }, scenario: "verified", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000 } },
  { id: "S08", description: "L3 reduced for all centers", fixtureId: "S08", scenario: "verified", expected: { status: "Potential discrepancy", ratePaise: 80000, differencePaise: 400000 } },
  {
    id: "S09",
    description: "L2 at notice rate, no ruling",
    fixtureId: "S09",
    scenario: "verified",
    expected: {
      status: "Needs Legal",
      outcomes: [
        { label: "If Reading A (rates fixed)", ratePaise: 52000, differencePaise: 130000 },
        { label: "If Reading B (increase applies)", ratePaise: 53300, differencePaise: 0 },
      ],
    },
  },
  { id: "S09-A", description: "S09 after Legal rules Reading A", fixtureId: "S09", scenario: "verified", ruling: "A", expected: { status: "Potential discrepancy", ratePaise: 52000, differencePaise: 130000 } },
  { id: "S09-B", description: "S09 after Legal rules Reading B", fixtureId: "S09", scenario: "verified", ruling: "B", expected: { status: "Match", ratePaise: 53300, differencePaise: 0 } },
  { id: "S10", description: "Grade text is ambiguous", fixtureId: "S10", scenario: "verified", expected: { status: "Needs information", needKind: "grade" } },
  { id: "S11", description: "Service period spans 1 Aug 2026", fixtureId: "S11", scenario: "verified", expected: { status: "Needs information", needKind: "split" } },
];

export interface TestRun {
  testCase: TestCase;
  line: InvoiceLine;
  result: PriceResult;
  pass: boolean;
  mismatches: string[];
}

export function runTestCase(tc: TestCase): TestRun {
  const fixture = fixtureById(tc.fixtureId);
  if (!fixture) throw new Error(`Unknown fixture ${tc.fixtureId}`);
  const line = { ...fixture.line, ...tc.override };
  const verifiedIds = tc.scenario === "verified" ? ["T02", "T04"] : [];
  // A ruling resolves the conflict terms, as the app does when Legal records one.
  if (tc.ruling) verifiedIds.push("T06", "T07", "T08", "T09");
  const states = tc.scenario === "seed" && !tc.ruling ? initialTermStates() : statesWithVerified(verifiedIds);
  const ctx = buildContext(states, tc.ruling ? { C1: tc.ruling } : {});
  const result = evaluateLine(line, ctx);

  const m: string[] = [];
  const e = tc.expected;
  if (result.status !== e.status) m.push(`status: expected ${e.status}, got ${result.status}`);
  if (e.ratePaise !== undefined && result.applicableRatePaise !== e.ratePaise)
    m.push(`rate: expected ${e.ratePaise}, got ${result.applicableRatePaise}`);
  if (e.differencePaise !== undefined && result.differencePaise !== e.differencePaise)
    m.push(`difference: expected ${e.differencePaise}, got ${result.differencePaise}`);
  if (e.needKind && result.need?.kind !== e.needKind)
    m.push(`need: expected ${e.needKind}, got ${result.need?.kind ?? "none"}`);
  if (e.outcomes) {
    for (const eo of e.outcomes) {
      const ao = result.outcomes?.find((o) => o.label === eo.label);
      if (!ao) m.push(`outcome "${eo.label}" missing`);
      else if (ao.ratePaise !== eo.ratePaise || ao.differencePaise !== eo.differencePaise)
        m.push(`outcome "${eo.label}": expected ${eo.ratePaise}/${eo.differencePaise}, got ${ao.ratePaise}/${ao.differencePaise}`);
    }
  }
  if (e.status !== "Awaiting verification" && result.status === "Awaiting verification") m.push("unexpected awaiting");
  return { testCase: tc, line, result, pass: m.length === 0, mismatches: m };
}

export const runAllTests = () => TEST_CASES.map(runTestCase);
