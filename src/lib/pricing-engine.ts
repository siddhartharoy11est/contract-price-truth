/**
 * Pricing engine. Pure, deterministic, no UI code and no AI.
 * AI proposes terms; this module selects the governing rate and does all arithmetic.
 * The resolution follows PRD v0.4.2 section 6.3, stages 1 to 10.
 */
import {
  OTHER_LOCATION,
  type Conflict,
  type EngineTerm,
  type Grade,
  type InvoiceLine,
  type Reading,
  type RoleMapEntry,
} from "@/data/types";
import { amountFor, formatINR, type Paise } from "./money";
import { daysBetween, formatDate, formatPeriod, isIsoDate } from "./dates";

export type ResultStatus =
  | "Match"
  | "Potential discrepancy"
  | "Billed below contract"
  | "Awaiting verification"
  | "Needs information"
  | "Needs Legal"
  | "Invalid input";

export type Verdict = "Match" | "Potential discrepancy" | "Billed below contract";
export type BlockerStatus = "Needs information" | "Awaiting verification" | "Needs Legal";
export type Owner = "Finance" | "Procurement" | "Legal";
export type NeedKind = "location" | "split" | "grade" | "no-rate";

export interface Blocker {
  status: BlockerStatus;
  owner: Owner;
  reason: string;
  termIds: string[];
}

/**
 * A scenario or reading preview. Amounts and verdict are null when the branch depends on
 * an unverified term (provisional) or cannot be priced as one rate.
 */
export interface Outcome {
  label: string;
  ratePaise: Paise;
  expectedPaise: Paise | null;
  differencePaise: Paise | null;
  verdict: Verdict | null;
  termId: string;
  verified: boolean;
  provisional?: boolean;
  conditional?: boolean;
  note?: string;
}

export interface AdjustmentCheck {
  claimTermId: string;
  claimedRatePaise: Paise;
  effectiveFrom: string;
  noticeDate: string | null;
  noticeDays: number | null;
  requiredNoticeDays: number;
  timely: boolean;
  capPct: number;
  statedIndexPct: number | null;
  appliedPct: number | null;
  baseRatePaise: Paise | null;
  permittedRatePaise: Paise | null;
  /** Claimed rate above the permitted rate, per hour. Zero when within the permitted rate. */
  excessOverPermittedPaise: Paise;
}

export interface PriceResult {
  status: ResultStatus;
  grade: Grade | null;
  applicableRatePaise: Paise | null;
  expectedPaise: Paise | null;
  billedPaise: Paise | null;
  differencePaise: Paise | null;
  governingTermId: string | null;
  citedTermIds: string[];
  explanation: string[];
  /** The first Needs information question, kept for existing callers. */
  need?: { kind: NeedKind; question: string } | undefined;
  /** Every Needs information question, in stage order. */
  needs?: { kind: NeedKind; question: string }[] | undefined;
  /** All blockers in PRD order. The first one decides the status. */
  blockers?: Blocker[] | undefined;
  /** Terms that match the line but cannot govern it, with the reason. */
  notConsidered?: { termId: string; reason: string }[] | undefined;
  outcomes?: Outcome[] | undefined;
  poNote?: string | undefined;
  errors?: string[] | undefined;
  conflictId?: string | undefined;
  rulingApplied?: Reading | undefined;
  adjustment?: AdjustmentCheck | undefined;
}

export interface EngineContext {
  terms: EngineTerm[];
  conflicts: Conflict[];
  rulings: Partial<Record<string, Reading>>;
  /** Supplier id to role map. Missing entries fall back to the demo supplier's map. */
  roleMaps?: Record<string, RoleMapEntry[]>;
  /** Supplier id to known delivery centers. */
  deliveryCenters?: Record<string, string[]>;
}

export const DEFAULT_SUPPLIER_ID = "brighthire";

/** The demo supplier's role map (Schedule A). Other suppliers supply their own map. */
export const SCHEDULE_A_GRADES: RoleMapEntry[] = [
  { grade: "L4", role: "Senior Software Engineer" },
  { grade: "L3", role: "Software Engineer" },
  { grade: "L2", role: "QA Analyst" },
];

export const PO_AGREES_NOTE =
  "The invoice agrees with its purchase order, so a two-way match would pass. The contract says otherwise.";

