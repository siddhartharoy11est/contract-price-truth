/**
 * The guided tour: the script, its storage and the actions it performs for the visitor.
 * Pure data and functions, no React. The tour only performs real workflow transitions.
 */
import { fixtureById } from "@/data/fixtures";
import type { RoleId } from "@/data/types";
import * as wf from "./workflow";

export type TourPath =
  | "/"
  | "/documents"
  | "/suppliers"
  | "/price-book"
  | "/invoice-check"
  | "/findings"
  | "/legal"
  | "/about"
  | "/tests";

export type TourBadge = "ai" | "rules" | "people";

/** Where a step takes the app. The hash selects a row or opens a record on that page. */
export interface TourRoute {
  to: TourPath;
  search?: Record<string, string>;
  hash?: string;
}

export type TourActionId =
  | "verify-T02"
  | "dispute-T06"
  | "check-S01"
  | "check-S09"
  | "request-S09"
  | "rule-C1"
  | "open-S09-investigation";

export interface TourStep {
  title: string;
  /** The account the step switches to. Null keeps whichever account is active. */
  persona: RoleId | null;
  /** Where the step navigates. Null for the welcome step. */
  route: TourRoute | null;
  body: string[];
  why?: string;
  notes?: string[];
  badges?: TourBadge[];
  /** Played in order after the page renders. */
  actions?: TourActionId[];
  /** The data-tour attribute of the element the step talks about. */
  highlight?: string;
}

export const TOUR_NOTE = "Performed by the guided tour";

export const TOUR_QUESTION =
  "Schedule A Note 2 fixes rates for the Initial Term, but MSA clause 4.3 allows an annual increase and BrightHire sent a notice raising the L2 rate from 1 April 2026. Are rates fixed for the Initial Term, or may the supplier apply the annual adjustment?";

