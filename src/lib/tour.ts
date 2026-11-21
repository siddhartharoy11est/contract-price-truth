/**
 * The guided tour: the script, its storage and the two steps it can perform for the visitor.
 * Pure data and functions, no React. The tour only performs real workflow transitions.
 */
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

export interface TourLink {
  label: string;
  to: TourPath;
  search?: Record<string, string>;
  hash?: string;
  /** Switch to this demo account before navigating. */
  role?: RoleId;
}

export interface TourStep {
  title: string;
  /** Null for steps that belong to no single persona. */
  persona: RoleId | null;
  body: string[];
  why?: string;
  notes?: string[];
  badges?: TourBadge[];
  /** Where "Go there" (or "Switch to") navigates. */
  go?: TourLink;
  /** Extra navigation buttons. */
  links?: TourLink[];
  /** Only steps 3 and 4 can be performed by the tour. */
  doForMe?: "verify-T02" | "dispute-T06";
  themeTip?: boolean;
}

export const TOUR_NOTE = "Performed by the guided tour";

export const TOUR_QUESTION =
  "Schedule A Note 2 fixes rates for the Initial Term, but MSA clause 4.3 allows an annual increase and BrightHire sent a notice raising the L2 rate from 1 April 2026. Are rates fixed for the Initial Term, or may the supplier apply the annual adjustment?";

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Know the price you agreed to pay",
    persona: null,
    body: [
      "Contracts get amended, but purchase orders and invoices keep the old price. Contract Price Truth turns signed contracts into a verified, clause cited price book, then tests one invoice line against it. Where it cannot be sure, it refuses and names who can fix it.",
    ],
    notes: [
      "Synthetic data and simulated accounts. Starting resets the demo so every step works.",
      "Tip: a dark theme is available from the account menu.",
    ],
    themeTip: true,
  },
  {
    title: "Dashboard",
    persona: "procurement",
    body: [
      "Priya owns the price book. Her dashboard answers one question: what is waiting for me? The cards count terms to verify, conflicts and investigations. Coverage is the share of signed rate terms a person has verified.",
      "Two actions wait here: the amendment rates, and a clause conflict.",
    ],
    why: "A price nobody has verified is not a price the company can defend.",
    go: { label: "Go there", to: "/" },
  },
  {
    title: "Repository",
    persona: "procurement",
    body: [
      "All Contracts lists every document, with search and filters. Upload Contract is here, and you can create a new supplier while uploading. Suppliers groups the same documents by supplier.",
    ],
    why: "The repository is the source of truth, and every price links back to a page and quote.",
    links: [
      { label: "All Contracts", to: "/documents" },
      { label: "Suppliers", to: "/suppliers" },
    ],
  },
  {
    title: "Price Book, rates",
    persona: "procurement",
    badges: ["ai", "people"],
    body: [
      "AI proposed each rate with an exact quote. Open T02 to read the quote on its original page.",
      "Verify it, then confirm the override link: an amendment never replaces a rate just because its date is later.",
    ],
    why: "AI never marks anything verified. A person does.",
    go: { label: "Go there", to: "/price-book", hash: "T02" },
    doForMe: "verify-T02",
  },
  {
    title: "Contractual Clauses and escalation",
    persona: "procurement",
    badges: ["people"],
    body: [
      "Not every price rule is a rate. A schedule note says rates are fixed for the term, a clause allows an annual increase, and the supplier sent a notice asking for a higher rate.",
      "The notice is a claim, not an agreement. Mark T06 Disputed and write the question for Legal, then review T07, T08 and T09 as Clear so every clause in the conflict is reviewed.",
    ],
    notes: ["That escalates the conflict to Legal. We will see it from Legal's side shortly."],
    why: "Only genuine contradictions reach Legal. Missing facts stay with Procurement.",
    go: { label: "Go there", to: "/price-book", search: { tab: "clauses" }, hash: "T06" },
    doForMe: "dispute-T06",
  },
  {
    title: "Invoice Check, an exact answer",
    persona: "finance",
    badges: ["rules"],
    body: [
      "Dev checks one invoice line. Because T02 is verified, the answer is exact: a potential discrepancy of 15,000 rupees, with the clause and quote behind it.",
      "The purchase order carried the old rate, which is why PO matching misses this.",
    ],
    why: "Standard matching compares the invoice to the PO, not to the contract.",
    go: { label: "Go there", to: "/invoice-check" },
    links: [
      {
        label: "Load example S01 into the form",
        to: "/invoice-check",
        search: { example: "S01" },
        role: "finance",
      },
    ],
  },
  {
    title: "Invoice Check, a refusal",
    persona: "finance",
    badges: ["rules"],
    body: [
      "Now a line for the conflicted rate (S09). The contract contradicts itself, so the app shows no verdict. It shows both readings and who owns the next step.",
      "Click Request review: this creates an investigation for Procurement. Nothing is sent to the supplier and nothing blocks payment.",
    ],
    why: "A wrong all clear is worse than a refusal. The target for false clears is zero.",
    go: { label: "Go there", to: "/invoice-check" },
    links: [
      {
        label: "Load example S09",
        to: "/invoice-check",
        search: { example: "S09" },
        role: "finance",
      },
    ],
  },
  {
    title: "Legal review queue",
    persona: "legal",
    badges: ["people"],
    body: [
      "Legal sees one thing: the question, the clauses, the supplier claim, Reading A and Reading B, and every invoice line the ruling would change.",
      "Anika chooses a reading and writes her reasoning. A ruling never verifies clauses by itself.",
    ],
    why: "Legal is used for judgment, not for routine review.",
    go: { label: "Go there", to: "/legal" },
  },
  {
    title: "Investigations",
    persona: "procurement",
    badges: ["people"],
    body: [
      "After the ruling, every affected line recalculated as a new version. Open the investigation to see all versions, the decision history and the timeline.",
      "Priya decides: confirm the discrepancy or dismiss it, with a reason. Earlier versions and decisions are never erased.",
    ],
    why: "Finance, Procurement and Legal all work from one record, and the history is auditable.",
    go: { label: "Go there (Investigations)", to: "/findings" },
  },
  {
    title: "Contract upload",
    persona: "procurement",
    badges: ["ai"],
    body: [
      "Procurement can add a new contract here. On All Contracts, click Upload Contract, choose or create the supplier, pick a searchable PDF and click Extract Prices.",
      "AI reads the pages and proposes rate terms with exact quotes. Quotes that do not appear in the document are rejected and counted. Nothing counts until Procurement verifies it. Two sample PDFs are linked in the upload dialog.",
    ],
    notes: [
      "Uploads call a real AI model and are limited per visitor per day. If the limit is reached, the stored demo keeps working.",
    ],
    why: "Extraction never creates a verified price.",
    links: [{ label: "Go to All Contracts", to: "/documents" }],
  },
  {
    title: "About and validation",
    persona: null,
    body: [
      "About This Project covers why this stage, the stakeholders, the problem, the success metrics, what would make me rethink, and the assumptions.",
      "Prototype Validation runs the pricing scenarios and journeys against the real engine on an isolated copy of the data.",
    ],
    notes: ["Tip: dark theme is available from the account menu."],
    themeTip: true,
    links: [
      { label: "About This Project", to: "/about" },
      { label: "Prototype Validation", to: "/tests" },
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

/** Every link a step can navigate to, including Go there. */
export const stepLinks = (s: TourStep): TourLink[] => [...(s.go ? [s.go] : []), ...(s.links ?? [])];

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

// ---------- "Do this step for me" ----------

/** Step 3: verifies T02 and confirms its override link, through the normal workflow rules. */
export function tourVerifyT02(ws: wf.WorkflowState, actor: wf.Actor): wf.WorkflowState {
  let next = ws;
  if (next.terms["T02"]?.status !== "Verified") next = wf.verifyTerm(next, actor, "T02", TOUR_NOTE);
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

export const TOUR_ACTIONS = {
  "verify-T02": tourVerifyT02,
  "dispute-T06": tourDisputeT06,
} as const;
