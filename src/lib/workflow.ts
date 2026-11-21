/**
 * Workflow state and its transitions. Pure functions over plain data, no React.
 * PRD v0.4.2: M5 (verification), M7.3 (versioned assessments), M9 and 6.10 (investigations).
 * The pricing engine still does every price selection and all arithmetic.
 */
import { CONFLICTS, DOCUMENTS, TERMS } from "@/data/seed";
import type { InvoiceLine, Reading, RoleId, TermStatus } from "@/data/types";
import {
  evaluateLine,
  type EngineContext,
  type PriceResult,
  type ResultStatus,
} from "./pricing-engine";
import {
  aiOriginal,
  buildContext,
  currentValue,
  initialTermStates,
  type Correction,
  type EditableField,
  type FieldValue,
  type TermState,
} from "./term-state";
import { quoteInDocument, valueSupported } from "./evidence";
import { formatINR } from "./money";

export interface Actor {
  by: string;
  role: RoleId | "system";
  at: string;
}

export interface ActivityEvent extends Actor {
  text: string;
  ref?: { kind: "term" | "assessment" | "investigation" | "conflict"; id: string };
}

/** Everything a version was computed from. Stored so a version can be read later as it was. */
export interface VersionInputs {
  line: InvoiceLine;
  terms: Record<
    string,
    {
      status: TermStatus;
      ratePaise: number | null;
      override: string | null;
      overrideConfirmed: boolean;
    }
  >;
  rulings: Partial<Record<string, Reading>>;
}

export interface AssessmentVersion {
  n: number;
  at: string;
  by: string;
  trigger: string;
  inputs: VersionInputs;
  result: PriceResult;
}

export interface Fact {
  kind: "location" | "grade";
  value: string;
  note?: string;
  by: string;
  at: string;
  /** The version this fact produced. */
  version: number;
}

/** A saved invoice line check. Versions are append-only (PRD 6.10). */
export interface Assessment {
  id: string;
  createdAt: string;
  createdBy: string;
  fixtureId: string | null;
  facts: Fact[];
  versions: AssessmentVersion[];
}

export type DecisionKind = "Confirmed" | "Dismissed";

export interface Decision {
  kind: DecisionKind;
  reason: string;
  by: string;
  at: string;
  /** The assessment version the decision was made against. */
  version: number;
  /** Confirmed amount, from that version. Null for Dismissed. */
  amountPaise: number | null;
}

export interface TimelineEntry extends Actor {
  text: string;
  /** Index into the investigation's decisions when this entry is a decision. */
  decision?: number;
}

export type InvestigationOrigin = "Request review" | "Raise investigation";

export interface Investigation {
  id: string;
  assessmentId: string;
  createdAt: string;
  createdBy: string;
  origin: InvestigationOrigin;
  decisions: Decision[];
  timeline: TimelineEntry[];
}

export type ConflictCaseStatus = "Open" | "With Legal" | "Ruled";

export interface ConflictCase {
  status: ConflictCaseStatus;
  questions: { text: string; by: string; at: string; termId: string }[];
}

export interface Ruling {
  reading: Reading;
  reasoning: string;
  by: string;
  at: string;
}

export interface WorkflowState {
  terms: Record<string, TermState>;
  assessments: Assessment[];
  investigations: Investigation[];
  conflictCases: Record<string, ConflictCase>;
  rulings: Partial<Record<string, Ruling>>;
  activity: ActivityEvent[];
  nextAssessmentNo: number;
  nextInvestigationNo: number;
}

export class WorkflowError extends Error {}

const fail = (msg: string): never => {
  throw new WorkflowError(msg);
};

export function seedWorkflow(): WorkflowState {
  return {
    terms: initialTermStates(),
    assessments: [],
    investigations: [],
    conflictCases: Object.fromEntries(
      CONFLICTS.map((c) => [c.id, { status: "Open", questions: [] }]),
    ),
    rulings: {},
    activity: [],
    nextAssessmentNo: 1,
    nextInvestigationNo: 1,
  };
}

