import { fixtureById } from "@/data/fixtures";
import type { InvoiceLine } from "@/data/types";
import {
  evaluateLine,
  NEEDS_LEGAL_SAME_CLASS_NOTE,
  type NeedKind,
  type PriceResult,
  type ResultStatus,
} from "./pricing-engine";
import { buildContext, fixtureState, withOverrideConfirmed, type FixtureState } from "./term-state";
import { formatINR } from "./money";
import * as samples from "./upload-fixtures";
import * as up from "./uploads";
import * as wf from "./workflow";

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
  {
    id: "S01",
    description: "L4 Bengaluru billed at old rate, PO agrees",
    fixtureId: "S01",
    state: "VR",
    expected: {
      status: "Potential discrepancy",
      ratePaise: 105000,
      differencePaise: 1500000,
      citesTermIds: ["T02"],
      poNote: true,
      explanationIncludes: ["BH-AMD-01-2026 2.1"],
    },
  },
  {
    id: "S01a",
    description: "S01 before T02 is verified",
    fixtureId: "S01",
    state: "SEED",
    expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] },
  },
  {
    id: "S02",
    description: "L4 Bengaluru billed at amended rate",
    fixtureId: "S02",
    state: "VR",
    expected: { status: "Match", ratePaise: 105000, differencePaise: 0 },
  },
  {
    id: "S02a",
    description: "S02 before T02 is verified is not Match",
    fixtureId: "S02",
    state: "SEED",
    expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] },
  },
  {
    id: "S03",
    description: "L4 Pune keeps Schedule A rate, T02 not considered",
    fixtureId: "S03",
    state: "SEED",
    expected: {
      status: "Match",
      ratePaise: 120000,
      differencePaise: 0,
      notConsidered: ["T02"],
      explanationIncludes: ["T02 not considered: Bengaluru only"],
    },
  },
  {
    id: "S04",
    description: "July, before the amendment takes effect",
    fixtureId: "S04",
    state: "SEED",
    expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] },
  },
  {
    id: "S05",
    description: "Change on the start date needs no split",
    fixtureId: "S05",
    state: "VR",
    expected: {
      status: "Potential discrepancy",
      ratePaise: 105000,
      differencePaise: 1500000,
      needKinds: [],
    },
  },
  {
    id: "S06",
    description: "Unsigned draft listed under Not considered",
    fixtureId: "S06",
    state: "SEED",
    expected: { status: "Match", ratePaise: 120000, differencePaise: 0, notConsidered: ["T10"] },
  },
  {
    id: "S06a",
    description: "Draft date inside the period creates no split",
    fixtureId: "S06",
    override: { serviceStart: "2026-09-20", serviceEnd: "2026-10-10" },
    state: "VR",
    expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] },
  },
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
  {
    id: "S07R-B",
    description: "S07 after Bengaluru is supplied",
    fixtureId: "S07",
    override: { location: "Bengaluru" },
    state: "VR",
    expected: { status: "Potential discrepancy", ratePaise: 105000, differencePaise: 1500000 },
  },
  {
    id: "S07R-P",
    description: "S07 after Pune is supplied",
    fixtureId: "S07",
    override: { location: "Pune" },
    state: "VR",
    expected: { status: "Match", ratePaise: 120000, differencePaise: 0 },
  },
  {
    id: "S07R-Bp",
    description: "S07 plus Bengaluru before T02 is verified",
    fixtureId: "S07",
    override: { location: "Bengaluru" },
    state: "SEED",
    expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T02"] },
  },
  {
    id: "S08",
    description: "L3 reduced for all centers",
    fixtureId: "S08",
    state: "VR",
    expected: { status: "Potential discrepancy", ratePaise: 80000, differencePaise: 400000 },
  },
  {
    id: "S08a",
    description: "S08 before T04 is verified",
    fixtureId: "S08",
    state: "SEED",
    expected: { status: "Awaiting verification", noAmounts: true, blockerTermIds: ["T04"] },
  },
  {
    id: "S10",
    description: "Role text Analyst is not inferred",
    fixtureId: "S10",
    state: "VR",
    expected: { status: "Needs information", needKind: "grade", noAmounts: true },
  },
  {
    id: "S11",
    description: "Period spans 1 Aug 2026, split by date",
    fixtureId: "S11",
    state: "VR",
    expected: {
      status: "Needs information",
      needKinds: ["split"],
      explanationIncludes: ["1 Aug 2026"],
    },
  },
  {
    id: "S11a",
    description: "Same period in Pune needs no split",
    fixtureId: "S11",
    override: { location: "Pune" },
    state: "VR",
    expected: { status: "Match", ratePaise: 120000, differencePaise: 0, needKinds: [] },
  },
  {
    id: "S11b",
    description: "L2 Bengaluru after Reading A ruling",
    fixtureId: "S11",
    override: L2_BLR,
    state: "RULED-A",
    expected: { status: "Match", ratePaise: 52000, differencePaise: 0, needKinds: [] },
  },
  {
    id: "S11b-SEED",
    description: "S11b line in SEED, clauses not reviewed",
    fixtureId: "S11",
    override: L2_BLR,
    state: "SEED",
    expected: { status: "Awaiting verification", noAmounts: true },
  },
  {
    id: "S11b-VR",
    description: "S11b line in VR, clauses not reviewed",
    fixtureId: "S11",
    override: L2_BLR,
    state: "VR",
    expected: { status: "Awaiting verification", noAmounts: true },
  },
  {
    id: "S11b-CR",
    description: "S11b line in CR, conflict with Legal",
    fixtureId: "S11",
    override: L2_BLR,
    state: "CR",
    expected: { status: "Needs Legal", needKinds: [] },
  },
  {
    id: "S11c",
    description: "Split may be needed once T02 is verified",
    fixtureId: "S11",
    state: "SEED",
    expected: {
      status: "Awaiting verification",
      noAmounts: true,
      needKinds: [],
      blockerTermIds: ["T02"],
      explanationIncludes: ["split by date at 1 Aug 2026 may be needed"],
    },
  },
  {
    id: "S11d",
    description: "Location blank, Bengaluru branch would need a split",
    fixtureId: "S11",
    override: { location: "" },
    state: "VR",
    expected: { status: "Needs information", needKinds: ["location", "split"] },
  },
  {
    id: "S12",
    description: "T02 verified but override link unconfirmed",
    fixtureId: "S01",
    state: "VR",
    unconfirmedOverrides: ["T02"],
    expected: {
      status: "Awaiting verification",
      noAmounts: true,
      blockerTermIds: ["T01", "T02"],
      explanationIncludes: ["Relationship between T01 and T02 not confirmed"],
    },
  },
  {
    id: "S13",
    description: "Supplier with no signed rate",
    fixtureId: "S13",
    state: "VR",
    expected: {
      status: "Needs information",
      needKind: "no-rate",
      noAmounts: true,
      explanationIncludes: ["no signed rate on file"],
    },
  },
  {
    id: "S14",
    description: "Other or not listed uses all-location terms",
    fixtureId: "S14",
    state: "VR",
    expected: {
      status: "Match",
      ratePaise: 120000,
      differencePaise: 0,
      explanationIncludes: ["only all-location terms were used"],
    },
  },

  // 8.2 Contractual conflict: billed rate must not matter
  {
    id: "S09-0",
    description: "Clauses and notice not reviewed",
    fixtureId: "S09",
    state: "VR",
    expected: {
      status: "Awaiting verification",
      noAmounts: true,
      blockerTermIds: ["T06", "T07", "T08", "T09"],
    },
  },
  {
    id: "S09",
    description: "Billed 533, conflict with Legal",
    fixtureId: "S09",
    state: "CR",
    expected: {
      status: "Needs Legal",
      outcomes: [
        { label: A, ratePaise: 52000, differencePaise: 130000 },
        { label: B, ratePaise: 53300, differencePaise: 0 },
      ],
    },
  },
  {
    id: "S09b",
    description: "Billed 520 is still Needs Legal",
    fixtureId: "S09",
    override: { billedRatePaise: 52000 },
    state: "CR",
    expected: {
      status: "Needs Legal",
      outcomes: [
        { label: A, ratePaise: 52000, differencePaise: 0 },
        { label: B, ratePaise: 53300, differencePaise: -130000 },
      ],
    },
  },
  {
    id: "S09c",
    description: "Billed 540, both readings show a discrepancy",
    fixtureId: "S09",
    override: { billedRatePaise: 54000 },
    state: "CR",
    expected: {
      status: "Needs Legal",
      explanationIncludes: [NEEDS_LEGAL_SAME_CLASS_NOTE],
      outcomes: [
        { label: A, ratePaise: 52000, differencePaise: 200000 },
        { label: B, ratePaise: 53300, differencePaise: 70000 },
      ],
    },
  },
  {
    id: "S09d",
    description: "Feb 2026 is before the claim, out of scope",
    fixtureId: "S09",
    override: { billedRatePaise: 52000, serviceStart: "2026-02-01", serviceEnd: "2026-02-28" },
    state: "CR",
    expected: { status: "Match", ratePaise: 52000, differencePaise: 0 },
  },
  {
    id: "S09e",
    description: "L3 line unaffected by the L2 claim",
    fixtureId: "S08",
    state: "CR",
    expected: { status: "Potential discrepancy", ratePaise: 80000, differencePaise: 400000 },
  },
  {
    id: "S09-A-533",
    description: "Reading A, billed 533",
    fixtureId: "S09",
    state: "RULED-A",
    expected: { status: "Potential discrepancy", ratePaise: 52000, differencePaise: 130000 },
  },
  {
    id: "S09-A-520",
    description: "Reading A, billed 520",
    fixtureId: "S09",
    override: { billedRatePaise: 52000 },
    state: "RULED-A",
    expected: { status: "Match", ratePaise: 52000, differencePaise: 0 },
  },
  {
    id: "S09-A-540",
    description: "Reading A, billed 540",
    fixtureId: "S09",
    override: { billedRatePaise: 54000 },
    state: "RULED-A",
    expected: { status: "Potential discrepancy", ratePaise: 52000, differencePaise: 200000 },
  },
  {
    id: "S09-B-533",
    description: "Reading B, billed 533",
    fixtureId: "S09",
    state: "RULED-B",
    expected: { status: "Match", ratePaise: 53300, differencePaise: 0 },
  },
  {
    id: "S09-B-520",
    description: "Reading B, billed 520",
    fixtureId: "S09",
    override: { billedRatePaise: 52000 },
    state: "RULED-B",
    expected: { status: "Billed below contract", ratePaise: 53300, differencePaise: -130000 },
  },
  {
    id: "S09-B-540",
    description: "Reading B, billed 540",
    fixtureId: "S09",
    override: { billedRatePaise: 54000 },
    state: "RULED-B",
    expected: { status: "Potential discrepancy", ratePaise: 53300, differencePaise: 70000 },
  },
  {
    id: "S11e-U",
    description: "Mar to Apr 2026, claim in scope, no split",
    fixtureId: "S09",
    override: MAR_APR,
    state: "CR",
    expected: { status: "Needs Legal", needKinds: [] },
  },
  {
    id: "S11e-A",
    description: "Mar to Apr 2026 after Reading A",
    fixtureId: "S09",
    override: MAR_APR,
    state: "RULED-A",
    expected: { status: "Match", ratePaise: 52000, differencePaise: 0, needKinds: [] },
  },
  {
    id: "S11e-B",
    description: "Mar to Apr 2026 after Reading B, split at 1 Apr",
    fixtureId: "S09",
    override: MAR_APR,
    state: "RULED-B",
    expected: {
      status: "Needs information",
      needKinds: ["split"],
      explanationIncludes: ["1 Apr 2026"],
    },
  },
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
  for (const id of tc.unconfirmedOverrides ?? [])
    states[id] = withOverrideConfirmed(states[id]!, false);
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
    if (got !== e.needKinds.join(","))
      m.push(`needs: expected [${e.needKinds.join(",")}], got [${got}]`);
  }
  if (e.noAmounts) {
    if (
      result.expectedPaise !== null ||
      result.differencePaise !== null ||
      result.applicableRatePaise !== null
    )
      m.push("amounts shown on a blocked result");
    if (result.outcomes?.length) m.push("outcomes shown on a blocked result");
  }
  for (const id of e.blockerTermIds ?? []) {
    const top = result.blockers?.[0];
    if (!top || !top.termIds.includes(id)) m.push(`first blocker does not name ${id}`);
  }
  for (const id of e.citesTermIds ?? [])
    if (!result.citedTermIds.includes(id)) m.push(`does not cite ${id}`);
  for (const id of e.notConsidered ?? [])
    if (!result.notConsidered?.some((n) => n.termId === id))
      m.push(`${id} not listed under Not considered`);
  if (e.poNote && !result.poNote) m.push("PO note missing");
  const text = result.explanation.join(" ").toLowerCase();
  for (const s of e.explanationIncludes ?? [])
    if (!text.includes(s.toLowerCase())) m.push(`explanation lacks "${s}"`);
  if (e.outcomes) {
    for (const eo of e.outcomes) {
      const ao = result.outcomes?.find((o) => o.label === eo.label);
      if (!ao) m.push(`outcome "${eo.label}" missing`);
      else if (ao.ratePaise !== eo.ratePaise || ao.differencePaise !== eo.differencePaise)
        m.push(
          `outcome "${eo.label}": expected ${eo.ratePaise}/${eo.differencePaise}, got ${ao.ratePaise}/${ao.differencePaise}`,
        );
      else if (eo.differencePaise === null && ao.verdict !== null)
        m.push(`outcome "${eo.label}" shows a verdict`);
    }
  }
  return { testCase: tc, line, result, pass: m.length === 0, mismatches: m };
}