export const NEEDS_LEGAL_SAME_CLASS_NOTE =
  "Both readings show the same kind of result, but the amount depends on the ruling, so the result stays with Legal.";

const OWNER: Record<BlockerStatus, Owner> = {
  "Needs information": "Finance",
  "Awaiting verification": "Procurement",
  "Needs Legal": "Legal",
};
const BLOCKER_ORDER: BlockerStatus[] = ["Needs information", "Awaiting verification", "Needs Legal"];

/** Maps role text to exactly one grade in the supplier's role map, or null. Never inferred from a rate. */
export function resolveGrade(text: string, roleMap: RoleMapEntry[] = SCHEDULE_A_GRADES): Grade | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  const hits = new Set<Grade>();
  for (const { grade, role, aliases = [] } of roleMap) {
    const g = grade.toLowerCase();
    const r = role.toLowerCase();
    const all = [g, `grade ${g}`, r, `${r} ${g}`, `${r} (${g})`, `${r} (grade ${g})`, `${r}, ${g}`];
    for (const a of aliases) all.push(a.toLowerCase().replace(/\s+/g, " "));
    if (all.includes(t)) hits.add(grade);
  }
  return hits.size === 1 ? [...hits][0]! : null;
}

/** Permitted adjusted rate: base times (1 plus the lesser of cap and index), nearest paisa, half up. */
export function permittedAdjustedRate(basePaise: Paise, capPct: number, indexPct: number): Paise {
  const bp = Math.round(Math.min(capPct, indexPct) * 100);
  return Math.floor((basePaise * (10000 + bp) + 5000) / 10000);
}

// ---------- dates ----------

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const effectiveOn = (t: EngineTerm, d: string) =>
  !!t.effectiveFrom && t.effectiveFrom <= d && (!t.effectiveTo || t.effectiveTo >= d);

const overlaps = (t: EngineTerm, start: string, end: string) =>
  !!t.effectiveFrom && t.effectiveFrom <= end && (!t.effectiveTo || t.effectiveTo >= start);

// ---------- stage 3: rate in force on a day ----------

type DayState =
  | { kind: "none" }
  | { kind: "settled"; ratePaise: Paise; termIds: string[] }
  | { kind: "pending"; ratePaise: Paise; termIds: string[]; reason: string }
  | { kind: "unresolved"; termIds: string[]; blockingIds: string[]; reason: string };

function cite(t: EngineTerm): string {
  return `${t.id} (${t.docId} ${t.clauseId})`;
}

function stateOn(terms: EngineTerm[], d: string): DayState {
  const cands = terms.filter((t) => effectiveOn(t, d));
  if (!cands.length) return { kind: "none" };
  const overridden = new Set(
    cands
      .filter((y) => y.status === "Verified" && y.replaces && y.overrideVerified)
      .map((y) => y.replaces!),
  );
  const remain = cands.filter((x) => !overridden.has(x.id));
  if (remain.length === 1) {
    const x = remain[0]!;
    if (x.status === "Verified") return { kind: "settled", ratePaise: x.ratePaise!, termIds: [x.id] };
    return {
      kind: "pending",
      ratePaise: x.ratePaise!,
      termIds: [x.id],
      reason: `${cite(x)} is ${x.status} and not yet verified.`,
    };
  }
  const allVerified = remain.every((t) => t.status === "Verified");
  if (allVerified && remain.every((t) => t.ratePaise === remain[0]!.ratePaise)) {
    return { kind: "settled", ratePaise: remain[0]!.ratePaise!, termIds: remain.map((t) => t.id) };
  }
  const ids = remain.map((t) => t.id);
  if (!allVerified) {
    const unverified = remain.filter((t) => t.status !== "Verified");
    return {
      kind: "unresolved",
      termIds: ids,
      blockingIds: unverified.map((t) => t.id),
      reason: `${unverified.map(cite).join(", ")} ${unverified.length > 1 ? "are" : "is"} not yet verified, so the rate in force is not established.`,
    };
  }
  return {
    kind: "unresolved",
    termIds: ids,
    blockingIds: ids,
    reason: `Relationship between ${ids.join(" and ")} not confirmed: both are Verified with different rates and no verified override link.`,
  };
}

const sameState = (a: DayState, b: DayState) =>
  a.kind === b.kind &&
  ("ratePaise" in a ? a.ratePaise : null) === ("ratePaise" in b ? b.ratePaise : null) &&
  ("termIds" in a ? a.termIds.join() : "") === ("termIds" in b ? b.termIds.join() : "");

