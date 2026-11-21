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
import { roleById } from "@/data/roles";
import { CONFLICTS, TERMS } from "@/data/seed";
import type { Grade, InvoiceLine, Location, Reading, RoleId } from "@/data/types";
import { evaluateLine, type EngineContext, type PriceResult } from "./pricing-engine";
import { buildContext, initialTermStates, type TermState } from "./term-state";
import { statusAfterRecalc, type Finding, type Ruling } from "./findings";
import { formatINR } from "./money";
import type { LiveReadOutcome } from "./live-read";

const STORAGE_KEY = "contract-price-truth:v1";

export interface LiveReadRecord {
  at: string;
  ok: boolean;
  model?: string;
  message?: string;
  outcome?: LiveReadOutcome;
}

export interface DemoState {
  role: RoleId;
  terms: Record<string, TermState>;
  findings: Finding[];
  rulings: Partial<Record<string, Ruling>>;
  escalations: Partial<Record<string, { at: string; by: string }>>;
  liveReads: Partial<Record<string, LiveReadRecord>>;
  progress: { s01Awaiting?: boolean; s01Excess?: boolean };
  guideDismissed: boolean;
  accountSelected: boolean;
  nextFindingNo: number;
}

const defaultState = (): DemoState => ({
  role: "procurement",
  terms: initialTermStates(),
  findings: [],
  rulings: {},
  escalations: {},
  liveReads: {},
  progress: {},
  guideDismissed: false,
  accountSelected: false,
  nextFindingNo: 1,
});

const now = () => new Date().toISOString();

function rulingReadings(rulings: DemoState["rulings"]): Partial<Record<string, Reading>> {
  return Object.fromEntries(Object.entries(rulings).map(([k, v]) => [k, v!.reading]));
}

function describeResult(r: PriceResult): string {
  if (r.status === "Potential discrepancy")
    return `Potential discrepancy, ${formatINR(r.differencePaise!)} potential excess`;
  if (r.status === "Match") return `Match at ${formatINR(r.applicableRatePaise!)} per hour`;
  if (r.status === "Billed below contract")
    return `Billed below contract by ${formatINR(-r.differencePaise!)}`;
  return r.status;
}

interface Store {
  hydrated: boolean;
  state: DemoState;
  ctx: EngineContext;
  role: ReturnType<typeof roleById>;
  evaluate: (line: InvoiceLine) => PriceResult;
  setRole: (r: RoleId) => void;
  selectAccount: (r: RoleId) => void;
  setAccountSelected: (selected: boolean) => void;
  verifyTerm: (id: string, opts: { editedRatePaise?: number; reason: string }) => void;
  raiseFinding: (line: InvoiceLine, fixtureId: string | null) => string;
  confirmFinding: (id: string) => void;
  dismissFinding: (id: string, reason: string) => void;
  supplyFact: (id: string, fact: { location?: Location; grade?: Grade }) => void;
  escalateConflict: (conflictId: string, findingId?: string) => void;
  recordRuling: (conflictId: string, reading: Reading, reasoning: string) => void;
  saveLiveRead: (docId: string, rec: LiveReadRecord) => void;
  markProgress: (key: keyof DemoState["progress"]) => void;
  setGuideDismissed: (v: boolean) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DemoState>;
        setState({
          ...defaultState(),
          ...parsed,
          terms: { ...initialTermStates(), ...parsed.terms },
        });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const ctx = useMemo(
    () => buildContext(state.terms, rulingReadings(state.rulings)),
    [state.terms, state.rulings],
  );
  const role = roleById(state.role);

  const actor = useCallback((s: DemoState) => {
    const r = roleById(s.role);
    return { by: r.name, role: r.id, at: now() };
  }, []);

  const evaluate = useCallback((line: InvoiceLine) => evaluateLine(line, ctx), [ctx]);

  const setRole = useCallback((r: RoleId) => setState((s) => ({ ...s, role: r })), []);
  const selectAccount = useCallback(
    (r: RoleId) => setState((s) => ({ ...s, role: r, accountSelected: true })),
    [],
  );
  const setAccountSelected = useCallback(
    (accountSelected: boolean) => setState((s) => ({ ...s, accountSelected })),
    [],
  );