export const runAllTests = () => TEST_CASES.map(runTestCase);

// ---------- Journey and store cases (PRD 5.1 to 5.4, 8.5) ----------

/**
 * Journey cases walk the real workflow and engine on a fresh in-memory copy of the seed,
 * never the visitor's data, and need no network or model call. Live model output is replaced
 * by the fixed sample output in upload-fixtures.ts, which still passes through the real quote
 * checks. Each case lists its expected checkpoints; the actual ones are computed.
 */
export interface JourneyCase {
  id: string;
  journey: "A" | "B" | "C" | "D";
  description: string;
  expected: string[];
  run: () => string[];
}

export interface JourneyRun {
  testCase: JourneyCase;
  actual: string[];
  pass: boolean;
  mismatches: string[];
}

const ACTOR = (by: string, role: wf.Actor["role"]): wf.Actor => ({
  by,
  role,
  at: "2026-11-21T10:00:00.000Z",
});
const PRIYA = ACTOR("Priya Nair", "procurement");
const DEV = ACTOR("Dev Mehta", "finance");
const ANIKA = ACTOR("Anika Rao", "legal");

/** Status, amount and blocker terms of a result, in words. */
export function checkpoint(r: PriceResult): string {
  const parts: string[] = [r.status];
  if (r.differencePaise !== null)
    parts.push(
      r.differencePaise > 0
        ? `${formatINR(r.differencePaise)} excess`
        : r.differencePaise < 0
          ? `${formatINR(-r.differencePaise)} below`
          : "no difference",
    );
  const blockers = [...new Set((r.blockers ?? []).flatMap((b) => b.termIds))];
  if (r.status === "Awaiting verification" && blockers.length)
    parts.push(`names ${blockers.join(", ")}`);
  if (r.status === "Needs information")
    parts.push(`asks for ${(r.needs ?? []).map((n) => n.kind).join(", ")}`);
  return parts.join(", ");
}

