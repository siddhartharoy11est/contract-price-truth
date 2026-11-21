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
  TOUR_QUESTION,
  TOUR_STEPS,
  clearTour,
  readTour,
  stepLinks,
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
      for (const l of stepLinks(s)) expect(l.label.trim()).not.toBe("");
    }
  });

  it("uses no dashes in visitor facing text", () => {
    const text = JSON.stringify(TOUR_STEPS) + TOUR_QUESTION + TOUR_NOTE;
    expect(text).not.toMatch(/[–—]| - /);
  });

  it("links only to routes that exist", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const paths = new Set(TOUR_STEPS.flatMap((s) => stepLinks(s).map((l) => l.to)));
    expect(paths.size).toBeGreaterThan(5);
    for (const p of paths) {
      const last = router.matchRoutes(p).at(-1);
      expect(last?.routeId, p).not.toBe(rootRouteId);
    }
  });

  it("names a valid persona wherever a step or link switches account", () => {
    const ids = ROLES.map((r) => r.id);
    for (const s of TOUR_STEPS) {
      if (s.persona) expect(ids).toContain(s.persona);
      for (const l of stepLinks(s)) if (l.role) expect(ids).toContain(l.role);
    }
    expect(TOUR_STEPS[5]!.persona).toBe("finance");
    expect(TOUR_STEPS[7]!.persona).toBe("legal");
    expect(TOUR_STEPS[8]!.persona).toBe("procurement");
  });

  it("offers Do this step for me on steps 3 and 4 only", () => {
    const withAction = TOUR_STEPS.flatMap((s, i) => (s.doForMe ? [i] : []));
    expect(withAction).toEqual([3, 4]);
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

describe("Do this step for me", () => {
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
