import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { fixtureById } from "@/data/fixtures";
import { ROLES } from "@/data/roles";
import { routeTree } from "@/routeTree.gen";
import * as wf from "./workflow";
import {
  TOUR_KEY,
  TOUR_NOTE,
  TOUR_ACTIONS,
  runTourAction,
  type TourActionId,
  TOUR_QUESTION,
  TOUR_STEPS,
  clearTour,
  readTour,
  shouldAutoOpen,
  tourDisputeT06,
  tourVerifyT02,
  writeTour,
} from "./tour";

const priya: wf.Actor = { by: "Priya Nair", role: "procurement", at: "2026-11-22T10:00:00.000Z" };
const dev: wf.Actor = { by: "Dev Mehta", role: "finance", at: "2026-11-22T10:05:00.000Z" };

describe("tour script", () => {
  it("has eleven steps, 0 to 10", () => {
    expect(TOUR_STEPS).toHaveLength(11);
  });

  it("has no empty text", () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.trim()).not.toBe("");
      expect(s.body.length).toBeGreaterThan(0);
      for (const p of [...s.body, ...(s.notes ?? []), s.why ?? "x"]) expect(p.trim()).not.toBe("");
    }
  });

  it("uses no dashes in visitor facing text", () => {
    const text = JSON.stringify(TOUR_STEPS) + TOUR_QUESTION + TOUR_NOTE;
    expect(text).not.toMatch(/[–—]| - /);
  });

  it("routes only to pages that exist", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const paths = new Set(TOUR_STEPS.flatMap((s) => (s.route ? [s.route.to] : [])));
    expect(paths.size).toBeGreaterThan(5);
    for (const p of paths) {
      const last = router.matchRoutes(p).at(-1);
      expect(last?.routeId, p).not.toBe(rootRouteId);
    }
  });

  it("names a valid persona wherever a step or action switches account", () => {
    const ids = ROLES.map((r) => r.id);
    for (const s of TOUR_STEPS) if (s.persona) expect(ids).toContain(s.persona);
    for (const a of Object.values(TOUR_ACTIONS)) expect(ids).toContain(a.actor);
    expect(TOUR_STEPS[5]!.persona).toBe("finance");
    expect(TOUR_STEPS[7]!.persona).toBe("legal");
    expect(TOUR_STEPS[8]!.persona).toBe("procurement");
  });

  it("sets the route and persona the brief names for every step", () => {
    expect(TOUR_STEPS.map((s) => s.route?.to ?? null)).toEqual([
      null,
      "/",
      "/documents",
      "/price-book",
      "/price-book",
      "/invoice-check",
      "/invoice-check",
      "/legal",
      "/findings",
      "/documents",
      "/about",
    ]);
    const P = "procurement";
    expect(TOUR_STEPS.map((s) => s.persona)).toEqual([
      null,
      P,
      P,
      P,
      P,
      "finance",
      "finance",
      "legal",
      P,
      P,
      null,
    ]);
    expect(TOUR_STEPS[4]!.route?.search).toEqual({ tab: "clauses" });
  });

  it("plays actions on steps 3 to 6 and 8 only", () => {
    const withAction = TOUR_STEPS.flatMap((s, i) => (s.actions?.length ? [i] : []));
    expect(withAction).toEqual([3, 4, 5, 6, 8]);
  });

  it("keeps every step short: two paragraphs, at most three sentences", () => {
    for (const s of TOUR_STEPS) {
      expect(s.body.length).toBeLessThanOrEqual(2);
      expect(
        s.body
          .join(" ")
          .split(/[.!?](\s|$)/)
          .filter((x) => x.trim()).length,
      ).toBeLessThanOrEqual(3);
    }
  });
});

describe("tour storage", () => {
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };

  it("never throws when storage throws", () => {
    expect(readTour(throwing)).toBeNull();
    expect(() => writeTour("skipped", throwing)).not.toThrow();
    expect(() => clearTour(throwing)).not.toThrow();
    expect(readTour(null)).toBeNull();
  });

  it("remembers skip and completion, and clears", () => {
    const m = new Map<string, string>();
    const mem = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
    expect(readTour(mem)).toBeNull();
    writeTour("skipped", mem);
    expect(m.get(TOUR_KEY)).toBe("skipped");
    expect(readTour(mem)).toBe("skipped");
    writeTour("completed", mem);
    expect(readTour(mem)).toBe("completed");
    clearTour(mem);
    expect(readTour(mem)).toBeNull();
    m.set(TOUR_KEY, "garbage");
    expect(readTour(mem)).toBeNull();
  });
});