const latestResult = (ws: wf.WorkflowState, id: string) =>
  ws.assessments.find((a) => a.id === id)!.versions.at(-1)!.result;
const versionCount = (ws: wf.WorkflowState, id: string) =>
  ws.assessments.find((a) => a.id === id)!.versions.length;

/** A fresh workflow in fixture state VR: rate terms and override links verified. */
function vrWorkflow(): wf.WorkflowState {
  return { ...wf.seedWorkflow(), terms: fixtureState("VR").states };
}

const fx = (id: string) => fixtureById(id)!.line;

function uploadSample(
  ws: wf.WorkflowState,
  which: "orbis" | "amendment3",
  signing: "Signed" | "Unsigned draft" = "Signed",
) {
  const orbis = which === "orbis";
  return up.addUploadedDocument(ws, PRIYA, {
    supplier: orbis ? { newName: "Orbis Facilities Services" } : { id: "brighthire" },
    fileName: orbis ? "Orbis_Order_Form_SAMPLE.pdf" : "BrightHire_Amendment_3_SAMPLE.pdf",
    title: orbis ? "Order Form OFS-2026-014" : "Amendment 3",
    documentType: orbis ? "Order Form" : "Amendment",
    signingStatus: signing,
    pages: orbis ? samples.ORBIS_PAGES : samples.AMENDMENT_3_PAGES,
  });
}