export function rulingReadings(
  rulings: WorkflowState["rulings"],
): Partial<Record<string, Reading>> {
  return Object.fromEntries(Object.entries(rulings).map(([k, v]) => [k, v!.reading]));
}

export const contextOf = (ws: Pick<WorkflowState, "terms" | "rulings">): EngineContext =>
  buildContext(ws.terms, rulingReadings(ws.rulings));

export function describeResult(r: PriceResult): string {
  if (r.status === "Potential discrepancy")
    return `Potential discrepancy, ${formatINR(r.differencePaise!)} potential excess`;
  if (r.status === "Match") return `Match at ${formatINR(r.applicableRatePaise!)} per hour`;
  if (r.status === "Billed below contract")
    return `Billed below contract by ${formatINR(-r.differencePaise!)}`;
  return r.status;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

function snapshot(ws: WorkflowState, line: InvoiceLine): VersionInputs {
  const ctx = contextOf(ws);
  return {
    line: { ...line },
    terms: Object.fromEntries(
      ctx.terms.map((t) => [
        t.id,
        {
          status: t.status,
          ratePaise: t.ratePaise,
          override: t.replaces ?? null,
          overrideConfirmed: t.overrideVerified === true,
        },
      ]),
    ),
    rulings: rulingReadings(ws.rulings),
  };
}

/**
 * Fields that decide whether a recompute produced a different result: status, amounts,
 * outcomes, questions, ruling and the owners of blockers. Which term ids a blocker lists can
 * change without a new version, so Journey A gives v1 Awaiting, then v2 with the verdict.
 */
export function resultSignature(r: PriceResult): string {
  return JSON.stringify([
    r.status,
    r.applicableRatePaise,
    r.expectedPaise,
    r.differencePaise,
    r.governingTermId,
    r.rulingApplied ?? null,
    (r.blockers ?? []).map((b) => b.status),
    (r.outcomes ?? []).map((o) => [o.label, o.ratePaise, o.differencePaise, o.verdict]),
    (r.needs ?? []).map((n) => n.kind),
  ]);
}

const sameLine = (a: InvoiceLine, b: InvoiceLine) => JSON.stringify(a) === JSON.stringify(b);

const latestOf = (a: Assessment) => a.versions[a.versions.length - 1]!;

function log(
  ws: WorkflowState,
  actor: Actor,
  text: string,
  ref?: ActivityEvent["ref"],
): WorkflowState {
  return { ...ws, activity: [...ws.activity, { ...actor, text, ...(ref ? { ref } : {}) }] };
}

/**
 * Re-evaluates every saved assessment against the current data and appends a version where
 * the result changed. Lines in `lines` replace the assessment's line (a supplied fact) and
 * always append a version. Older versions are never touched.
 */
export function recompute(
  ws: WorkflowState,
  actor: Actor,
  trigger: string,
  lines: Record<string, InvoiceLine> = {},
): WorkflowState {
  const ctx = contextOf(ws);
  const appended: { id: string; version: AssessmentVersion }[] = [];
  const assessments = ws.assessments.map((a) => {
    const latest = latestOf(a);
    const line = lines[a.id] ?? latest.inputs.line;
    const result = evaluateLine(line, ctx);
    const changed =
      !sameLine(line, latest.inputs.line) ||
      resultSignature(result) !== resultSignature(latest.result);
    if (!changed) return a;
    const version = deepFreeze({
      n: latest.n + 1,
      at: actor.at,
      by: actor.by,
      trigger,
      inputs: snapshot(ws, line),
      result,
    });
    appended.push({ id: a.id, version });
    return { ...a, versions: [...a.versions, version] };
  });
  if (!appended.length) return ws;
  const investigations = ws.investigations.map((inv) => {
    const hit = appended.find((x) => x.id === inv.assessmentId);
    if (!hit) return inv;
    return {
      ...inv,
      timeline: [
        ...inv.timeline,
        {
          ...actor,
          text: `Reassessed as version ${hit.version.n} after ${trigger}: ${describeResult(hit.version.result)}.`,
        },
      ],
    };
  });
  let next: WorkflowState = { ...ws, assessments, investigations };
  for (const x of appended)
    next = log(
      next,
      actor,
      `${x.id} reassessed as version ${x.version.n}: ${describeResult(x.version.result)}`,
      { kind: "assessment", id: x.id },
    );
  return next;
}

// ---------- assessments ----------

/**
 * Saves a check. The same line opens its existing assessment rather than creating another,
 * so there is one assessment, and at most one investigation, per invoice line.
 */
export function saveCheck(
  ws: WorkflowState,
  actor: Actor,
  line: InvoiceLine,
  fixtureId: string | null,
): { state: WorkflowState; assessmentId: string } {
  const existing = ws.assessments.find(
    (a) => sameLine(a.versions[0]!.inputs.line, line) || sameLine(latestOf(a).inputs.line, line),
  );
  if (existing) return { state: ws, assessmentId: existing.id };
  const result = evaluateLine(line, contextOf(ws));
  if (result.status === "Invalid input") fail(result.errors?.join(" ") ?? "Invalid line.");
  const id = `A-${String(ws.nextAssessmentNo).padStart(3, "0")}`;
  const version = deepFreeze({
    n: 1,
    at: actor.at,
    by: actor.by,
    trigger: "Checked in Invoice Check",
    inputs: snapshot(ws, line),
    result,
  });
  const a: Assessment = {
    id,
    createdAt: actor.at,
    createdBy: actor.by,
    fixtureId,
    facts: [],
    versions: [version],
  };
  const next = {
    ...ws,
    assessments: [a, ...ws.assessments],
    nextAssessmentNo: ws.nextAssessmentNo + 1,
  };
  return {
    state: log(next, actor, `${id} saved as version 1: ${describeResult(result)}`, {
      kind: "assessment",
      id,
    }),
    assessmentId: id,
  };
}

/** Records a fact (delivery center or role) against an assessment and recomputes it as a new version. */
export function supplyFact(
  ws: WorkflowState,
  actor: Actor,
  assessmentId: string,
  fact: { kind: "location" | "grade"; value: string; note?: string },
): WorkflowState {
  const a = ws.assessments.find((x) => x.id === assessmentId) ?? fail("Assessment not found.");
  if (!fact.value.trim()) fail("Choose a value.");
  const latest = latestOf(a);
  const line = { ...latest.inputs.line, [fact.kind]: fact.value };
  const label = fact.kind === "location" ? "delivery center" : "role";
  const recorded: Fact = {
    kind: fact.kind,
    value: fact.value,
    ...(fact.note?.trim() ? { note: fact.note.trim() } : {}),
    by: actor.by,
    at: actor.at,
    version: latest.n + 1,
  };
  let next: WorkflowState = {
    ...ws,
    assessments: ws.assessments.map((x) =>
      x.id === a.id ? { ...x, facts: [...x.facts, recorded] } : x,
    ),
    investigations: ws.investigations.map((inv) =>
      inv.assessmentId === a.id
        ? {
            ...inv,
            timeline: [
              ...inv.timeline,
              {
                ...actor,
                text: `Supplied ${label}: ${fact.value}.${recorded.note ? ` Source note: ${recorded.note}` : ""}`,
              },
            ],
          }
        : inv,
    ),
  };
  next = log(next, actor, `Supplied ${label} ${fact.value} for ${a.id}`, {
    kind: "assessment",
    id: a.id,
  });
  return recompute(next, actor, `${label} supplied`, { [a.id]: line });
}

// ---------- investigations ----------

export type InvestigationKind =
  | "Information needed"
  | "Verification pending"
  | "Legal review"
  | "Potential discrepancy"
  | "Review requested";
export type InvestigationStatus =
  "Open" | "With Legal" | "Confirmed" | "Dismissed" | "Reopened" | "Cleared";

const KIND: Partial<Record<ResultStatus, InvestigationKind>> = {
  "Needs information": "Information needed",
  "Awaiting verification": "Verification pending",
  "Needs Legal": "Legal review",
  "Potential discrepancy": "Potential discrepancy",
};

const isFinalOk = (s: ResultStatus) => s === "Match" || s === "Billed below contract";

/** Kind follows the latest version (M9.2). A cleared line keeps the last kind it had. */
export function investigationKind(a: Assessment): InvestigationKind {
  for (let i = a.versions.length - 1; i >= 0; i--) {
    const k = KIND[a.versions[i]!.result.status];
    if (k) return k;
  }
  return "Review requested";
}

/** Derived workflow status, PRD 6.10. */
export function investigationStatus(
  inv: Investigation,
  a: Assessment,
  cases: WorkflowState["conflictCases"],
): InvestigationStatus {
  const latest = latestOf(a);
  const st = latest.result.status;
  if (isFinalOk(st) && a.versions.some((v) => !isFinalOk(v.result.status))) return "Cleared";
  const forLatest = inv.decisions.filter((d) => d.version === latest.n);
  if (forLatest.length) return forLatest[forLatest.length - 1]!.kind;
  if (inv.decisions.length) return "Reopened";
  const cid = latest.result.conflictId;
  if (st === "Needs Legal" && cid && cases[cid]?.status === "With Legal") return "With Legal";
  return "Open";
}

/** Timeline text, with every earlier decision marked as applied to an earlier version. */
export function timelineText(inv: Investigation, a: Assessment, e: TimelineEntry): string {
  if (e.decision === undefined) return e.text;
  const d = inv.decisions[e.decision]!;
  const amount = d.amountPaise !== null ? ` ${formatINR(d.amountPaise)}` : "";
  const since =
    d.version < latestOf(a).n
      ? ` Applied to version ${d.version}, since reassessed.`
      : ` Applied to version ${d.version}.`;
  return `${d.kind}${amount}. Reason: ${d.reason}.${since}`;
}

function openInvestigation(
  ws: WorkflowState,
  actor: Actor,
  assessmentId: string,
  origin: InvestigationOrigin,
): { state: WorkflowState; investigationId: string } {
  const a = ws.assessments.find((x) => x.id === assessmentId) ?? fail("Assessment not found.");
  const existing = ws.investigations.find((i) => i.assessmentId === assessmentId);
  if (existing) return { state: ws, investigationId: existing.id };
  const latest = latestOf(a);
  const st = latest.result.status;
  if (origin === "Raise investigation" && st !== "Potential discrepancy")
    fail("Raise investigation needs a Potential discrepancy.");
  if (origin === "Request review" && (st === "Match" || st === "Invalid input"))
    fail("Request review is for a result other than Match.");
  const id = `I-${String(ws.nextInvestigationNo).padStart(3, "0")}`;
  const inv: Investigation = {
    id,
    assessmentId,
    createdAt: actor.at,
    createdBy: actor.by,
    origin,
    decisions: [],
    timeline: [
      {
        ...actor,
        text: `${origin} from Invoice Check on version ${latest.n}: ${describeResult(latest.result)}.`,
      },
    ],
  };
  const next = {
    ...ws,
    investigations: [inv, ...ws.investigations],
    nextInvestigationNo: ws.nextInvestigationNo + 1,
  };
  return {
    state: log(next, actor, `${id} opened (${origin}) for ${assessmentId}`, {
      kind: "investigation",
      id,
    }),
    investigationId: id,
  };
}

export const requestReview = (ws: WorkflowState, actor: Actor, assessmentId: string) =>
  openInvestigation(ws, actor, assessmentId, "Request review");
export const raiseInvestigation = (ws: WorkflowState, actor: Actor, assessmentId: string) =>
  openInvestigation(ws, actor, assessmentId, "Raise investigation");

/** Appends a Confirmed or Dismissed decision against the latest version. Never edits earlier ones. */
export function decide(
  ws: WorkflowState,
  actor: Actor,
  investigationId: string,
  kind: DecisionKind,
  reason: string,
): WorkflowState {
  const inv =
    ws.investigations.find((i) => i.id === investigationId) ?? fail("Investigation not found.");
  const a = ws.assessments.find((x) => x.id === inv.assessmentId)!;
  const latest = latestOf(a);
  if (latest.result.status !== "Potential discrepancy")
    fail("A decision needs a Potential discrepancy on the latest version.");
  if (inv.decisions.some((d) => d.version === latest.n))
    fail(`A decision already exists for version ${latest.n}.`);
  if (!reason.trim()) fail("Give a reason.");
  const decision: Decision = {
    kind,
    reason: reason.trim(),
    by: actor.by,
    at: actor.at,
    version: latest.n,
    amountPaise: kind === "Confirmed" ? latest.result.differencePaise : null,
  };
  const updated: Investigation = {
    ...inv,
    decisions: [...inv.decisions, decision],
    timeline: [...inv.timeline, { ...actor, text: kind, decision: inv.decisions.length }],
  };
  const next = {
    ...ws,
    investigations: ws.investigations.map((i) => (i.id === inv.id ? updated : i)),
  };
  return log(next, actor, `${inv.id} ${kind} against version ${latest.n}`, {
    kind: "investigation",
    id: inv.id,
  });
}

// ---------- terms ----------

const seedTerm = (id: string) => TERMS.find((t) => t.id === id) ?? fail(`Unknown term ${id}.`);

function setTerm(ws: WorkflowState, id: string, fn: (s: TermState) => TermState): WorkflowState {
  return { ...ws, terms: { ...ws.terms, [id]: fn(ws.terms[id]!) } };
}

const historyEntry = (actor: Actor, action: string, reason?: string) => ({
  at: actor.at,
  by: actor.by,
  role: actor.role,
  action,
  ...(reason?.trim() ? { reason: reason.trim() } : {}),
});

export function isUnsigned(termId: string): boolean {
  const t = seedTerm(termId);
  const doc = DOCUMENTS.find((d) => d.id === t.docId);
  return !doc?.signed || t.initialStatus === "Ignored";
}

/** Corrections whose current value lacks source support. Verify stays disabled while any remain. */
export function unsupportedCorrections(s: TermState): Correction[] {
  const latest = new Map<EditableField, Correction>();
  for (const c of s.corrections ?? []) latest.set(c.field, c);
  return [...latest.values()].filter((c) => !c.supported);
}

export function canVerify(ws: WorkflowState, termId: string): { ok: boolean; reason?: string } {
  if (isUnsigned(termId))
    return {
      ok: false,
      reason: "Terms from unsigned documents are Ignored and cannot be verified.",
    };
  const s = ws.terms[termId]!;
  const missing = unsupportedCorrections(s);
  if (missing.length)
    return {
      ok: false,
      reason: `Source support missing for ${missing.map((c) => c.field).join(", ")}. Add a supporting quote or save as Needs review.`,
    };
  return { ok: true };
}

function afterTermChange(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  text: string,
): WorkflowState {
  return recompute(log(ws, actor, text, { kind: "term", id: termId }), actor, text);
}

/** Verify a rate term after both checks (M5.2). Does not confirm its override link. */
export function verifyTerm(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  reason: string,
): WorkflowState {
  const ok = canVerify(ws, termId);
  if (!ok.ok) fail(ok.reason!);
  const next = setTerm(ws, termId, (s) => ({
    ...s,
    status: "Verified",
    secondReadDiffers: false,
    history: [...s.history, historyEntry(actor, "Verified", reason)],
  }));
  return afterTermChange(next, actor, termId, `${termId} verified`);
}

export function markNeedsReview(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  reason: string,
): WorkflowState {
  if (isUnsigned(termId)) fail("Terms from unsigned documents stay Ignored.");
  const next = setTerm(ws, termId, (s) => ({
    ...s,
    status: "Needs review",
    history: [...s.history, historyEntry(actor, "Marked Needs review", reason)],
  }));
  return afterTermChange(next, actor, termId, `${termId} marked Needs review`);
}

/** An edit to a Verified term returns it to Needs review (M5.5). */
const statusAfterEdit = (s: TermStatus): TermStatus => (s === "Verified" ? "Needs review" : s);

/**
 * Corrects one field. Keeps the AI original beside the current value and needs a source
 * quote from the cited document (PRD 6.5). Unsupported corrections can be saved but block Verify.
 */
export function correctField(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  field: EditableField,
  value: FieldValue,
  opts: { sourceQuote: string; reason: string; allLocationsConfirmed?: boolean },
): WorkflowState {
  const t = seedTerm(termId);
  if (isUnsigned(termId)) fail("Terms from unsigned documents cannot be corrected or verified.");
  const quote = opts.sourceQuote.trim();
  if (!quote) fail("A correction needs a source quote.");
  if (!quoteInDocument(t.docId, quote))
    fail("The source quote is not exact text from the cited document.");
  if (!opts.reason.trim()) fail("Give a reason for the correction.");
  const s = ws.terms[termId]!;
  const from = currentValue(t, s, field);
  if (from === value) fail("The value is unchanged.");
  const doc = DOCUMENTS.find((d) => d.id === t.docId);
  const supported = valueSupported(field, value, [t.quote, quote], {
    ...(doc ? { supplierId: doc.supplierId } : {}),
    ...(opts.allLocationsConfirmed !== undefined
      ? { allLocationsConfirmed: opts.allLocationsConfirmed }
      : {}),
  });
  const correction: Correction = {
    field,
    aiOriginal: aiOriginal(t, field),
    from,
    to: value,
    sourceQuote: quote,
    supported,
    ...(opts.allLocationsConfirmed ? { allLocationsConfirmed: true } : {}),
    reason: opts.reason.trim(),
    by: actor.by,
    at: actor.at,
  };
  const shown = (v: FieldValue) =>
    field === "ratePaise" && typeof v === "number" ? formatINR(v) : String(v ?? "none");
  const next = setTerm(ws, termId, (x) => ({
    ...x,
    status: statusAfterEdit(x.status),
    edits: { ...x.edits, [field]: value },
    corrections: [...(x.corrections ?? []), correction],
    history: [
      ...x.history,
      historyEntry(
        actor,
        `Corrected ${field} from ${shown(from)} to ${shown(value)} (AI original ${shown(correction.aiOriginal)})${supported ? "" : ", source support missing"}`,
        opts.reason,
      ),
    ],
  }));
  return afterTermChange(next, actor, termId, `${termId} ${field} corrected`);
}

/** Chooses the term this one overrides, or none. The new link starts unconfirmed. */
export function setOverride(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  target: string | null,
  reason: string,
): WorkflowState {
  if (isUnsigned(termId)) fail("Terms from unsigned documents cannot override another term.");
  const t = seedTerm(termId);
  if (target) {
    const other = seedTerm(target);
    if (other.id === termId || other.kind !== "rate" || other.grade !== t.grade)
      fail("An override must point to another rate term for the same role.");
  }
  const s = ws.terms[termId]!;
  if ((s.override?.target ?? null) === target) return ws;
  const next = setTerm(ws, termId, (x) => ({
    ...x,
    status: statusAfterEdit(x.status),
    override: target ? { target, confirmed: false } : null,
    history: [
      ...x.history,
      historyEntry(
        actor,
        target ? `Override set to ${target}, not yet confirmed` : "Override link removed",
        reason,
      ),
    ],
  }));
  return afterTermChange(next, actor, termId, `${termId} override changed`);
}

/** Explicitly confirms the override link, recording who and when (M5.3). */
export function confirmOverride(ws: WorkflowState, actor: Actor, termId: string): WorkflowState {
  const s = ws.terms[termId]!;
  if (!s.override) fail("This term has no override link to confirm.");
  if (s.override!.confirmed) return ws;
  const next = setTerm(ws, termId, (x) => ({
    ...x,
    override: { target: x.override!.target, confirmed: true, by: actor.by, at: actor.at },
    history: [
      ...x.history,
      historyEntry(actor, `Override link to ${x.override!.target} confirmed`),
    ],
  }));
  return afterTermChange(next, actor, termId, `${termId} override link confirmed`);
}

/**
 * Clause review (M5.7): check 1 plus an interpretation. Clear or Disputed both mark the
 * extraction Verified. Disputed sends the conflict case to Legal with the written question.
 */
export function reviewClause(
  ws: WorkflowState,
  actor: Actor,
  termId: string,
  choice: "Clear" | "Disputed",
  question = "",
): WorkflowState {
  const t = seedTerm(termId);
  if (t.kind !== "clause" && t.kind !== "notice")
    fail("Only clauses and notices take an interpretation.");
  if (isUnsigned(termId)) fail("Terms from unsigned documents cannot be verified.");
  if (choice === "Disputed" && !question.trim()) fail("Write the question for Legal.");
  let next = setTerm(ws, termId, (s) => ({
    ...s,
    status: "Verified",
    interpretation: {
      choice,
      ...(choice === "Disputed" ? { question: question.trim() } : {}),
      by: actor.by,
      at: actor.at,
    },
    history: [
      ...s.history,
      historyEntry(
        actor,
        choice === "Clear"
          ? "Verified for extraction, interpretation Clear"
          : "Verified for extraction, Disputed and sent to Legal",
        question,
      ),
    ],
  }));
  if (choice === "Disputed" && t.conflictId) {
    const c = next.conflictCases[t.conflictId] ?? { status: "Open" as const, questions: [] };
    if (c.status !== "Ruled") {
      next = {
        ...next,
        conflictCases: {
          ...next.conflictCases,
          [t.conflictId]: {
            status: "With Legal",
            questions: [
              ...c.questions,
              { text: question.trim(), by: actor.by, at: actor.at, termId },
            ],
          },
        },
      };
      next = log(next, actor, `Conflict ${t.conflictId} sent to Legal: ${question.trim()}`, {
        kind: "conflict",
        id: t.conflictId,
      });
    }
  }
  return afterTermChange(next, actor, termId, `${termId} reviewed (${choice})`);
}

/**
 * Records Legal's ruling. Only when the case is With Legal. Immutable once saved. Never
 * changes any term's review status. Every dependent assessment recomputes as a new version.
 */
export function recordRuling(
  ws: WorkflowState,
  actor: Actor,
  conflictId: string,
  reading: Reading,
  reasoning: string,
): WorkflowState {
  const c = ws.conflictCases[conflictId] ?? fail("Conflict not found.");
  if (ws.rulings[conflictId]) fail("A ruling is already recorded and cannot be changed.");
  if (c.status !== "With Legal")
    fail("A ruling can be recorded only when the conflict is With Legal.");
  if (!reasoning.trim()) fail("Write the reasoning.");
  let next: WorkflowState = {
    ...ws,
    rulings: {
      ...ws.rulings,
      [conflictId]: { reading, reasoning: reasoning.trim(), by: actor.by, at: actor.at },
    },
    conflictCases: { ...ws.conflictCases, [conflictId]: { ...c, status: "Ruled" } },
  };
  next = log(next, actor, `Legal ruling on ${conflictId}: Reading ${reading}`, {
    kind: "conflict",
    id: conflictId,
  });
  return recompute(next, actor, `Legal ruling on ${conflictId} (Reading ${reading})`);
}
