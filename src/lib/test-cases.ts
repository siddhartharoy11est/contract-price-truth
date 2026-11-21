import { fixtureById } from "@/data/fixtures";
import type { InvoiceLine } from "@/data/types";
import { evaluateLine, NEEDS_LEGAL_SAME_CLASS_NOTE, type NeedKind, type PriceResult, type ResultStatus } from "./pricing-engine";
import { buildContext, fixtureState, withOverrideConfirmed, type FixtureState } from "./term-state";

/**
 * PRD v0.4.2 sections 8.1 and 8.2. Single source of expected outcomes, shared by the
 * Prototype Validation page and the engine test file.
 */
export interface TestCase {
  id: string;
  description: string;
  fixtureId: string;
  override?: Partial<InvoiceLine>;
  /** PRD fixture state: SEED, VR, CR, RULED-A or RULED-B. */
  state: FixtureState;
  /** Term ids whose override link is explicitly left unconfirmed (S12). */
  unconfirmedOverrides?: string[];
  expected: {
    status: ResultStatus;
    ratePaise?: number;
    differencePaise?: number;
    needKind?: NeedKind;
    /** Every Needs information kind, in order. Empty means no question asked. */
    needKinds?: NeedKind[];
    /** No amount and no verdict anywhere on the result. */
    noAmounts?: boolean;
    blockerTermIds?: string[];
    citesTermIds?: string[];
    notConsidered?: string[];
    poNote?: boolean;
    explanationIncludes?: string[];
    outcomes?: { label: string; ratePaise: number; differencePaise: number | null }[];
  };
}

const MAR_APR = { serviceStart: "2026-03-15", serviceEnd: "2026-04-15", billedRatePaise: 52000 };
const L2_BLR = { grade: "L2", location: "Bengaluru", billedRatePaise: 52000 };
const A = "If Reading A (rates fixed)";
const B = "If Reading B (adjustment applies)";

