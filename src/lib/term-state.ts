import { CONFLICTS, DOCUMENTS, TERMS } from "@/data/seed";
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
    };
  });
}

export function buildContext(
  states: Record<string, TermState>,
  rulings: Partial<Record<string, Reading>>,
): EngineContext {
  return { terms: buildEngineTerms(states), conflicts: CONFLICTS, rulings };
}

/** A copy of the seed where the listed terms are Verified. Used by the test runner. */
export function statesWithVerified(ids: string[]): Record<string, TermState> {
  const s = initialTermStates();
  for (const id of ids) if (s[id]) s[id] = { ...s[id]!, status: "Verified" };
  return s;
}