// ---------- stage 7 support: claims ----------

interface ClaimContext {
  claim: EngineTerm;
  conflict: Conflict | undefined;
  mode: "unreviewed" | "needs-legal" | "A" | "B" | "no-case";
  unreviewedIds: string[];
  capPct: number;
  requiredNoticeDays: number;
}

interface Adjust {
  claim: EngineTerm;
  check: AdjustmentCheck;
}

// ---------- scenario evaluation ----------

interface ScenarioEval {
  label: string;
  location: string | null;
  points: { date: string; state: DayState }[];
  noRate: boolean;
  splitAt: string | null;
  pendingSplitAt: string | null;
  /** Uniform Settled rate across the whole period, when there is one. */
  uniform: { ratePaise: Paise; termIds: string[] } | null;
  unsettled: { blockingIds: string[]; reason: string }[];
}

function evalScenario(
  label: string,
  location: string | null,
  roleTerms: EngineTerm[],
  start: string,
  end: string,
  adjust: Adjust | null,
): ScenarioEval {
  const terms = roleTerms.filter((t) => t.location === "all" || (location !== null && t.location === location));
  const relevant = terms.filter((t) => overlaps(t, start, end));
  const change = new Set<string>();
  for (const t of relevant) {
    if (t.effectiveFrom! > start && t.effectiveFrom! <= end) change.add(t.effectiveFrom!);
    if (t.effectiveTo) {
      const next = addDays(t.effectiveTo, 1);
      if (next > start && next <= end) change.add(next);
    }
  }

  let baseState: DayState | null = null;
  if (adjust) {
    const eff = adjust.claim.effectiveFrom!;
    if (eff > start && eff <= end) change.add(eff);
    baseState = stateOn(terms, addDays(eff, -1));
  }

  const rateOn = (d: string): DayState => {
    const s = stateOn(relevant, d);
    if (!adjust || d < adjust.claim.effectiveFrom!) return s;
    const base = baseState!;
    if (base.kind !== "settled") {
      return {
        kind: "unresolved",
        termIds: "termIds" in base ? base.termIds : [],
        blockingIds: "termIds" in base ? ("blockingIds" in base ? base.blockingIds : base.termIds) : [],
        reason: "The base rate for the adjustment is not settled.",
      };
    }
    if (s.kind === "settled" && s.termIds.join() === base.termIds.join()) {
      const governing = Math.min(adjust.check.permittedRatePaise!, adjust.claim.ratePaise!);
      return { kind: "settled", ratePaise: governing, termIds: [...s.termIds, adjust.claim.id] };
    }
    return s;
  };

  const dates = [start, ...[...change].sort()];
  const points = dates.map((date) => ({ date, state: rateOn(date) }));
  let splitAt: string | null = null;
  let pendingSplitAt: string | null = null;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!.state;
    const cur = points[i]!.state;
    if (sameState(prev, cur)) continue;
    if (prev.kind === "settled" && cur.kind === "settled") {
      if (prev.ratePaise !== cur.ratePaise && !splitAt) splitAt = points[i]!.date;
    } else if (prev.kind !== "none" && cur.kind !== "none" && !pendingSplitAt) {
      pendingSplitAt = points[i]!.date;
    }
  }
  const noRate = points.some((p) => p.state.kind === "none");
  const unsettled = points
    .map((p) => p.state)
    .filter((s): s is Extract<DayState, { kind: "pending" | "unresolved" }> => s.kind === "pending" || s.kind === "unresolved")
    .map((s) => ({ blockingIds: s.kind === "pending" ? s.termIds : s.blockingIds, reason: s.reason }));
  const first = points[0]!.state;
  const uniform =
    !noRate && !unsettled.length && !splitAt && first.kind === "settled"
      ? { ratePaise: first.ratePaise, termIds: first.termIds }
      : null;
  return { label, location, points, noRate, splitAt, pendingSplitAt, uniform, unsettled };
}

const blockingIdsOf = (s: ScenarioEval) => [...new Set(s.unsettled.flatMap((u) => u.blockingIds))].sort();

// ---------- helpers ----------