export const TEST_CASES: TestCase[] = [
  // 8.1 Rates, location, dates and verification
  { id: "S01", description: "L4 Bengaluru billed at old rate, PO agrees", fixtureId: "S01", state: "VR", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000, citesTermIds: ["T02"], poNote: true, explanationIncludes: ["BH-AMD-01-2026 2.1"] } },
  { id: "S01a", description: "S01 before T02 is verified", fixtureId: "S01", state: "SEED", expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] } },
  { id: "S02", description: "L4 Bengaluru billed at amended rate", fixtureId: "S02", state: "VR", expected: { status: "Match", ratePaise: 105000, differencePaise: 0 } },
  { id: "S02a", description: "S02 before T02 is verified is not Match", fixtureId: "S02", state: "SEED", expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] } },
  { id: "S03", description: "L4 Pune keeps Schedule A rate, T02 not considered", fixtureId: "S03", state: "SEED", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, notConsidered: ["T02"], explanationIncludes: ["T02 not considered: Bengaluru only"] } },
  { id: "S04", description: "July, before the amendment takes effect", fixtureId: "S04", state: "SEED", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] } },
  { id: "S05", description: "Change on the start date needs no split", fixtureId: "S05", state: "VR", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000, needKinds: [] } },
  { id: "S06", description: "Unsigned draft listed under Not considered", fixtureId: "S06", state: "SEED", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, notConsidered: ["T10"] } },
  { id: "S06a", description: "Draft date inside the period creates no split", fixtureId: "S06", override: { serviceStart: "2026-09-20", serviceEnd: "2026-10-10" }, state: "VR", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] } },
  {
    id: "S07",
    description: "Location blank and decisive",
    fixtureId: "S07",
    state: "VR",
    expected: {
      status: "Needs information",
      needKinds: ["location"],
      outcomes: [
        { label: "If Bengaluru", ratePaise: 105000, differencePaise: 1500000 },
        { label: "If another center", ratePaise: 120000, differencePaise: 0 },
      ],
    },
  },
  {
    id: "S07p",
    description: "Location blank, Bengaluru branch provisional",
    fixtureId: "S07",
    state: "SEED",
    expected: {
      status: "Needs information",
      needKinds: ["location"],
      explanationIncludes: [],
      outcomes: [
        { label: "If Bengaluru", ratePaise: 105000, differencePaise: null },
        { label: "If another center", ratePaise: 120000, differencePaise: 0 },
      ],
    },
  },
  { id: "S07R-B", description: "S07 after Bengaluru is supplied", fixtureId: "S07", override: { location: "Bengaluru" }, state: "VR", expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000 } },
  { id: "S07R-P", description: "S07 after Pune is supplied", fixtureId: "S07", override: { location: "Pune" }, state: "VR", expected: { status: "Match", ratePaise: 120000, differencePaise: 0 } },
  { id: "S07R-Bp", description: "S07 plus Bengaluru before T02 is verified", fixtureId: "S07", override: { location: "Bengaluru" }, state: "SEED", expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] } },
  { id: "S08", description: "L3 reduced for all centers", fixtureId: "S08", state: "VR", expected: { status: "Potential discrepancy", ratePaise: 80000, differencePaise: 400000 } },
  { id: "S08a", description: "S08 before T04 is verified", fixtureId: "S08", state: "SEED", expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T04"] } },
  { id: "S10", description: "Role text Analyst is not inferred", fixtureId: "S10", state: "VR", expected: { status: "Needs information", needKind: "grade", noAmounts: true } },
  { id: "S11", description: "Period spans 1 Aug 2026, split by date", fixtureId: "S11", state: "VR", expected: { status: "Needs information", needKinds: ["split"], explanationIncludes: ["1 Aug 2026"] } },
  { id: "S11a", description: "Same period in Pune needs no split", fixtureId: "S11", override: { location: "Pune" }, state: "VR", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] } },
  { id: "S11b", description: "L2 Bengaluru after Reading A ruling", fixtureId: "S11", override: L2_BLR, state: "RULED-A", expected: { status: "Match", ratePaise: 52000, differencePaise: 0, needKinds: [] } },
  { id: "S11b-SEED", description: "S11b line in SEED, clauses not reviewed", fixtureId: "S11", override: L2_BLR, state: "SEED", expected: { status: "Awaiting verification", noAmounts: true } },
  { id: "S11b-VR", description: "S11b line in VR, clauses not reviewed", fixtureId: "S11", override: L2_BLR, state: "VR", expected: { status: "Awaiting verification", noAmounts: true } },
  { id: "S11b-CR", description: "S11b line in CR, conflict with Legal", fixtureId: "S11", override: L2_BLR, state: "CR", expected: { status: "Needs Legal", needKinds: [] } },
  { id: "S11c", description: "Split may be needed once T02 is verified", fixtureId: "S11", state: "SEED", expected: { status: "Awaiting verification", noAmounts: true, needKinds: [], blockerTermIds: ["T02"], explanationIncludes: ["split by date at 1 Aug 2026 may be needed"] } },
  { id: "S11d", description: "Location blank, Bengaluru branch would need a split", fixtureId: "S11", override: { location: "" }, state: "VR", expected: { status: "Needs information", needKinds: ["location", "split"] } },
  { id: "S12", description: "T02 verified but override link unconfirmed", fixtureId: "S01", state: "VR", unconfirmedOverrides: ["T02"], expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T01", "T02"], explanationIncludes: ["Relationship between T01 and T02 not confirmed"] } },
  { id: "S13", description: "Supplier with no signed rate", fixtureId: "S13", state: "VR", expected: { status: "Needs information", needKind: "no-rate", noAmounts: true, explanationIncludes: ["no signed rate on file"] } },
  { id: "S14", description: "Other or not listed uses all-location terms", fixtureId: "S14", state: "VR", expected: { status: "Match", ratePaise: 120000, differencePaise: 0, explanationIncludes: ["only all-location terms were used"] } },

  // 8.2 Contractual conflict: billed rate must not matter
  { id: "S09-0", description: "Clauses and notice not reviewed", fixtureId: "S09", state: "VR", expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T06", "T07", "T08", "T09"] } },
  { id: "S09", description: "Billed 533, conflict with Legal", fixtureId: "S09", state: "CR", expected: { status: "Needs Legal", outcomes: [{ label: A, ratePaise: 52000, differencePaise: 130000 }, { label: B, ratePaise: 53300, differencePaise: 0 }] } },
  { id: "S09b", description: "Billed 520 is still Needs Legal", fixtureId: "S09", override: { billedRatePaise: 52000 }, state: "CR", expected: { status: "Needs Legal", outcomes: [{ label: A, ratePaise: 52000, differencePaise: 0 }, { label: B, ratePaise: 53300, differencePaise: -130000 }] } },
  { id: "S09c", description: "Billed 540, both readings show a discrepancy", fixtureId: "S09", override: { billedRatePaise: 54000 }, state: "CR", expected: { status: "Needs Legal", explanationIncludes: [NEEDS_LEGAL_SAME_CLASS_NOTE], outcomes: [{ label: A, ratePaise: 52000, differencePaise: 200000 }, { label: B, ratePaise: 53300, differencePaise: 70000 }] } },
  { id: "S09d", description: "Feb 2026 is before the claim, out of scope", fixtureId: "S09", override: { billedRatePaise: 52000, serviceStart: "2026-02-01", serviceEnd: "2026-02-28" }, state: "CR", expected: { status: "Match", ratePaise: 52000, differencePaise: 0 } },
  { id: "S09e", description: "L3 line unaffected by the L2 claim", fixtureId: "S08", state: "CR", expected: { status: "Potential discrepancy", ratePaise: 80000, differencePaise: 400000 } },
  { id: "S09-A-533", description: "Reading A, billed 533", fixtureId: "S09", state: "RULED-A", expected: { status: "Potential discrepancy", ratePaise: 52000, differencePaise: 130000 } },
  { id: "S09-A-520", description: "Reading A, billed 520", fixtureId: "S09", override: { billedRatePaise: 52000 }, state: "RULED-A", expected: { status: "Match", ratePaise: 52000, differencePaise: 0 } },
  { id: "S09-A-540", description: "Reading A, billed 540", fixtureId: "S09", override: { billedRatePaise: 54000 }, state: "RULED-A", expected: { status: "Potential discrepancy", ratePaise: 52000, differencePaise: 200000 } },
  { id: "S09-B-533", description: "Reading B, billed 533", fixtureId: "S09", state: "RULED-B", expected: { status: "Match", ratePaise: 53300, differencePaise: 0 } },
  { id: "S09-B-520", description: "Reading B, billed 520", fixtureId: "S09", override: { billedRatePaise: 52000 }, state: "RULED-B", expected: { status: "Billed below contract", ratePaise: 53300, differencePaise: -130000 } },
  { id: "S09-B-540", description: "Reading B, billed 540", fixtureId: "S09", override: { billedRatePaise: 54000 }, state: "RULED-B", expected: { status: "Potential discrepancy", ratePaise: 53300, differencePaise: 70000 } },
  { id: "S11e-U", description: "Mar to Apr 2026, claim in scope, no split", fixtureId: "S09", override: MAR_APR, state: "CR", expected: { status: "Needs Legal", needKinds: [] } },
  { id: "S11e-A", description: "Mar to Apr 2026 after Reading A", fixtureId: "S09", override: MAR_APR, state: "RULED-A", expected: { status: "Match", ratePaise: 52000, differencePaise: 0, needKinds: [] } },
  { id: "S11e-B", description: "Mar to Apr 2026 after Reading B, split at 1 Apr", fixtureId: "S09", override: MAR_APR, state: "RULED-B", expected: { status: "Needs information", needKinds: ["split"], explanationIncludes: ["1 Apr 2026"] } },
];

export interface TestRun {
  testCase: TestCase;
  line: InvoiceLine;
  result: PriceResult;
  pass: boolean;
  mismatches: string[];
}

export function contextFor(tc: Pick<TestCase, "state" | "unconfirmedOverrides">) {
  const { states, rulings } = fixtureState(tc.state);
  for (const id of tc.unconfirmedOverrides ?? []) states[id] = withOverrideConfirmed(states[id]!, false);
  return buildContext(states, rulings);
}

export function runTestCase(tc: TestCase): TestRun {
  const fixture = fixtureById(tc.fixtureId);
  if (!fixture) throw new Error(`Unknown fixture ${tc.fixtureId}`);
  const line = { ...fixture.line, ...tc.override };
  const result = evaluateLine(line, contextFor(tc));

  const m: string[] = [];
  const e = tc.expected;
  if (result.status !== e.status) m.push(`status: expected ${e.status}, got ${result.status}`);
  if (e.ratePaise !== undefined && result.applicableRatePaise !== e.ratePaise)
    m.push(`rate: expected ${e.ratePaise}, got ${result.applicableRatePaise}`);
  if (e.differencePaise !== undefined && result.differencePaise !== e.differencePaise)
    m.push(`difference: expected ${e.differencePaise}, got ${result.differencePaise}`);
  if (e.needKind && result.need?.kind !== e.needKind)
    m.push(`need: expected ${e.needKind}, got ${result.need?.kind ?? "none"}`);
  if (e.needKinds) {
    const got = (result.needs ?? []).map((n) => n.kind).join(",");
    if (got !== e.needKinds.join(",")) m.push(`needs: expected [${e.needKinds.join(",")}], got [${got}]`);
  }
  if (e.noAmounts) {
    if (result.expectedPaise !== null || result.differencePaise !== null || result.applicableRatePaise !== null)
      m.push("amounts shown on a blocked result");
    if (result.outcomes?.length) m.push("outcomes shown on a blocked result");
  }
  for (const id of e.blockerTermIds ?? []) {
    const top = result.blockers?.[0];
    if (!top || !top.termIds.includes(id)) m.push(`first blocker does not name ${id}`);
  }
  for (const id of e.citesTermIds ?? []) if (!result.citedTermIds.includes(id)) m.push(`does not cite ${id}`);
  for (const id of e.notConsidered ?? [])
    if (!result.notConsidered?.some((n) => n.termId === id)) m.push(`${id} not listed under Not considered`);
  if (e.poNote && !result.poNote) m.push("PO note missing");
  const text = result.explanation.join(" ").toLowerCase();
  for (const s of e.explanationIncludes ?? []) if (!text.includes(s.toLowerCase())) m.push(`explanation lacks "${s}"`);
  if (e.outcomes) {
    for (const eo of e.outcomes) {
      const ao = result.outcomes?.find((o) => o.label === eo.label);
      if (!ao) m.push(`outcome "${eo.label}" missing`);
      else if (ao.ratePaise !== eo.ratePaise || ao.differencePaise !== eo.differencePaise)
        m.push(`outcome "${eo.label}": expected ${eo.ratePaise}/${eo.differencePaise}, got ${ao.ratePaise}/${ao.differencePaise}`);
      else if (eo.differencePaise === null && ao.verdict !== null) m.push(`outcome "${eo.label}" shows a verdict`);
    }
  }
  return { testCase: tc, line, result, pass: m.length === 0, mismatches: m };
}

export const runAllTests = () => TEST_CASES.map(runTestCase);