export const TOUR_RULING_REASONING =
  "Schedule A Note 2 is the specific term for the Initial Term, so the rates stay fixed and the notice does not apply.";

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Know the price you agreed to pay",
    persona: null,
    route: null,
    body: [
      "Contracts get amended, but purchase orders and invoices keep the old price. Contract Price Truth turns signed contracts into a verified, clause cited price book and tests invoice lines against it.",
      "Where it cannot be sure, it refuses and names who can fix it.",
    ],
    notes: [
      "Synthetic data and simulated accounts. Starting resets the demo. Dark theme is in the account menu.",
    ],
  },
  {
    title: "Dashboard",
    persona: "procurement",
    route: { to: "/" },
    body: [
      "Priya owns the price book, and her dashboard shows what is waiting for her.",
      "Coverage is the share of signed rate terms a person has verified.",
    ],
    why: "A price nobody has verified is not a price the company can defend.",
    highlight: "action-required",
  },
  {
    title: "Repository",
    persona: "procurement",
    route: { to: "/documents" },
    body: [
      "All Contracts lists every document, with search and filters.",
      "Suppliers groups the same documents by supplier.",
    ],
    why: "The repository is the source of truth, and every price links back to a page and quote.",
  },
  {
    title: "Price Book, rates",
    persona: "procurement",
    route: { to: "/price-book", hash: "T02" },
    badges: ["ai", "people"],
    body: [
      "AI proposed each rate with an exact quote. Priya verifies T02 and confirms its override link.",
      "An amendment never replaces a rate just because its date is later.",
    ],
    why: "AI never marks anything verified. A person does.",
    actions: ["verify-T02"],
    highlight: "term-T02",
  },
  {
    title: "Contractual Clauses and escalation",
    persona: "procurement",
    route: { to: "/price-book", search: { tab: "clauses" }, hash: "T06" },
    badges: ["people"],
    body: [
      "A schedule note fixes rates for the term, a clause allows an annual increase, and the supplier sent a notice asking for more.",
      "The notice is a claim, not an agreement. Priya marks T06 Disputed with a question for Legal and reviews T07, T08 and T09 as Clear.",
    ],
    why: "Only genuine contradictions reach Legal. Missing facts stay with Procurement.",
    actions: ["dispute-T06"],
    highlight: "term-T06",
  },
  {
    title: "Invoice Check, an exact answer",
    persona: "finance",
    route: { to: "/invoice-check", search: { example: "S01" } },
    badges: ["rules"],
    body: [
      "Dev checks line S01. Because T02 is verified, the answer is exact: a potential discrepancy of 15,000 rupees, with the clause and quote behind it.",
      "The purchase order carried the old rate, which is why PO matching misses this.",
    ],
    why: "Standard matching compares the invoice to the PO, not to the contract.",
    actions: ["check-S01"],
    highlight: "invoice-result",
  },
  {
    title: "Invoice Check, a refusal",
    persona: "finance",
    route: { to: "/invoice-check", search: { example: "S09" } },
    badges: ["rules"],
    body: [
      "Line S09 uses the conflicted rate, so the app gives no verdict and shows both readings instead.",
      "Dev clicks Request review, which opens an investigation for Procurement. Nothing is sent to the supplier and nothing blocks payment.",
    ],
    why: "A wrong all clear is worse than a refusal. The target for false clears is zero.",
    actions: ["check-S09", "request-S09"],
    highlight: "request-review",
  },
  {
    title: "Legal review queue",
    persona: "legal",
    route: { to: "/legal", hash: "C1" },
    badges: ["people"],
    body: [
      "Anika sees the question, the clauses, the supplier claim, Reading A and Reading B, and every invoice line the ruling would change.",
      "She chooses a reading and writes her reasoning. A ruling never verifies clauses by itself.",
    ],
    why: "Legal is used for judgment, not for routine review.",
    highlight: "legal-readings",
  },
  {
    title: "Investigations",
    persona: "procurement",
    route: { to: "/findings" },
    badges: ["people"],
    body: [
      "Legal ruled for Reading A, and every affected invoice line recalculated as a new version. The investigation shows the versions, the decision history and the timeline.",
      "Priya confirms or dismisses it with a reason, and nothing earlier is erased.",
    ],
    why: "Finance, Procurement and Legal all work from one record, and the history is auditable.",
    actions: ["rule-C1", "open-S09-investigation"],
    highlight: "investigation-versions",
  },
  {
    title: "Contract upload",
    persona: "procurement",
    route: { to: "/documents" },
    badges: ["ai"],
    body: [
      "Procurement adds new contracts here with Upload Contract. AI reads the pages and proposes rate terms with exact quotes, and quotes not found in the document are rejected.",
      "Nothing counts until Procurement verifies it.",
    ],
    why: "Extraction never creates a verified price.",
  },
  {
    title: "About and validation",
    persona: null,
    route: { to: "/about" },
    body: [
      "About This Project covers the stakeholders, the problem, the success metrics and the assumptions.",
      "Prototype Validation, in the sidebar, runs every pricing scenario and journey against the real engine.",
    ],
  },
];

export const BADGE_LABEL: Record<TourBadge, string> = {
  ai: "AI proposes",
  rules: "Rules calculate",
  people: "People decide",
};

export const PERSONA_CHIP: Record<RoleId, string> = {
  procurement: "Priya, Procurement",
  finance: "Dev, Finance",
  legal: "Anika, Legal",
};

// ---------- storage ----------

