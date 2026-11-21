import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { roleById } from "@/data/roles";
import { CONFLICTS } from "@/data/seed";
import type { Catalog } from "./catalog";
import { addUploadedDocument, applyExtraction, type UploadInput } from "./uploads";
import type { ExtractResponse } from "./extraction/guard";
import type { InvoiceLine, Reading, RoleId } from "@/data/types";
import { evaluateLine, type EngineContext, type PriceResult } from "./pricing-engine";
import type { EditableField, FieldValue } from "./term-state";
import * as wf from "./workflow";
import type { LiveReadOutcome } from "./live-read";
import {
  clearTour,
  runTourAction,
  TOUR_RESET_EVENT,
  TOUR_ACTIONS,
  type TourActionId,
  type TourRoute,
} from "./tour";

/** v2 re-seeds. Data saved under v1 is not migrated. */
const STORAGE_KEY = "contract-price-truth:v2";
const OLD_KEYS = ["contract-price-truth:v1"];

export interface LiveReadRecord {
  at: string;
  ok: boolean;
  model?: string;
  message?: string;
  outcome?: LiveReadOutcome;
}

export interface DemoState extends wf.WorkflowState {
  role: RoleId;
  liveReads: Partial<Record<string, LiveReadRecord>>;
  progress: { s01Awaiting?: boolean; s01Excess?: boolean };
  guideDismissed: boolean;
  accountSelected: boolean;
}

const defaultState = (): DemoState => ({
  ...wf.seedWorkflow(),
  role: "procurement",
  liveReads: {},
  progress: {},
  guideDismissed: false,
  accountSelected: false,
});

const now = () => new Date().toISOString();