describe("tour actions", () => {
  it("step 3 verifies T02 and confirms its link as Priya, which makes S01 exact", () => {
    const saved = wf.saveCheck(wf.seedWorkflow(), dev, fixtureById("S01")!.line, "S01");
    const ws = tourVerifyT02(saved.state, priya);
    const t02 = ws.terms["T02"]!;
    expect(t02.status).toBe("Verified");
    expect(t02.override).toMatchObject({ target: "T01", confirmed: true, by: "Priya Nair" });
    expect(t02.history.filter((h) => h.reason === TOUR_NOTE)).toHaveLength(2);
    expect(ws.activity.some((e) => e.text.startsWith(TOUR_NOTE) && e.by === "Priya Nair")).toBe(
      true,
    );
    const latest = ws.assessments.find((a) => a.id === saved.assessmentId)!.versions.at(-1)!;
    expect(latest.result.status).toBe("Potential discrepancy");
    expect(latest.result.differencePaise).toBe(1500000);
    // Running it again changes nothing that matters.
    expect(tourVerifyT02(ws, priya).terms["T02"]).toEqual(t02);
  });

  it("step 4 marks T06 Disputed with the question, reviews the rest, and sends C1 to Legal", () => {
    const ws = tourDisputeT06(wf.seedWorkflow(), priya);
    expect(ws.terms["T06"]!.status).toBe("Verified");
    expect(ws.terms["T06"]!.interpretation).toMatchObject({
      choice: "Disputed",
      question: TOUR_QUESTION,
      by: "Priya Nair",
    });
    expect(ws.conflictCases["C1"]!.status).toBe("With Legal");
    for (const id of ["T07", "T08", "T09"])
      expect(ws.terms[id]!.interpretation?.choice).toBe("Clear");
    expect(ws.activity.some((e) => e.text.startsWith(TOUR_NOTE))).toBe(true);
    expect(tourDisputeT06(ws, priya)).toBe(ws);
  });
});

describe("handoff", () => {
  it("Request review on S09 creates an investigation", () => {
    const toured = tourDisputeT06(tourVerifyT02(wf.seedWorkflow(), priya), priya);
    const saved = wf.saveCheck(toured, dev, fixtureById("S09")!.line, "S09");
    const v1 = saved.state.assessments[0]!.versions[0]!;
    expect(v1.result.status).toBe("Needs Legal");
    const out = wf.requestReview(saved.state, dev, saved.assessmentId);
    expect(out.investigationId).toBe("I-001");
    const inv = out.state.investigations[0]!;
    expect(inv).toMatchObject({ origin: "Request review", createdBy: "Dev Mehta" });
    expect(v1.result.outcomes?.map((o) => o.ratePaise)).toEqual([52000, 53300]);
    // The line waits on Legal, and Priya can follow it in Investigations.
    expect(wf.investigationStatus(inv, out.state.assessments[0]!, out.state.conflictCases)).toBe(
      "With Legal",
    );
  });
});

const actorFor = (id: TourActionId): wf.Actor => {
  const r = ROLES.find((x) => x.id === TOUR_ACTIONS[id].actor)!;
  return { by: r.name, role: r.id, at: "2026-11-22T11:00:00.000Z" };
};

/** Plays a step's actions on a state, as the panel does. */
const playStep = (ws: wf.WorkflowState, n: number) => {
  let state = ws;
  const done: (string | null)[] = [];
  for (const id of TOUR_STEPS[n]!.actions ?? []) {
    const out = runTourAction(state, id, actorFor(id));
    state = out.state;
    done.push(out.done);
  }
  return { state, done };
};