function verdictFor(differencePaise: Paise): Verdict {
  if (differencePaise > 0) return "Potential discrepancy";
  if (differencePaise < 0) return "Billed below contract";
  return "Match";
}

function priced(label: string, ratePaise: Paise, termId: string, line: InvoiceLine, extra: Partial<Outcome> = {}): Outcome {
  const expectedPaise = amountFor(line.hours, ratePaise);
  const differencePaise = amountFor(line.hours, line.billedRatePaise) - expectedPaise;
  return {
    label,
    ratePaise,
    expectedPaise,
    differencePaise,
    verdict: verdictFor(differencePaise),
    termId,
    verified: true,
    ...extra,
  };
}

export function describeOutcome(o: Outcome): string {
  if (o.verdict === null || o.differencePaise === null) return o.note ?? "Provisional, no verdict";
  if (o.verdict === "Potential discrepancy") return `potential excess ${formatINR(o.differencePaise)}`;
  if (o.verdict === "Billed below contract") return `billed below contract by ${formatINR(-o.differencePaise)}`;
  return "Match";
}

function validate(line: InvoiceLine): string[] {
  const errors: string[] = [];
  if (!isIsoDate(line.serviceStart)) errors.push("Enter a valid service start date.");
  if (!isIsoDate(line.serviceEnd)) errors.push("Enter a valid service end date.");
  if (errors.length === 0 && line.serviceEnd < line.serviceStart)
    errors.push("The service end date is before the start date.");
  if (!Number.isFinite(line.hours) || line.hours <= 0) errors.push("Hours must be more than zero.");
  if (!Number.isInteger(line.billedRatePaise) || line.billedRatePaise <= 0)
    errors.push("Billed rate must be more than zero.");
  if (line.poRatePaise !== null && (!Number.isInteger(line.poRatePaise) || line.poRatePaise <= 0))
    errors.push("PO rate must be more than zero, or left empty.");
  if (!line.grade.trim()) errors.push("Enter a grade.");
  return errors;
}

const emptyResult = (grade: Grade | null): Omit<PriceResult, "status" | "explanation"> => ({
  grade,
  applicableRatePaise: null,
  expectedPaise: null,
  billedPaise: null,
  differencePaise: null,
  governingTermId: null,
  citedTermIds: [],
});

const supplierOf = (t: EngineTerm) => t.supplierId ?? DEFAULT_SUPPLIER_ID;

// ---------- main ----------

