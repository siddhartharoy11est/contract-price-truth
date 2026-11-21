import { CONFLICTS, DOCUMENTS, ROLE_MAPS, SUPPLIERS, TERMS } from "@/data/seed";
import type { EngineTerm, Reading, RoleId, TermStatus } from "@/data/types";
import type { EngineContext } from "./pricing-engine";

export interface TermHistoryEntry {
  at: string;
  by: string;
  role: RoleId | "system";
  action: string;
  reason?: string;
}

export interface TermState {
  status: TermStatus;
  /**
   * Override link status for a term with `replaces`. The link is confirmed only when this is
   * explicitly true. Verifying the amending term does not confirm the link (PRD 6.2, 6.3).
   */
  overrideVerified?: boolean;
  editedRatePaise?: number;
  secondReadDiffers?: boolean;
  history: TermHistoryEntry[];
}

export function initialTermStates(): Record<string, TermState> {
  return Object.fromEntries(TERMS.map((t) => [t.id, { status: t.initialStatus, history: [] }]));
}

/** Combines seed terms with review state into the engine's input. Pure. */
export function buildEngineTerms(states: Record<string, TermState>): EngineTerm[] {
  return TERMS.map((t) => {
    const s = states[t.id];
    const doc = DOCUMENTS.find((d) => d.id === t.docId);
    return {
      ...t,
      status: s?.status ?? t.initialStatus,
      ratePaise: s?.editedRatePaise ?? t.ratePaise,
      signed: doc?.signed ?? false,
      supplierId: doc?.supplierId,
      overrideVerified: t.replaces ? s?.overrideVerified === true : undefined,
    };
  });
}

export function buildContext(
  states: Record<string, TermState>,
  rulings: Partial<Record<string, Reading>>,
): EngineContext {
  const deliveryCenters = Object.fromEntries(
    SUPPLIERS.filter((x) => x.deliveryCenters).map((x) => [x.id, x.deliveryCenters!]),
  );
  return { terms: buildEngineTerms(states), conflicts: CONFLICTS, rulings, roleMaps: ROLE_MAPS, deliveryCenters };
}

/** A copy of the seed where the listed terms are Verified. Used by the test runner. */
export function statesWithVerified(ids: string[]): Record<string, TermState> {
  const s = initialTermStates();
  for (const id of ids) if (s[id]) s[id] = { ...s[id]!, status: "Verified" };
  return s;
}

export type FixtureState = "SEED" | "VR" | "CR" | "RULED-A" | "RULED-B";

const RATE_TERMS_TO_VERIFY = ["T02", "T04"];
const CONFLICT_TERMS = ["T06", "T07", "T08", "T09"];

/**
 * PRD fixture states. SEED: T02 and T04 Proposed, clauses Needs review. VR: all rate terms
 * Verified with overrides confirmed. CR: VR plus T06 to T09 reviewed, conflict With Legal.
 * RULED-A and RULED-B: CR plus the ruling.
 */
export function fixtureState(name: FixtureState): {
  states: Record<string, TermState>;
  rulings: Partial<Record<string, Reading>>;
} {
  if (name === "SEED") return { states: initialTermStates(), rulings: {} };
  const ids = name === "VR" ? RATE_TERMS_TO_VERIFY : [...RATE_TERMS_TO_VERIFY, ...CONFLICT_TERMS];
  const states = statesWithVerified(ids);
  for (const id of RATE_TERMS_TO_VERIFY) states[id] = { ...states[id]!, overrideVerified: true };
  const rulings: Partial<Record<string, Reading>> =
    name === "RULED-A" ? { C1: "A" } : name === "RULED-B" ? { C1: "B" } : {};
  return { states, rulings };
}

export function fixtureContext(name: FixtureState): EngineContext {
  const { states, rulings } = fixtureState(name);
  return buildContext(states, rulings);
}