  const verifyTerm: Store["verifyTerm"] = useCallback(
    (id, { editedRatePaise, reason }) =>
      setState((s) => {
        const prev = s.terms[id]!;
        const a = actor(s);
        const seed = TERMS.find((t) => t.id === id)!;
        const edited = editedRatePaise !== undefined && editedRatePaise !== seed.ratePaise;
        const { editedRatePaise: _previousEdit, ...rest } = prev;
        const next: TermState = {
          ...rest,
          status: "Verified",
          secondReadDiffers: false,
          history: [
            ...prev.history,
            {
              ...a,
              action: edited
                ? `Verified with edited rate ${formatINR(editedRatePaise!)} (AI proposed ${formatINR(seed.ratePaise!)})`
                : "Verified",
              reason: reason.trim() || "No reason given",
            },
          ],
        };
        if (edited) next.editedRatePaise = editedRatePaise;
        return { ...s, terms: { ...s.terms, [id]: next } };
      }),
    [actor],
  );

  const raiseFinding: Store["raiseFinding"] = useCallback(
    (line, fixtureId) => {
      const newId = `F-${String(stateRef.current.nextFindingNo).padStart(3, "0")}`;
      setState((s) => {
        const a = actor(s);
        const result = evaluateLine(line, buildContext(s.terms, rulingReadings(s.rulings)));
        const finding: Finding = {
          id: newId,
          createdAt: a.at,
          fixtureId,
          line,
          status: "Open",
          raisedStatus: result.status,
          timeline: [{ ...a, text: `Raised from Invoice Check: ${describeResult(result)}.` }],
        };
        return { ...s, findings: [finding, ...s.findings], nextFindingNo: s.nextFindingNo + 1 };
      });
      return newId;
    },
    [actor],
  );

  const updateFinding = useCallback(
    (id: string, fn: (f: Finding, s: DemoState, a: ReturnType<typeof actor>) => Finding) =>
      setState((s) => {
        const a = actor(s);
        return { ...s, findings: s.findings.map((f) => (f.id === id ? fn(f, s, a) : f)) };
      }),
    [actor],
  );

  const confirmFinding: Store["confirmFinding"] = useCallback(
    (id) =>
      updateFinding(id, (f, s, a) => {
        const r = evaluateLine(f.line, buildContext(s.terms, rulingReadings(s.rulings)));
        if (r.status !== "Potential discrepancy") return f;
        return {
          ...f,
          status: "Confirmed",
          confirmedPaise: r.differencePaise!,
          timeline: [
            ...f.timeline,
            { ...a, text: `Confirmed discrepancy of ${formatINR(r.differencePaise!)}.` },
          ],
        };
      }),
    [updateFinding],
  );

  const dismissFinding: Store["dismissFinding"] = useCallback(
    (id, reason) =>
      updateFinding(id, (f, _s, a) => ({
        ...f,
        status: "Dismissed",
        timeline: [...f.timeline, { ...a, text: `Dismissed. Reason: ${reason.trim()}` }],
      })),
    [updateFinding],
  );

  const supplyFact: Store["supplyFact"] = useCallback(
    (id, fact) =>
      updateFinding(id, (f, s, a) => {
        const line = {
          ...f.line,
          ...(fact.location ? { location: fact.location } : {}),
          ...(fact.grade ? { grade: fact.grade } : {}),
        };
        const r = evaluateLine(line, buildContext(s.terms, rulingReadings(s.rulings)));
        const what = fact.location ? `delivery center: ${fact.location}` : `grade: ${fact.grade}`;
        return {
          ...f,
          line,
          factsSupplied: true,
          status: statusAfterRecalc(r, Boolean(f.escalated)),
          timeline: [
            ...f.timeline,
            { ...a, text: `Supplied ${what}. Recalculated: ${describeResult(r)}.` },
          ],
        };
      }),
    [updateFinding],
  );

  const escalateConflict: Store["escalateConflict"] = useCallback(
    (conflictId, findingId) =>
      setState((s) => {
        const a = actor(s);
        return {
          ...s,
          escalations: {
            ...s.escalations,
            [conflictId]: s.escalations[conflictId] ?? { at: a.at, by: a.by },
          },
          findings: s.findings.map((f) =>
            f.id === findingId
              ? {
                  ...f,
                  escalated: true,
                  status: "With Legal",
                  timeline: [
                    ...f.timeline,
                    { ...a, text: "Escalated to Legal for a ruling on the clause conflict." },
                  ],
                }
              : f,
          ),
        };
      }),
    [actor],
  );