export function evaluateLine(line: InvoiceLine, ctx: EngineContext): PriceResult {
  const errors = validate(line);
  if (errors.length) return { ...emptyResult(null), status: "Invalid input", errors, explanation: errors };

  const supplierId = line.supplierId ?? DEFAULT_SUPPLIER_ID;
  const start = line.serviceStart;
  const end = line.serviceEnd;
  const explanation: string[] = [];
  const notConsidered: { termId: string; reason: string }[] = [];
  const needs: { kind: NeedKind; question: string }[] = [];
  const blockers: Blocker[] = [];
  const addBlocker = (status: BlockerStatus, reason: string, termIds: string[]) =>
    blockers.push({ status, owner: OWNER[status], reason, termIds });

  // Stage 1. Validate input and map the role.
  const supplierTerms = ctx.terms.filter((t) => supplierOf(t) === supplierId);
  const signedRateTerms = supplierTerms.filter(
    (t) => t.kind === "rate" && t.signed && t.status !== "Ignored" && t.ratePaise !== null && t.effectiveFrom,
  );
  const roleMap =
    ctx.roleMaps?.[supplierId] ?? (supplierId === DEFAULT_SUPPLIER_ID ? SCHEDULE_A_GRADES : []);
  if (!roleMap.length || !signedRateTerms.length) {
    const question = "No signed rate on file for these dates. Check the supplier and the service dates.";
    return {
      ...emptyResult(null),
      status: "Needs information",
      need: { kind: "no-rate", question },
      needs: [{ kind: "no-rate", question }],
      blockers: [{ status: "Needs information", owner: "Finance", reason: question, termIds: [] }],
      explanation: ["This supplier has no signed rate on file, so no price can be established."],
    };
  }
  const grade = resolveGrade(line.grade, roleMap);
  if (!grade) {
    const question = `Which role is "${line.grade.trim()}"? It does not map to exactly one of ${roleMap
      .map((r) => r.grade)
      .join(", ")}.`;
    return {
      ...emptyResult(null),
      status: "Needs information",
      need: { kind: "grade", question },
      needs: [{ kind: "grade", question }],
      blockers: [{ status: "Needs information", owner: "Finance", reason: question, termIds: [] }],
      explanation: [
        `The role "${line.grade.trim()}" does not match exactly one role in the price book (${roleMap
          .map((r) => `${r.role} ${r.grade}`)
          .join(", ")}).`,
        "The role is never inferred from the billed rate. Confirm the role to get a price.",
      ],
    };
  }
  const roleTerms = signedRateTerms.filter((t) => t.grade === grade);

  // Not considered: unsigned drafts and Ignored terms that match the line.
  const locMatches = (t: EngineTerm) =>
    !line.location || t.location === "all" || t.location === line.location;
  for (const t of supplierTerms) {
    const isDraft = t.kind === "draft" || !t.signed || t.status === "Ignored";
    if (isDraft && t.grade === grade && locMatches(t) && t.effectiveFrom && overlaps(t, start, end))
      notConsidered.push({ termId: t.id, reason: "Unsigned draft. Never governs a price." });
  }

  // Stage 2. Location scenarios, built across all locations before filtering.
  const known = ctx.deliveryCenters?.[supplierId];
  let scenarios: { label: string; location: string | null }[];
  const locationMissing = !line.location;
  if (line.location === OTHER_LOCATION) {
    scenarios = [{ label: "Other or not listed", location: null }];
    explanation.push("Location is other or not listed, so only all-location terms were used.");
  } else if (line.location) {
    if (known && !known.includes(line.location)) {
      const question = `"${line.location}" is not a known delivery center for this supplier. Choose a listed center or "Other or not listed".`;
      return {
        ...emptyResult(grade),
        status: "Needs information",
        need: { kind: "location", question },
        needs: [{ kind: "location", question }],
        blockers: [{ status: "Needs information", owner: "Finance", reason: question, termIds: [] }],
        explanation: [question],
      };
    }
    scenarios = [{ label: line.location, location: line.location }];
  } else {
    const locs = [
      ...new Set(
        supplierTerms
          .filter((t) => t.kind === "rate" && t.signed && t.status !== "Ignored" && t.grade === grade && t.location && t.location !== "all")
          .map((t) => t.location as string),
      ),
    ].sort();
    scenarios = [
      ...locs.map((l) => ({ label: `If ${l}`, location: l })),
      { label: "If another center", location: null },
    ];
  }
  // Location-specific terms that the stated location rules out.
  if (line.location) {
    for (const t of roleTerms) {
      if (t.location !== "all" && t.location !== line.location && overlaps(t, start, end))
        notConsidered.push({ termId: t.id, reason: `${t.location} only` });
    }
  }

  // Stage 7 setup. Claims in scope for this role, whatever the billed rate.
  const claims = supplierTerms.filter((t) => t.kind === "notice" && t.grade === grade && t.effectiveFrom && t.ratePaise !== null);
  let claimCtx: ClaimContext | null = null;
  for (const c of claims) {
    if (!c.signed) {
      notConsidered.push({ termId: c.id, reason: "Unsigned draft. Never governs a price." });
      continue;
    }
    if (c.effectiveFrom! > end) {
      notConsidered.push({
        termId: c.id,
        reason: `Supplier claim effective ${formatDate(c.effectiveFrom!)}, after the service period.`,
      });
      continue;
    }
    if (claimCtx) continue;
    const conflict = ctx.conflicts.find((k) => k.id === c.conflictId);
    const caseTerms = (conflict?.termIds ?? []).map((id) => ctx.terms.find((t) => t.id === id)).filter(Boolean) as EngineTerm[];
    const unreviewedIds = caseTerms.filter((t) => t.status !== "Verified").map((t) => t.id);
    const ruling = conflict ? ctx.rulings[conflict.id] : undefined;
    const adjClause = caseTerms.find((t) => t.capPct !== undefined);
    claimCtx = {
      claim: c,
      conflict,
      mode: !conflict ? "no-case" : unreviewedIds.length ? "unreviewed" : !ruling ? "needs-legal" : ruling,
      unreviewedIds,
      capPct: adjClause?.capPct ?? 0,
      requiredNoticeDays: adjClause?.noticeDaysRequired ?? 0,
    };
  }

  const buildAdjust = (cc: ClaimContext, scenarioLoc: string | null): Adjust => {
    const c = cc.claim;
    const eff = c.effectiveFrom!;
    const terms = roleTerms.filter((t) => t.location === "all" || (scenarioLoc !== null && t.location === scenarioLoc));
    const base = stateOn(terms, addDays(eff, -1));
    const noticeDays = c.noticeDate ? daysBetween(c.noticeDate, eff) : null;
    const timely = noticeDays !== null && noticeDays >= cc.requiredNoticeDays;
    const index = c.statedCpiPct ?? null;
    const baseRate = base.kind === "settled" ? base.ratePaise : null;
    const permitted = baseRate !== null && index !== null ? permittedAdjustedRate(baseRate, cc.capPct, index) : null;
    return {
      claim: c,
      check: {
        claimTermId: c.id,
        claimedRatePaise: c.ratePaise!,
        effectiveFrom: eff,
        noticeDate: c.noticeDate ?? null,
        noticeDays,
        requiredNoticeDays: cc.requiredNoticeDays,
        timely,
        capPct: cc.capPct,
        statedIndexPct: index,
        appliedPct: index === null ? null : Math.min(cc.capPct, index),
        baseRatePaise: baseRate,
        permittedRatePaise: permitted,
        excessOverPermittedPaise: permitted !== null ? Math.max(0, c.ratePaise! - permitted) : 0,
      },
    };
  };

  /** The adjustment applies only under Reading B with timely notice. */
  const adjustFor = (reading: "A" | "B" | null, loc: string | null): Adjust | null => {
    if (!claimCtx || reading !== "B") return null;
    const a = buildAdjust(claimCtx, loc);
    return a.check.timely && claimCtx.capPct > 0 ? a : null;
  };

  const mainReading: "A" | "B" | null =
    claimCtx?.mode === "A" ? "A" : claimCtx?.mode === "B" ? "B" : null;
  const evals = scenarios.map((s) => evalScenario(s.label, s.location, roleTerms, start, end, adjustFor(mainReading, s.location)));

  // Stages 4 to 6. Needs information reasons.
  let chosen: ScenarioEval | null = null;
  const outcomes: Outcome[] = [];
  if (evals.length === 1) {
    chosen = evals[0]!;
  } else {
    const settledRates = new Set(evals.map((e) => (e.uniform ? e.uniform.ratePaise : null)));
    const allUniformSame = evals.every((e) => e.uniform) && settledRates.size === 1;
    const firstBlock = blockingIdsOf(evals[0]!).join();
    const allPendingSame =
      evals.every((e) => !e.uniform && !e.splitAt && !e.noRate && e.unsettled.length) &&
      evals.every((e) => blockingIdsOf(e).join() === firstBlock);
    if (allUniformSame) {
      chosen = evals[0]!;
      explanation.push("The invoice does not state a delivery center, but the rate is the same at every center, so location did not matter.");
    } else if (allPendingSame) {
      chosen = evals[0]!;
    } else {
      needs.push({ kind: "location", question: "Which delivery center delivered this work?" });
      explanation.push("The invoice line does not state a delivery center, and the contract rate depends on it. No single all-location answer is given.");
      for (const e of evals) {
        if (e.uniform) {
          outcomes.push(priced(e.label, e.uniform.ratePaise, e.uniform.termIds[0]!, line));
        } else if (e.splitAt) {
          needs.push({
            kind: "split",
            question: `If ${e.location ?? "another center"}, split the hours by date: before ${formatDate(e.splitAt)} and from ${formatDate(e.splitAt)}.`,
          });
        } else if (e.unsettled.length) {
          const ids = blockingIdsOf(e);
          const pendingTerm = ctx.terms.find((t) => t.id === ids[0]);
          outcomes.push({
            label: e.label,
            ratePaise: pendingTerm?.ratePaise ?? 0,
            expectedPaise: null,
            differencePaise: null,
            verdict: null,
            termId: ids[0] ?? "",
            verified: false,
            provisional: true,
            note: `Provisional, depends on ${ids.join(", ")} (not yet verified)`,
          });
        }
      }
    }
  }

  if (chosen) {
    if (chosen.noRate) {
      needs.push({ kind: "no-rate", question: "No signed rate on file for these dates. Check the service dates." });
    }
    if (chosen.splitAt) {
      needs.push({
        kind: "split",
        question: `Split this line by date: hours before ${formatDate(chosen.splitAt)} and hours from ${formatDate(chosen.splitAt)}.`,
      });
      explanation.push(
        `The service period ${formatPeriod(start, end)} spans ${formatDate(chosen.splitAt)}, when the verified rate changes. One rate cannot be applied to the whole line, and the product never splits hours itself.`,
      );
    }
  }
  for (const n of needs) addBlocker("Needs information", n.question, []);

  // Stage 7. Clause check, independent of the billed rate.
  let adjust: Adjust | null = null;
  if (claimCtx) {
    const c = claimCtx.claim;
    const facts = `Supplier claim (not an agreed price): ${cite(c)} states ${formatINR(c.ratePaise!)} per hour from ${formatDate(c.effectiveFrom!)}${c.statedCpiPct !== undefined ? `, citing a supplier-stated CPI change of ${c.statedCpiPct}%` : ""}.`;
    explanation.push(facts);
    if (claimCtx.mode === "unreviewed") {
      addBlocker(
        "Awaiting verification",
        `Clauses and notice ${claimCtx.unreviewedIds.join(", ")} in conflict ${claimCtx.conflict!.id} are not yet reviewed.`,
        claimCtx.unreviewedIds,
      );
    } else if (claimCtx.mode === "needs-legal") {
      addBlocker("Needs Legal", claimCtx.conflict!.question, claimCtx.conflict!.termIds);
    } else if (claimCtx.mode === "A") {
      explanation.push("Legal ruled Reading A: rates are fixed for the Initial Term, so the claim has no effect.");
    } else if (claimCtx.mode === "B") {
      adjust = buildAdjust(claimCtx, chosen?.location ?? null);
      const k = adjust.check;
      if (!k.timely) {
        explanation.push(
          `Legal ruled Reading B, but notice was given ${k.noticeDays ?? "an unknown number of"} days before the effective date (${k.requiredNoticeDays} required), so the claim has no effect.`,
        );
        adjust = null;
      } else if (k.baseRatePaise === null) {
        addBlocker("Awaiting verification", "The base rate for the adjustment is not settled.", []);
      } else {
        explanation.push(
          `Legal ruled Reading B. Permitted rate: ${formatINR(k.baseRatePaise)} x (1 + ${k.appliedPct}%) = ${formatINR(k.permittedRatePaise!)}, the lesser of the ${k.capPct}% cap and the supplier-stated index of ${k.statedIndexPct}%. Notice was given ${k.noticeDays} days ahead (${k.requiredNoticeDays} required).`,
        );
        if (k.excessOverPermittedPaise > 0)
          explanation.push(
            `The claimed ${formatINR(k.claimedRatePaise)} is ${formatINR(k.excessOverPermittedPaise)} per hour above the permitted rate, so the permitted rate governs.`,
          );
      }
    }
  }

  // Stage 8. Verification gate.
  if (chosen && !chosen.splitAt) {
    const ids = blockingIdsOf(chosen);
    if (chosen.unsettled.length) {
      const reasons = [...new Set(chosen.unsettled.map((u) => u.reason))];
      const splitNote = chosen.pendingSplitAt
        ? ` A split by date at ${formatDate(chosen.pendingSplitAt)} may be needed once verified.`
        : "";
      addBlocker("Awaiting verification", reasons.join(" ") + splitNote, ids);
    }
  }

  blockers.sort((a, b) => BLOCKER_ORDER.indexOf(a.status) - BLOCKER_ORDER.indexOf(b.status));
  for (const n of notConsidered) explanation.push(`${n.termId} not considered: ${n.reason}`);

  const conflictId = claimCtx?.conflict?.id;
  const rulingApplied = claimCtx?.mode === "A" || claimCtx?.mode === "B" ? claimCtx.mode : undefined;
  const common = {
    notConsidered,
    blockers,
    conflictId,
    rulingApplied,
    adjustment: adjust?.check,
  };

  if (blockers.length) {
    const top = blockers[0]!.status;
    const cited = [...new Set(blockers.flatMap((b) => b.termIds))];
    explanation.unshift(...blockers.map((b) => `${b.status} (owner ${b.owner}): ${b.reason}`));
    if (top === "Awaiting verification") explanation.push("No amounts or verdict are shown until a person verifies the terms.");

    let shownOutcomes: Outcome[] | undefined = top === "Needs information" && outcomes.length ? outcomes : undefined;
    if (top === "Needs Legal" && claimCtx && chosen) {
      // Conditional readings, only when the base rate is Settled.
      const cond: Outcome[] = [];
      const notes: string[] = [];
      for (const r of ["A", "B"] as const) {
        const label = r === "A" ? "If Reading A (rates fixed)" : "If Reading B (adjustment applies)";
        const e = evalScenario(chosen.label, chosen.location, roleTerms, start, end, adjustFor(r, chosen.location));
        if (e.uniform) {
          cond.push(
            priced(label, e.uniform.ratePaise, e.uniform.termIds[e.uniform.termIds.length - 1]!, line, {
              conditional: true,
              note: "Conditional on Legal ruling. Not a finding",
            }),
          );
        } else if (e.splitAt) {
          notes.push(`${label}: the line would need to be split by date at ${formatDate(e.splitAt)}.`);
        }
      }
      if (cond.length) {
        shownOutcomes = cond;
        explanation.push("Conditional on Legal ruling. Not a finding.");
        explanation.push(cond.map((o) => `${o.label}: governs ${formatINR(o.ratePaise)}, ${describeOutcome(o)}.`).join(" "));
        if (cond.length === 2 && cond[0]!.verdict === cond[1]!.verdict) explanation.push(NEEDS_LEGAL_SAME_CLASS_NOTE);
      }
      explanation.push(...notes);
    }
    return {
      ...emptyResult(grade),
      ...common,
      status: top,
      citedTermIds: shownOutcomes ? [...new Set([...cited, ...shownOutcomes.map((o) => o.termId)])] : cited,
      need: needs[0],
      needs: needs.length ? needs : undefined,
      outcomes: shownOutcomes,
      explanation,
    };
  }

  // Stage 9. Calculate.
  const settled = chosen!.uniform!;
  const ratePaise = settled.ratePaise;
  const baseIds = settled.termIds.filter((id) => id !== claimCtx?.claim.id);
  const govTerm = ctx.terms.find((t) => t.id === baseIds[0])!;
  const cited = [...baseIds];
  explanation.unshift(
    `${cite(govTerm)} sets ${formatINR(govTerm.ratePaise!)} per hour for ${grade}${
      govTerm.location === "all" ? " at all delivery centers" : ` at ${govTerm.location}`
    } from ${formatDate(govTerm.effectiveFrom!)}.`,
    ...(govTerm.replaces && govTerm.overrideVerified
      ? [`It overrides ${govTerm.replaces} for these conditions (override link verified).`]
      : []),
  );
  if (claimCtx && (claimCtx.mode === "A" || claimCtx.mode === "B")) {
    const reading = claimCtx.conflict!.readings.find((r) => r.reading === claimCtx!.mode);
    cited.push(...(reading?.termIds ?? []), claimCtx.claim.id);
  }
  const expectedPaise = amountFor(line.hours, ratePaise);
  const billedPaise = amountFor(line.hours, line.billedRatePaise);
  const differencePaise = billedPaise - expectedPaise;
  const status = verdictFor(differencePaise);
  explanation.push(
    `Expected ${line.hours} h x ${formatINR(ratePaise)} = ${formatINR(expectedPaise)}. Billed ${line.hours} h x ${formatINR(line.billedRatePaise)} = ${formatINR(billedPaise)}.`,
  );
  if (status === "Potential discrepancy")
    explanation.push(`The invoice is ${formatINR(differencePaise)} above the contract price. This is a potential excess, not a confirmed one.`);
  if (status === "Billed below contract")
    explanation.push(`The invoice is ${formatINR(-differencePaise)} below the contract price. Shown for information only.`);
  if (status === "Match") explanation.push("The billed rate matches the verified contract rate.");

  // Stage 10. PO note.
  const poNote =
    status === "Potential discrepancy" && line.poRatePaise !== null && line.poRatePaise === line.billedRatePaise
      ? PO_AGREES_NOTE
      : undefined;

  return {
    ...common,
    status,
    grade,
    applicableRatePaise: ratePaise,
    expectedPaise,
    billedPaise,
    differencePaise,
    governingTermId: govTerm.id,
    citedTermIds: [...new Set(cited)],
    explanation,
    poNote,
  };
}