interface Store {
  hydrated: boolean;
  state: DemoState;
  ctx: EngineContext;
  /** Seed plus the visitor's uploads. */
  catalog: Catalog;
  role: ReturnType<typeof roleById>;
  evaluate: (line: InvoiceLine) => PriceResult;
  setRole: (r: RoleId) => void;
  selectAccount: (r: RoleId) => void;
  setAccountSelected: (selected: boolean) => void;
  verifyTerm: (id: string, reason: string) => boolean;
  markNeedsReview: (id: string, reason: string) => boolean;
  correctField: (
    id: string,
    field: EditableField,
    value: FieldValue,
    opts: { sourceQuote: string; reason: string; allLocationsConfirmed?: boolean },
  ) => boolean;
  setOverride: (id: string, target: string | null, reason: string) => boolean;
  confirmOverride: (id: string) => boolean;
  reviewClause: (id: string, choice: "Clear" | "Disputed", question?: string) => boolean;
  recordRuling: (conflictId: string, reading: Reading, reasoning: string) => boolean;
  saveCheck: (line: InvoiceLine, fixtureId: string | null) => string | null;
  supplyFact: (
    assessmentId: string,
    fact: { kind: "location" | "grade"; value: string; note?: string },
  ) => boolean;
  requestReview: (assessmentId: string) => string | null;
  raiseInvestigation: (assessmentId: string) => string | null;
  decide: (investigationId: string, kind: wf.DecisionKind, reason: string) => boolean;
  saveLiveRead: (docId: string, rec: LiveReadRecord) => void;
  uploadDocument: (input: UploadInput) => string | null;
  recordExtraction: (docId: string, res: ExtractResponse) => string | null;
  markProgress: (key: keyof DemoState["progress"]) => void;
  setGuideDismissed: (v: boolean) => void;
  /**
   * Guided tour: plays one real workflow transition, recorded as the action's persona.
   * Returns the result line, or null when the state did not allow it. Never throws.
   */
  tourRun: (id: TourActionId) => { done: string | null; nav?: TourRoute };
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<DemoState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setState = useCallback((next: DemoState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  useEffect(() => {
    try {
      for (const k of OLD_KEYS) window.localStorage.removeItem(k);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DemoState>;
        const seed = defaultState();
        setState({
          ...seed,
          ...parsed,
          terms: { ...seed.terms, ...parsed.terms },
          uploads: { ...seed.uploads, ...parsed.uploads },
        });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, [setState]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const ctx = useMemo(() => wf.contextOf(state), [state]);
  const catalog = useMemo(
    () => wf.catalogFor(state),
    [state.uploads, state.terms], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const role = roleById(state.role);

  const actor = useCallback((): wf.Actor => {
    const r = roleById(stateRef.current.role);
    return { by: r.name, role: r.id, at: now() };
  }, []);

  /** Runs a pure transition. Rule violations show as a toast and leave state unchanged. */
  const run = useCallback(
    <T,>(fn: (s: DemoState, a: wf.Actor) => { state: wf.WorkflowState; value: T }): T | null => {
      try {
        const out = fn(stateRef.current, actor());
        setState({ ...stateRef.current, ...out.state });
        return out.value;
      } catch (e) {
        if (e instanceof wf.WorkflowError) {
          toast.error(e.message);
          return null;
        }
        throw e;
      }
    },
    [actor, setState],
  );
  const runOk = useCallback(
    (fn: (s: DemoState, a: wf.Actor) => wf.WorkflowState) =>
      run((s, a) => ({ state: fn(s, a), value: true })) === true,
    [run],
  );

  const evaluate = useCallback((line: InvoiceLine) => evaluateLine(line, ctx), [ctx]);

  const setRole = useCallback(
    (r: RoleId) => setState({ ...stateRef.current, role: r }),
    [setState],
  );
  const selectAccount = useCallback(
    (r: RoleId) => setState({ ...stateRef.current, role: r, accountSelected: true }),
    [setState],
  );
  const setAccountSelected = useCallback(
    (accountSelected: boolean) => setState({ ...stateRef.current, accountSelected }),
    [setState],
  );

  const saveLiveRead = useCallback(
    (docId: string, rec: LiveReadRecord) => {
      const s = stateRef.current;
      const terms = { ...s.terms };
      for (const tid of rec.outcome?.differingStoredIds ?? []) {
        const t = terms[tid]!;
        terms[tid] = {
          ...t,
          status: t.status === "Ignored" ? "Ignored" : "Proposed",
          secondReadDiffers: true,
          history: [
            ...t.history,
            {
              at: rec.at,
              by: "Live AI second read",
              role: "system",
              action: "Second read differs. Re-verification required.",
            },
          ],
        };
      }
      let next: wf.WorkflowState = { ...s, terms };
      if (rec.outcome?.differingStoredIds?.length)
        next = wf.recompute(
          next,
          { by: "Live AI second read", role: "system", at: rec.at },
          "a second read differed",
        );
      setState({ ...s, ...next, liveReads: { ...s.liveReads, [docId]: rec } });
    },
    [setState],
  );

  const markProgress = useCallback(
    (key: keyof DemoState["progress"]) => {
      const s = stateRef.current;
      if (!s.progress[key]) setState({ ...s, progress: { ...s.progress, [key]: true } });
    },
    [setState],
  );

  const setGuideDismissed = useCallback(
    (v: boolean) => setState({ ...stateRef.current, guideDismissed: v }),
    [setState],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked. The in-memory state still resets.
    }
    clearTour();
    try {
      window.dispatchEvent(new Event(TOUR_RESET_EVENT));
    } catch {
      // No window. Nothing listens.
    }
    setState(defaultState());
  }, [setState]);

  const value: Store = {
    hydrated,
    state,
    ctx,
    catalog,
    role,
    evaluate,
    setRole,
    selectAccount,
    setAccountSelected,
    verifyTerm: (id, reason) => runOk((s, a) => wf.verifyTerm(s, a, id, reason)),
    markNeedsReview: (id, reason) => runOk((s, a) => wf.markNeedsReview(s, a, id, reason)),
    correctField: (id, field, v, opts) =>
      runOk((s, a) => wf.correctField(s, a, id, field, v, opts)),
    setOverride: (id, target, reason) => runOk((s, a) => wf.setOverride(s, a, id, target, reason)),
    confirmOverride: (id) => runOk((s, a) => wf.confirmOverride(s, a, id)),
    reviewClause: (id, choice, q) => runOk((s, a) => wf.reviewClause(s, a, id, choice, q)),
    recordRuling: (cid, reading, reasoning) =>
      runOk((s, a) => wf.recordRuling(s, a, cid, reading, reasoning)),
    saveCheck: (line, fixtureId) =>
      run((s, a) => {
        const out = wf.saveCheck(s, a, line, fixtureId);
        return { state: out.state, value: out.assessmentId };
      }),
    supplyFact: (id, fact) => runOk((s, a) => wf.supplyFact(s, a, id, fact)),
    requestReview: (id) =>
      run((s, a) => {
        const out = wf.requestReview(s, a, id);
        return { state: out.state, value: out.investigationId };
      }),
    raiseInvestigation: (id) =>
      run((s, a) => {
        const out = wf.raiseInvestigation(s, a, id);
        return { state: out.state, value: out.investigationId };
      }),
    decide: (id, kind, reason) => runOk((s, a) => wf.decide(s, a, id, kind, reason)),
    saveLiveRead,
    uploadDocument: (input) =>
      run((s, a) => {
        const out = addUploadedDocument(s, a, input);
        return { state: out.state, value: out.docId };
      }),
    recordExtraction: (docId, res) =>
      run((s, a) => {
        const out = applyExtraction(s, a, docId, res);
        return { state: out.state, value: out.runId };
      }),
    markProgress,
    setGuideDismissed,
    tourRun: (id) => {
      const r = roleById(TOUR_ACTIONS[id].actor);
      const s = stateRef.current;
      const out = runTourAction(s, id, { by: r.name, role: r.id, at: now() });
      if (out.state !== s) setState({ ...s, ...out.state });
      return { done: out.done, ...(out.nav ? { nav: out.nav } : {}) };
    },
    reset,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemo(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useDemo must be used inside DemoStoreProvider");
  return s;
}

export interface InvestigationRow {
  investigation: wf.Investigation;
  assessment: wf.Assessment;
  latest: wf.AssessmentVersion;
  kind: wf.InvestigationKind;
  status: wf.InvestigationStatus;
}

/** Investigations joined with their assessment and derived kind and status. */
export function useInvestigations(): InvestigationRow[] {
  const { state } = useDemo();
  return useMemo(
    () =>
      state.investigations.map((investigation) => {
        const assessment = state.assessments.find((a) => a.id === investigation.assessmentId)!;
        return {
          investigation,
          assessment,
          latest: assessment.versions[assessment.versions.length - 1]!,
          kind: wf.investigationKind(assessment),
          status: wf.investigationStatus(investigation, assessment, state.conflictCases),
        };
      }),
    [state.investigations, state.assessments, state.conflictCases],
  );
}

/** Derived counts used by the header metric, banners and the guided demo. */
export function useDerived() {
  const { state, catalog } = useDemo();
  const TERMS = catalog.terms;
  const rows = useInvestigations();
  return useMemo(() => {
    const countable = TERMS.filter((t) => t.initialStatus !== "Ignored");
    const verified = countable.filter((t) => state.terms[t.id]?.status === "Verified").length;
    const toVerify = TERMS.filter((t) => {
      const st = state.terms[t.id]?.status;
      return st === "Proposed" || st === "Needs review";
    }).length;
    const rateToVerify = TERMS.filter(
      (t) =>
        t.kind === "rate" && ["Proposed", "Needs review"].includes(state.terms[t.id]?.status ?? ""),
    ).length;
    const clausesToReview = TERMS.filter(
      (t) =>
        (t.kind === "clause" || t.kind === "notice") && state.terms[t.id]?.status !== "Verified",
    ).length;
    const unconfirmedLinks = TERMS.filter((t) => {
      const s = state.terms[t.id];
      return s?.status === "Verified" && s.override && !s.override.confirmed;
    }).length;
    // Potential: latest version is a Potential discrepancy (all rates Verified by construction), not yet decided.
    const potentialPaise = rows
      .filter(
        (r) =>
          r.latest.result.status === "Potential discrepancy" &&
          (r.status === "Open" || r.status === "Reopened"),
      )
      .reduce((sum, r) => sum + r.latest.result.differencePaise!, 0);
    const confirmedPaise = rows
      .filter((r) => r.status === "Confirmed")
      .reduce((sum, r) => sum + (r.investigation.decisions.at(-1)?.amountPaise ?? 0), 0);
    const openInvestigations = rows.filter((r) =>
      ["Open", "Reopened", "With Legal"].includes(r.status),
    ).length;
    const conflictsOpen = CONFLICTS.filter(
      (c) => state.conflictCases[c.id]?.status !== "Ruled",
    ).length;
    const conflictsWithLegal = CONFLICTS.filter(
      (c) => state.conflictCases[c.id]?.status === "With Legal",
    ).length;
    return {
      verified,
      totalTerms: countable.length,
      toVerify,
      rateToVerify,
      clausesToReview,
      unconfirmedLinks,
      potentialPaise,
      confirmedPaise,
      openInvestigations,
      conflictsOpen,
      conflictsWithLegal,
      rows,
    };
  }, [state.terms, state.conflictCases, rows, TERMS]);
}