describe("tour actions on the real workflow", () => {
  const toStep = (n: number) => {
    let ws = wf.seedWorkflow();
    for (let i = 3; i < n; i++) ws = playStep(ws, i).state;
    return ws;
  };

  it("every action step changes state once and is idempotent when run twice", () => {
    for (const n of [3, 4, 5, 6, 8]) {
      const before = toStep(n);
      const first = playStep(before, n);
      expect(first.state, `step ${n}`).not.toBe(before);
      expect(
        first.done.every((d) => d?.startsWith("Done: ")),
        `step ${n}`,
      ).toBe(true);
      const second = playStep(first.state, n);
      expect(second.state, `step ${n} again`).toBe(first.state);
      expect(second.done).toEqual(first.done);
    }
  });

  it("records actions as the step's persona with the tour note", () => {
    const ws = toStep(9);
    const notes = ws.activity.filter((e) => e.text.startsWith(TOUR_NOTE));
    expect(new Set(notes.map((e) => e.by))).toEqual(
      new Set(["Priya Nair", "Dev Mehta", "Anika Rao"]),
    );
    expect(ws.rulings["C1"]).toMatchObject({ reading: "A", by: "Anika Rao" });
  });

  it("leaves a consistent state after steps 3 to 8 in order", () => {
    const ws = toStep(9);
    expect(ws.terms["T02"]!.status).toBe("Verified");
    expect(ws.terms["T02"]!.override?.confirmed).toBe(true);
    expect(ws.terms["T06"]!.interpretation?.choice).toBe("Disputed");
    expect(ws.conflictCases["C1"]!.status).toBe("Ruled");
    const s01 = ws.assessments.find((a) => a.fixtureId === "S01")!;
    expect(s01.versions.at(-1)!.result.differencePaise).toBe(1500000);
    const s09 = ws.assessments.find((a) => a.fixtureId === "S09")!;
    expect(s09.versions.length).toBeGreaterThanOrEqual(2);
    expect(s09.versions[0]!.result.status).toBe("Needs Legal");
    expect(s09.versions.at(-1)!.result.status).not.toBe("Needs Legal");
    const inv = ws.investigations.find((i) => i.assessmentId === s09.id)!;
    expect(inv.origin).toBe("Request review");
    expect(playStep(ws, 8).done.at(-1)).toBe(
      `Done: ${inv.id} open, ${s09.versions.length} versions`,
    );
  });

  it("skips an action the state does not allow, without throwing", () => {
    const seed = wf.seedWorkflow();
    for (const id of ["request-S09", "rule-C1", "open-S09-investigation"] as const) {
      const out = runTourAction(seed, id, actorFor(id));
      expect(out.state).toBe(seed);
      expect(out.done).toBeNull();
    }
  });

  it("steps out of order still work: S01 before T02 is verified waits for verification", () => {
    const out = playStep(wf.seedWorkflow(), 5);
    expect(out.done[0]).toBe("Done: S01 checked, Awaiting verification");
    const later = playStep(out.state, 3).state;
    const s01 = later.assessments.find((a) => a.fixtureId === "S01")!;
    expect(s01.versions.at(-1)!.result.status).toBe("Potential discrepancy");
  });
});

describe("tour auto open", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };

  it("opens on a first visit, on any page but /tests", () => {
    const mem = memory();
    for (const p of ["/", "/about", "/findings", "/documents", "/invoice-check", "/legal/C1"])
      expect(shouldAutoOpen(p, false, mem)).toBe(true);
    expect(shouldAutoOpen("/tests", false, mem)).toBe(false);
    expect(shouldAutoOpen("/tests/", false, mem)).toBe(false);
  });

  it("stays closed after close or start, and reopens after Reset demo", () => {
    const mem = memory();
    writeTour("skipped", mem);
    expect(shouldAutoOpen("/", false, mem)).toBe(false);
    writeTour("started", mem);
    expect(shouldAutoOpen("/", false, mem)).toBe(false);
    clearTour(mem);
    expect(shouldAutoOpen("/", false, mem)).toBe(true);
  });

  it("opens at most once per page load when storage throws", () => {
    expect(() => shouldAutoOpen("/", false, throwing)).not.toThrow();
    expect(shouldAutoOpen("/", false, throwing)).toBe(true);
    expect(shouldAutoOpen("/", true, throwing)).toBe(false);
    expect(shouldAutoOpen("/", false, null)).toBe(true);
  });
});