const orbisLine = (supplierId: string): InvoiceLine => ({
  supplierId,
  grade: "Facilities Supervisor",
  location: "",
  serviceStart: "2026-12-01",
  serviceEnd: "2026-12-31",
  hours: 100,
  billedRatePaise: 66000,
  poRatePaise: 66000,
});

const thrown = (fn: () => unknown): string => {
  try {
    fn();
    return "allowed";
  } catch (e) {
    return e instanceof wf.WorkflowError ? "refused" : "error";
  }
};

export const JOURNEY_CASES: JourneyCase[] = [
  {
    id: "JA",
    journey: "A",
    description: "S01 from SEED: verify T02, confirm the override link, then the excess",
    expected: [
      "check S01: Awaiting verification, names T02",
      "after T02 verified: Awaiting verification, names T01, T02",
      "after link confirmed: Potential discrepancy, ₹15,000 excess",
      "versions kept: 2",
    ],
    run: () => {
      let ws = wf.seedWorkflow();
      const s = wf.saveCheck(ws, DEV, fx("S01"), "S01");
      ws = s.state;
      const out = [`check S01: ${checkpoint(latestResult(ws, s.assessmentId))}`];
      ws = wf.verifyTerm(ws, PRIYA, "T02", "Quote and fields checked");
      out.push(`after T02 verified: ${checkpoint(evaluateLine(fx("S01"), wf.contextOf(ws)))}`);
      ws = wf.confirmOverride(ws, PRIYA, "T02");
      out.push(`after link confirmed: ${checkpoint(latestResult(ws, s.assessmentId))}`);
      out.push(`versions kept: ${versionCount(ws, s.assessmentId)}`);
      return out;
    },
  },
  {
    id: "JB",
    journey: "B",
    description: "S07 location missing, Procurement supplies Bengaluru, new version",
    expected: [
      "check S07: Needs information, asks for location",
      "review requested: Open",
      "after Bengaluru supplied: Potential discrepancy, ₹15,000 excess",
      "versions kept: 2, facts: 1",
    ],
    run: () => {
      let ws = vrWorkflow();
      const s = wf.saveCheck(ws, DEV, fx("S07"), "S07");
      ws = s.state;
      const out = [`check S07: ${checkpoint(latestResult(ws, s.assessmentId))}`];
      const r = wf.requestReview(ws, DEV, s.assessmentId);
      ws = r.state;
      const inv = ws.investigations.find((i) => i.id === r.investigationId)!;
      const a = ws.assessments.find((x) => x.id === s.assessmentId)!;
      out.push(`review requested: ${wf.investigationStatus(inv, a, ws.conflictCases)}`);
      ws = wf.supplyFact(ws, PRIYA, s.assessmentId, { kind: "location", value: "Bengaluru" });
      out.push(`after Bengaluru supplied: ${checkpoint(latestResult(ws, s.assessmentId))}`);
      const facts = ws.assessments.find((x) => x.id === s.assessmentId)!.facts.length;
      out.push(`versions kept: ${versionCount(ws, s.assessmentId)}, facts: ${facts}`);
      return out;
    },
  },
  {
    id: "JC",
    journey: "C",
    description:
      "S09: T06 Disputed sends C1 to Legal, Reading A ruling recomputes, and the ruling verifies no clause",
    expected: [
      "check S09: Awaiting verification, names T06, T07, T08, T09",
      "after T06 Disputed and T07 to T09 Clear: Needs Legal, case With Legal",
      "T07 reopened: Needs review",
      "after Reading A: Awaiting verification, names T07",
      "T07 after ruling: Needs review",
      "after T07 Clear again: Potential discrepancy, ₹1,300 excess",
      "versions kept: 4",
    ],
    run: () => {
      let ws = vrWorkflow();
      const s = wf.saveCheck(ws, DEV, fx("S09"), "S09");
      ws = s.state;
      const out = [`check S09: ${checkpoint(latestResult(ws, s.assessmentId))}`];
      ws = wf.reviewClause(
        ws,
        PRIYA,
        "T06",
        "Disputed",
        "Does Note 2 fix rates for the Initial Term?",
      );
      for (const id of ["T07", "T08", "T09"]) ws = wf.reviewClause(ws, PRIYA, id, "Clear");
      out.push(
        `after T06 Disputed and T07 to T09 Clear: ${latestResult(ws, s.assessmentId).status}, case ${ws.conflictCases["C1"]!.status}`,
      );
      ws = wf.markNeedsReview(ws, PRIYA, "T07", "Second look");
      out.push(`T07 reopened: ${ws.terms["T07"]!.status}`);
      ws = wf.recordRuling(
        ws,
        ANIKA,
        "C1",
        "A",
        "Note 2 is the specific term for the Initial Term.",
      );
      out.push(`after Reading A: ${checkpoint(latestResult(ws, s.assessmentId))}`);
      out.push(`T07 after ruling: ${ws.terms["T07"]!.status}`);
      ws = wf.reviewClause(ws, PRIYA, "T07", "Clear");
      out.push(`after T07 Clear again: ${checkpoint(latestResult(ws, s.assessmentId))}`);
      out.push(`versions kept: ${versionCount(ws, s.assessmentId)}`);
      return out;
    },
  },
  {
    id: "JC-clear",
    journey: "C",
    description:
      "Every clause Clear: Needs Legal with nothing for Legal to rule on until one is Disputed",
    expected: [
      "all Clear: Needs Legal, case Open",
      "ruling now: refused",
      "after T06 reopened and Disputed: case With Legal",
      "ruling then: allowed",
    ],
    run: () => {
      let ws = vrWorkflow();
      const s = wf.saveCheck(ws, DEV, fx("S09"), "S09");
      ws = s.state;
      for (const id of ["T06", "T07", "T08", "T09"]) ws = wf.reviewClause(ws, PRIYA, id, "Clear");
      const out = [
        `all Clear: ${latestResult(ws, s.assessmentId).status}, case ${ws.conflictCases["C1"]!.status}`,
      ];
      out.push(`ruling now: ${thrown(() => wf.recordRuling(ws, ANIKA, "C1", "A", "x"))}`);
      ws = wf.markNeedsReview(ws, PRIYA, "T06", "Reopen to dispute");
      ws = wf.reviewClause(ws, PRIYA, "T06", "Disputed", "Are rates fixed?");
      out.push(`after T06 reopened and Disputed: case ${ws.conflictCases["C1"]!.status}`);
      out.push(`ruling then: ${thrown(() => wf.recordRuling(ws, ANIKA, "C1", "B", "x"))}`);
      return out;
    },
  },
  {
    id: "U02-U04",
    journey: "D",
    description: "Upload checks reject wrong type, empty or scanned text and over-limit files",
    expected: [
      "Word file: refused",
      "empty file: refused",
      "no text (scanned): refused",
      "26 pages: refused",
      "80,001 characters: refused",
      "Orbis sample: accepted",
    ],
    run: () => {
      const v = (m: string | null) => (m ? "refused" : "accepted");
      return [
        `Word file: ${v(up.checkFile({ name: "rates.docx", type: "application/msword", size: 100 }))}`,
        `empty file: ${v(up.checkFile({ name: "rates.pdf", type: "application/pdf", size: 0 }))}`,
        `no text (scanned): ${v(up.checkPages(["", "  "]))}`,
        `26 pages: ${v(up.checkPages(Array.from({ length: 26 }, () => "Rate text. ".repeat(10))))}`,
        `80,001 characters: ${v(up.checkPages(["x".repeat(80_001)]))}`,
        `Orbis sample: ${v(up.checkPages(samples.ORBIS_PAGES))}`,
      ];
    },
  },
  {
    id: "AI02-D5",
    journey: "D",
    description:
      "Live run on the Orbis sample: fabricated quote rejected and counted, nothing Verified",
    expected: [
      "run: Completed, Live, 3 proposed, 1 rejected",
      "statuses: Proposed, Proposed, Proposed",
      "sources: Live, Live, Live",
      "Facilities Supervisor: all locations, ₹640/h from 2026-12-01",
    ],
    run: () => {
      const u = uploadSample(wf.seedWorkflow(), "orbis");
      const fake = {
        ...samples.orbisTerms()[0]!,
        role: "Night Guard",
        amount: 999,
        quote: "Role: Night Guard. Rate: INR 999 per hour.",
      };
      const ws = up.applyExtraction(
        u.state,
        PRIYA,
        u.docId,
        samples.mockResponse([...samples.orbisTerms(), fake], samples.ORBIS_PAGES),
      ).state;
      const run = ws.uploads.runs.at(-1)!;
      const terms = ws.uploads.terms;
      const sup = terms.find((t) => t.grade === "Facilities Supervisor")!;
      return [
        `run: ${run.status}, ${run.source}, ${run.accepted} proposed, ${run.rejected} rejected`,
        `statuses: ${terms.map((t) => ws.terms[t.id]!.status).join(", ")}`,
        `sources: ${terms.map((t) => t.source).join(", ")}`,
        `Facilities Supervisor: ${sup.location === "all" ? "all locations" : sup.location}, ${formatINR(sup.ratePaise!)}/h from ${sup.effectiveFrom}`,
      ];
    },
  },
  {
    id: "U05-D8",
    journey: "D",
    description:
      "New supplier: verified uploaded term prices a line and cites the uploaded document",
    expected: [
      "before verification: Awaiting verification, names LT003",
      "after verification: Potential discrepancy, ₹2,000 excess",
      "cites: UP-001 page 2",
    ],
    run: () => {
      const u = uploadSample(wf.seedWorkflow(), "orbis");
      let ws = up.applyExtraction(
        u.state,
        PRIYA,
        u.docId,
        samples.mockResponse(samples.orbisTerms(), samples.ORBIS_PAGES),
      ).state;
      const line = orbisLine(u.supplierId);
      const out = [`before verification: ${checkpoint(evaluateLine(line, wf.contextOf(ws)))}`];
      const sup = ws.uploads.terms.find((t) => t.grade === "Facilities Supervisor")!;
      ws = wf.verifyTerm(ws, PRIYA, sup.id, "Checked against page 2");
      const r = evaluateLine(line, wf.contextOf(ws));
      out.push(`after verification: ${checkpoint(r)}`);
      const cited = wf.catalogFor(ws).terms.find((t) => t.id === r.governingTermId);
      out.push(`cites: ${cited ? `${cited.docId} page ${cited.clauseId.slice(1)}` : "nothing"}`);
      return out;
    },
  },
  {
    id: "AI03-D9",
    journey: "D",
    description: "Failed live run: reason recorded, Retry possible, stored demo untouched",
    expected: [
      "run: Failed, capacity",
      "terms created: 0",
      "seed terms and checks unchanged: yes",
      "retry after failure: allowed",
    ],
    run: () => {
      const u = uploadSample(wf.seedWorkflow(), "orbis");
      const before = u.state;
      const ws = up.applyExtraction(before, PRIYA, u.docId, {
        ok: false,
        code: "capacity",
        message: "Daily limit reached.",
      }).state;
      const run = ws.uploads.runs.at(-1)!;
      const same =
        JSON.stringify(ws.terms) === JSON.stringify(before.terms) &&
        JSON.stringify(ws.assessments) === JSON.stringify(before.assessments);
      return [
        `run: ${run.status}, ${run.code}`,
        `terms created: ${ws.uploads.terms.length}`,
        `seed terms and checks unchanged: ${same ? "yes" : "no"}`,
        `retry after failure: ${thrown(() => up.applyExtraction(ws, PRIYA, u.docId, samples.mockResponse(samples.orbisTerms(), samples.ORBIS_PAGES)))}`,
      ];
    },
  },
  {
    id: "S12-U06-D10",
    journey: "D",
    description:
      "Unverified later amendment (BrightHire Amendment 3) leaves an L2 Hyderabad line Awaiting verification",
    expected: [
      "Amendment 3 term: L2, Hyderabad, ₹500/h from 2026-11-01, Proposed",
      "L2 Hyderabad Nov 2026: Awaiting verification, names the amendment term",
      "amounts shown: none",
      "L4 Pune Nov 2026: Match, no difference",
    ],
    run: () => {
      const u = uploadSample(vrWorkflow(), "amendment3");
      const ws = up.applyExtraction(
        u.state,
        PRIYA,
        u.docId,
        samples.mockResponse(samples.amendment3Terms(), samples.AMENDMENT_3_PAGES),
      ).state;
      const t = ws.uploads.terms[0]!;
      const ctx = wf.contextOf(ws);
      const r = evaluateLine({ ...fx("S09"), location: "Hyderabad", billedRatePaise: 52000 }, ctx);
      const named = (r.blockers ?? []).some((b) => b.termIds.includes(t.id));
      const pune = evaluateLine(
        { ...fx("S03"), serviceStart: "2026-11-01", serviceEnd: "2026-11-30" },
        ctx,
      );
      return [
        `Amendment 3 term: ${t.grade}, ${t.location}, ${formatINR(t.ratePaise!)}/h from ${t.effectiveFrom}, ${ws.terms[t.id]!.status}`,
        `L2 Hyderabad Nov 2026: ${r.status}${named ? ", names the amendment term" : ""}`,
        `amounts shown: ${r.differencePaise === null && r.applicableRatePaise === null ? "none" : "yes"}`,
        `L4 Pune Nov 2026: ${checkpoint(pune)}`,
      ];
    },
  },
  {
    id: "M3.6-unsigned",
    journey: "D",
    description: "Unsigned upload: terms Ignored and cannot be verified",
    expected: ["statuses: Ignored, Ignored, Ignored", "verify: refused"],
    run: () => {
      const u = uploadSample(wf.seedWorkflow(), "orbis", "Unsigned draft");
      const ws = up.applyExtraction(
        u.state,
        PRIYA,
        u.docId,
        samples.mockResponse(samples.orbisTerms(), samples.ORBIS_PAGES),
      ).state;
      return [
        `statuses: ${ws.uploads.terms.map((t) => ws.terms[t.id]!.status).join(", ")}`,
        `verify: ${thrown(() => wf.verifyTerm(ws, PRIYA, ws.uploads.terms[0]!.id, "x"))}`,
      ];
    },
  },
];

export function runJourneyCase(tc: JourneyCase): JourneyRun {
  let actual: string[];
  try {
    actual = tc.run();
  } catch (e) {
    actual = [`error: ${(e as Error).message}`];
  }
  const mismatches: string[] = [];
  const n = Math.max(actual.length, tc.expected.length);
  for (let i = 0; i < n; i++)
    if (actual[i] !== tc.expected[i])
      mismatches.push(
        `step ${i + 1}: expected "${tc.expected[i] ?? "nothing"}", got "${actual[i] ?? "nothing"}"`,
      );
  return { testCase: tc, actual, pass: mismatches.length === 0, mismatches };
}

export const runAllJourneys = () => JOURNEY_CASES.map(runJourneyCase);
