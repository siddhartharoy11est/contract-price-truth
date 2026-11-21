import { CONFLICTS, TERMS } from "@/data/seed";
import { catalogOf, type Catalog, type Uploads } from "./catalog";
import type { EngineTerm, Reading, RoleId, SeedTerm, TermStatus } from "@/data/types";
import type { EngineContext } from "./pricing-engine";

export interface TermHistoryEntry {
  at: string;
  by: string;
  role: RoleId | "system";
  action: string;
  reason?: string;
}

/**
 * Override link from this term to the term it overrides within its own role, location and
 * dates. It counts only when `confirmed` is explicitly true. Verifying the amending term does
 * not confirm the link (PRD 6.2, 6.3, M5.3).
 */
export interface OverrideLink {
  target: string;
  confirmed: boolean;
  by?: string;
  at?: string;
}

export type EditableField = "ratePaise" | "grade" | "location" | "effectiveFrom" | "effectiveTo";
export type FieldValue = string | number | null;

/** One correction. The AI original stays beside it and is never edited (PRD 6.5). */
export interface Correction {
  field: EditableField;
  aiOriginal: FieldValue;
  from: FieldValue;
  to: FieldValue;
  /** Quote the correction relies on. Must be text from the cited document. */
  sourceQuote: string;
  /** Whether the value is found in the term quote or the source quote (PRD 6.5 rule 3). */
  supported: boolean;
  /** Reviewer confirmed the source does not restrict the rate to particular locations. */
  allLocationsConfirmed?: boolean;
  reason: string;
  by: string;
  at: string;
}

export interface ClauseInterpretation {
  choice: "Clear" | "Disputed";
  question?: string;
  by: string;
  at: string;
}

export interface TermState {
  status: TermStatus;
  /** Null when the reviewer removed the link. Undefined when the term has none. */
  override?: OverrideLink | null;
  edits?: Partial<Record<EditableField, FieldValue>>;
  corrections?: Correction[];
  interpretation?: ClauseInterpretation;
  secondReadDiffers?: boolean;
  history: TermHistoryEntry[];
}

export function initialTermStates(): Record<string, TermState> {
  return Object.fromEntries(
    TERMS.map((t) => {
      const s: TermState = { status: t.initialStatus, history: [] };
      if (t.replaces) s.override = { target: t.replaces, confirmed: false };
      return [t.id, s];
    }),
  );
}

/** The AI original value of a field, from the seed. */
export function aiOriginal(t: SeedTerm, field: EditableField): FieldValue {
  return (t[field] ?? null) as FieldValue;
}

/** Current value of a field: the latest correction or the AI original. */
export function currentValue(
  t: SeedTerm,
  s: TermState | undefined,
  field: EditableField,
): FieldValue {
  const e = s?.edits;
  return e && field in e ? (e[field] ?? null) : aiOriginal(t, field);
}

/** Combines seed terms with review state into the engine's input. Pure. */
export function buildEngineTerms(
  states: Record<string, TermState>,
  catalog: Catalog = catalogOf(null),
): EngineTerm[] {
  return catalog.terms.map((t) => {
    const s = states[t.id];
    const doc = catalog.documents.find((d) => d.id === t.docId);
    const link =
      s && "override" in s
        ? s.override
        : t.replaces
          ? { target: t.replaces, confirmed: false }
          : undefined;
    return {
      ...t,
      ...(s?.edits ?? {}),
      status: s?.status ?? t.initialStatus,
      signed: doc?.signed ?? false,
      supplierId: doc?.supplierId,
      replaces: link?.target,
      overrideVerified: link ? link.confirmed === true : undefined,
    } as EngineTerm;
  });
}

export function buildContext(
  states: Record<string, TermState>,
  rulings: Partial<Record<string, Reading>>,
  uploads?: Uploads | null,
): EngineContext {
  const catalog = catalogOf(uploads, states);
  return {
    terms: buildEngineTerms(states, catalog),
    conflicts: CONFLICTS,
    rulings,
    roleMaps: catalog.roleMaps,
    deliveryCenters: catalog.deliveryCenters,
  };
}

/** A copy of the seed where the listed terms are Verified. Override links stay unconfirmed. */
export function statesWithVerified(ids: string[]): Record<string, TermState> {
  const s = initialTermStates();
  for (const id of ids) if (s[id]) s[id] = { ...s[id]!, status: "Verified" };
  return s;
}

/** Sets the confirmed flag of a term's override link. Used by fixture states and tests. */
export function withOverrideConfirmed(s: TermState, confirmed: boolean): TermState {
  if (!s.override) return s;
  return { ...s, override: { ...s.override, confirmed } };
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
  for (const id of RATE_TERMS_TO_VERIFY) states[id] = withOverrideConfirmed(states[id]!, true);
  const rulings: Partial<Record<string, Reading>> =
    name === "RULED-A" ? { C1: "A" } : name === "RULED-B" ? { C1: "B" } : {};
  return { states, rulings };
}

export function fixtureContext(name: FixtureState): EngineContext {
  const { states, rulings } = fixtureState(name);
  return buildContext(states, rulings);
}