  const recordRuling: Store["recordRuling"] = useCallback(
    (conflictId, reading, reasoning) =>
      setState((s) => {
        const a = actor(s);
        const conflict = CONFLICTS.find((c) => c.id === conflictId)!;
        const before = buildContext(s.terms, rulingReadings(s.rulings));
        const rulings = {
          ...s.rulings,
          [conflictId]: { reading, reasoning: reasoning.trim(), by: a.by, at: a.at },
        };
        const terms = { ...s.terms };
        for (const tid of conflict.termIds) {
          const t = terms[tid]!;
          terms[tid] = {
            ...t,
            status: "Verified",
            history: [
              ...t.history,
              {
                ...a,
                action: `Resolved by Legal ruling: Reading ${reading}`,
                reason: reasoning.trim(),
              },
            ],
          };
        }
        const after = buildContext(terms, rulingReadings(rulings));
        const findings = s.findings.map((f) => {
          if (f.status !== "Open" && f.status !== "With Legal") return f;
          const prev = evaluateLine(f.line, before);
          if (prev.conflictId !== conflictId || prev.status !== "Needs Legal") return f;
          const r = evaluateLine(f.line, after);
          return {
            ...f,
            status: statusAfterRecalc(r, false),
            timeline: [
              ...f.timeline,
              {
                ...a,
                text: `Legal ruling recorded (Reading ${reading}). Recalculated: ${describeResult(r)}.`,
              },
            ],
          };
        });
        return { ...s, rulings, terms, findings };
      }),
    [actor],
  );

  const saveLiveRead: Store["saveLiveRead"] = useCallback(
    (docId, rec) =>
      setState((s) => {
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
        return { ...s, terms, liveReads: { ...s.liveReads, [docId]: rec } };
      }),
    [],
  );

  const markProgress: Store["markProgress"] = useCallback(
    (key) =>
      setState((s) => (s.progress[key] ? s : { ...s, progress: { ...s.progress, [key]: true } })),
    [],
  );

  const setGuideDismissed = useCallback(
    (v: boolean) => setState((s) => ({ ...s, guideDismissed: v })),
    [],
  );

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(defaultState());
  }, []);

  const value: Store = {
    hydrated,
    state,
    ctx,
    role,
    evaluate,
    setRole,
    selectAccount,
    setAccountSelected,
    verifyTerm,
    raiseFinding,
    confirmFinding,
    dismissFinding,
    supplyFact,
    escalateConflict,
    recordRuling,
    saveLiveRead,
    markProgress,
    setGuideDismissed,
    reset,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useDemo(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useDemo must be used inside DemoStoreProvider");
  return s;
}

/** Derived counts used by the header metric, banners and the guided demo. */
export function useDerived() {
  const { state, evaluate } = useDemo();
  return useMemo(() => {
    const countable = TERMS.filter((t) => t.initialStatus !== "Ignored");
    const verified = countable.filter((t) => state.terms[t.id]?.status === "Verified").length;
    const toVerify = TERMS.filter((t) => state.terms[t.id]?.status === "Proposed").length;
    const evaluated = state.findings.map((f) => ({ finding: f, result: evaluate(f.line) }));
    const potentialPaise = evaluated
      .filter((e) => e.finding.status === "Open" && e.result.status === "Potential discrepancy")
      .reduce((sum, e) => sum + e.result.differencePaise!, 0);
    const confirmedPaise = state.findings
      .filter((f) => f.status === "Confirmed")
      .reduce((sum, f) => sum + (f.confirmedPaise ?? 0), 0);
    const openFindings = state.findings.filter((f) => f.status === "Open").length;
    const conflictsToEscalate = CONFLICTS.filter(
      (c) => !state.escalations[c.id] && !state.rulings[c.id],
    ).length;
    const conflictsWithLegal = CONFLICTS.filter(
      (c) => state.escalations[c.id] && !state.rulings[c.id],
    ).length;
    return {
      verified,
      totalTerms: countable.length,
      toVerify,
      evaluated,
      potentialPaise,
      confirmedPaise,
      openFindings,
      conflictsToEscalate,
      conflictsWithLegal,
    };
  }, [state, evaluate]);
}