export const TOUR_KEY = "contract-price-truth:tour";
export type TourMemory = "started" | "skipped" | "completed";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageOf = (s?: StorageLike | null): StorageLike | null => {
  if (s !== undefined) return s;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** Reads whether the visitor started, skipped or finished the tour. Never throws. */
export function readTour(s?: StorageLike | null): TourMemory | null {
  try {
    const v = storageOf(s)?.getItem(TOUR_KEY);
    return v === "started" || v === "skipped" || v === "completed" ? v : null;
  } catch {
    return null;
  }
}

export function writeTour(value: TourMemory, s?: StorageLike | null): void {
  try {
    storageOf(s)?.setItem(TOUR_KEY, value);
  } catch {
    // Storage blocked or full. The tour still works for this page load.
  }
}

export function clearTour(s?: StorageLike | null): void {
  try {
    storageOf(s)?.removeItem(TOUR_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---------- actions ----------

/** Step 3: verifies T02 and confirms its override link, through the normal workflow rules. */
export function tourVerifyT02(ws: wf.WorkflowState, actor: wf.Actor): wf.WorkflowState {
  const t = ws.terms["T02"];
  if (t?.status === "Verified" && t.override?.confirmed) return ws;
  let next = ws;
  if (t?.status !== "Verified") next = wf.verifyTerm(next, actor, "T02", TOUR_NOTE);
  if (!next.terms["T02"]?.override?.confirmed)
    next = wf.confirmOverride(next, actor, "T02", TOUR_NOTE);
  return wf.log(next, actor, `${TOUR_NOTE}: T02 verified and its override link confirmed`, {
    kind: "term",
    id: "T02",
  });
}

/** The other clauses in conflict C1. Each must be reviewed before an invoice line shows both readings. */
const OTHER_C1_CLAUSES = ["T07", "T08", "T09"];

/**
 * Step 4: marks T06 Disputed with the prewritten question, which sends conflict C1 to Legal,
 * and reviews the other C1 clauses as Clear, as Journey C does. Clauses already reviewed stay.
 */
export function tourDisputeT06(ws: wf.WorkflowState, actor: wf.Actor): wf.WorkflowState {
  if (ws.rulings["C1"]) return ws;
  let next = ws;
  if (next.terms["T06"]?.interpretation?.choice !== "Disputed")
    next = wf.reviewClause(next, actor, "T06", "Disputed", TOUR_QUESTION);
  for (const id of OTHER_C1_CLAUSES)
    if (!next.terms[id]?.interpretation)
      next = wf.reviewClause(next, actor, id, "Clear", TOUR_NOTE);
  if (next === ws) return ws;
  return wf.log(
    next,
    actor,
    `${TOUR_NOTE}: T06 marked Disputed and sent to Legal, T07, T08 and T09 reviewed as Clear`,
    { kind: "term", id: "T06" },
  );
}

/** The saved check for an example line, if Invoice Check already has one. */
export const assessmentFor = (ws: wf.WorkflowState, fixtureId: string) =>
  ws.assessments.find((a) => a.fixtureId === fixtureId);

/** Steps 5 and 6: saves the example line exactly as Check Against Contract does. */
export function tourCheck(
  ws: wf.WorkflowState,
  actor: wf.Actor,
  fixtureId: string,
): { state: wf.WorkflowState; assessmentId: string } {
  const existing = assessmentFor(ws, fixtureId);
  if (existing) return { state: ws, assessmentId: existing.id };
  const out = wf.saveCheck(ws, actor, fixtureById(fixtureId)!.line, fixtureId);
  if (out.state === ws) return out;
  return {
    state: wf.log(out.state, actor, `${TOUR_NOTE}: ${fixtureId} checked`, {
      kind: "assessment",
      id: out.assessmentId,
    }),
    assessmentId: out.assessmentId,
  };
}

/** The investigation opened for an example line, if any. */
export const investigationFor = (ws: wf.WorkflowState, fixtureId: string) => {
  const a = assessmentFor(ws, fixtureId);
  return a ? ws.investigations.find((i) => i.assessmentId === a.id) : undefined;
};

/** Step 6: Request review on the S09 check. Needs the check first. */
export function tourRequestS09(
  ws: wf.WorkflowState,
  actor: wf.Actor,
): { state: wf.WorkflowState; investigationId: string } | null {
  const done = investigationFor(ws, "S09");
  if (done) return { state: ws, investigationId: done.id };
  const a = assessmentFor(ws, "S09");
  if (!a) return null;
  const out = wf.requestReview(ws, actor, a.id);
  return {
    state: wf.log(out.state, actor, `${TOUR_NOTE}: review requested for S09`, {
      kind: "investigation",
      id: out.investigationId,
    }),
    investigationId: out.investigationId,
  };
}

/** Step 8: Anika's ruling on C1, Reading A, as the S09 journey records it. Only when With Legal. */
export function tourRuleC1(ws: wf.WorkflowState, actor: wf.Actor): wf.WorkflowState | null {
  if (ws.rulings["C1"]) return ws;
  if (ws.conflictCases["C1"]?.status !== "With Legal") return null;
  const next = wf.recordRuling(ws, actor, "C1", "A", TOUR_RULING_REASONING);
  return wf.log(next, actor, `${TOUR_NOTE}: Legal ruling on C1 recorded`, {
    kind: "conflict",
    id: "C1",
  });
}

/** What an action left: the new state, a one line result, and where to show it. */
export interface TourActionResult {
  state: wf.WorkflowState;
  /** Null when the state did not allow the action, so it was skipped. */
  done: string | null;
  /** Navigate here afterwards, replacing the history entry. */
  nav?: TourRoute;
}

const statusOf = (ws: wf.WorkflowState, assessmentId: string) => {
  const a = ws.assessments.find((x) => x.id === assessmentId)!;
  return wf.describeResult(a.versions[a.versions.length - 1]!.result);
};

const check = (fixtureId: string) => (ws: wf.WorkflowState, actor: wf.Actor) => {
  const out = tourCheck(ws, actor, fixtureId);
  return {
    state: out.state,
    done: `Done: ${fixtureId} checked, ${statusOf(out.state, out.assessmentId)}`,
    nav: { to: "/invoice-check" as const, search: { open: out.assessmentId } },
  };
};

/**
 * Every action the tour can play: who performs it and the pure transition. Each is idempotent:
 * running it again returns the same state and the same result line.
 */
export const TOUR_ACTIONS: Record<
  TourActionId,
  { actor: RoleId; run: (ws: wf.WorkflowState, actor: wf.Actor) => TourActionResult }
> = {
  "verify-T02": {
    actor: "procurement",
    run: (ws, actor) => ({
      state: tourVerifyT02(ws, actor),
      done: "Done: T02 verified and its override link confirmed",
    }),
  },
  "dispute-T06": {
    actor: "procurement",
    run: (ws, actor) => {
      const state = tourDisputeT06(ws, actor);
      return {
        state,
        done:
          state.terms["T06"]?.interpretation?.choice === "Disputed"
            ? "Done: T06 Disputed and the question is with Legal"
            : null,
      };
    },
  },
  "check-S01": { actor: "finance", run: check("S01") },
  "check-S09": { actor: "finance", run: check("S09") },
  "request-S09": {
    actor: "finance",
    run: (ws, actor) => {
      const out = tourRequestS09(ws, actor);
      return out
        ? { state: out.state, done: `Done: review requested as ${out.investigationId}` }
        : { state: ws, done: null };
    },
  },
  "rule-C1": {
    actor: "legal",
    run: (ws, actor) => {
      const state = tourRuleC1(ws, actor);
      return state ? { state, done: "Done: Legal ruled for Reading A" } : { state: ws, done: null };
    },
  },
  "open-S09-investigation": {
    actor: "procurement",
    run: (ws) => {
      const inv = investigationFor(ws, "S09");
      if (!inv) return { state: ws, done: null };
      const a = ws.assessments.find((x) => x.id === inv.assessmentId)!;
      return {
        state: ws,
        done: `Done: ${inv.id} open, ${a.versions.length} versions`,
        nav: { to: "/findings", hash: inv.id },
      };
    },
  },
};

/**
 * Runs one action safely. Rule violations skip the action and leave the state as it was.
 * Never throws.
 */
export function runTourAction(
  ws: wf.WorkflowState,
  id: TourActionId,
  actor: wf.Actor,
): TourActionResult {
  try {
    return TOUR_ACTIONS[id].run(ws, actor);
  } catch {
    return { state: ws, done: null };
  }
}
