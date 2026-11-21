import { describe, expect, it } from "vitest";
import { fixtureById } from "@/data/fixtures";
import * as wf from "./workflow";

const priya: wf.Actor = { by: "Priya Nair", role: "procurement", at: "2026-11-21T10:00:00.000Z" };
const dev: wf.Actor = { by: "Dev Mehta", role: "finance", at: "2026-11-21T10:05:00.000Z" };
const anika: wf.Actor = { by: "Anika Rao", role: "legal", at: "2026-11-21T10:10:00.000Z" };
const line = (id: string) => fixtureById(id)!.line;

/** VR: T02 and T04 verified with override links confirmed. */
function vr(ws = wf.seedWorkflow()): wf.WorkflowState {
  for (const id of ["T02", "T04"]) {
    ws = wf.verifyTerm(ws, priya, id, "Checked");
    ws = wf.confirmOverride(ws, priya, id);
  }
  return ws;
}

const latest = (ws: wf.WorkflowState, id: string) =>
  ws.assessments.find((a) => a.id === id)!.versions.at(-1)!;

describe("override link confirmation", () => {
  it("verifying T02 alone does not count the link; Confirm link records who and when", () => {
    let ws = wf.seedWorkflow();
    const { state, assessmentId } = wf.saveCheck(ws, dev, line("S01"), "S01");
    ws = wf.verifyTerm(state, priya, "T02", "Quote checked");
    expect(ws.terms["T02"]!.override).toEqual({ target: "T01", confirmed: false });
    expect(latest(ws, assessmentId).result.status).toBe("Awaiting verification");
    ws = wf.confirmOverride(ws, priya, "T02");
    expect(ws.terms["T02"]!.override).toMatchObject({
      target: "T01",
      confirmed: true,
      by: "Priya Nair",
      at: priya.at,
    });
    expect(latest(ws, assessmentId).result.status).toBe("Potential discrepancy");
    expect(latest(ws, assessmentId).result.differencePaise).toBe(1500000);
  });

  it("changing the override target resets confirmation and returns a Verified term to Needs review", () => {
    let ws = vr();
    ws = wf.setOverride(ws, priya, "T02", null, "Wrong link");
    expect(ws.terms["T02"]!.override).toBeNull();
    expect(ws.terms["T02"]!.status).toBe("Needs review");
    ws = wf.setOverride(ws, priya, "T02", "T01", "Restore");
    expect(ws.terms["T02"]!.override).toEqual({ target: "T01", confirmed: false });
  });

  it("unsigned draft terms cannot be verified", () => {
    expect(() => wf.verifyTerm(wf.seedWorkflow(), priya, "T10", "")).toThrow(wf.WorkflowError);
  });
});

describe("assessment versions", () => {
  it("each recompute appends a version and earlier versions never change", () => {
    let ws = wf.seedWorkflow();
    const saved = wf.saveCheck(ws, dev, line("S01"), "S01");
    ws = saved.state;
    const id = saved.assessmentId;
    const v1 = JSON.stringify(ws.assessments[0]!.versions[0]);
    expect(latest(ws, id).result.status).toBe("Awaiting verification");
    ws = vr(ws);
    const a = ws.assessments.find((x) => x.id === id)!;
    expect(a.versions.map((v) => v.result.status)).toEqual([
      "Awaiting verification",
      "Potential discrepancy",
    ]);
    expect(JSON.stringify(a.versions[0])).toBe(v1);
    expect(Object.isFrozen(a.versions[0])).toBe(true);
    expect(a.versions[1]!.inputs.terms["T02"]).toEqual({
      status: "Verified",
      ratePaise: 105000,
      override: "T01",
      overrideConfirmed: true,
    });
    // Editing a Verified term returns it to Needs review and appends a new version.
    ws = wf.correctField(ws, priya, "T02", "ratePaise", 105000 - 100, {
      sourceQuote: "reduced from ₹1,200 to ₹1,050",
      reason: "Test edit",
    });
    expect(ws.terms["T02"]!.status).toBe("Needs review");
    const after = ws.assessments.find((x) => x.id === id)!;
    expect(after.versions).toHaveLength(3);
    expect(after.versions[2]!.result.status).toBe("Awaiting verification");
    expect(JSON.stringify(after.versions[0])).toBe(v1);
  });

  it("an unrelated verification adds no version", () => {
    let ws = wf.seedWorkflow();
    const saved = wf.saveCheck(ws, dev, line("S03"), "S03");
    ws = wf.verifyTerm(saved.state, priya, "T04", "ok");
    expect(ws.assessments[0]!.versions).toHaveLength(1);
  });

  it("a correction keeps the AI original and needs source support to verify", () => {
    let ws = wf.seedWorkflow();
    expect(() =>
      wf.correctField(ws, priya, "T02", "ratePaise", 100000, { sourceQuote: "", reason: "x" }),
    ).toThrow("source quote");
    expect(() =>
      wf.correctField(ws, priya, "T02", "ratePaise", 100000, {
        sourceQuote: "not in the document",
        reason: "x",
      }),
    ).toThrow("not exact text");
    ws = wf.correctField(ws, priya, "T02", "ratePaise", 100000, {
      sourceQuote: "All other rates in Schedule A remain unchanged.",
      reason: "x",
    });
    const c = ws.terms["T02"]!.corrections![0]!;
    expect(c).toMatchObject({ aiOriginal: 105000, from: 105000, to: 100000, supported: false });
    expect(wf.canVerify(ws, "T02").ok).toBe(false);
    ws = wf.correctField(ws, priya, "T02", "ratePaise", 105000, {
      sourceQuote: "is reduced from ₹1,200 to ₹1,050",
      reason: "back",
    });
    expect(wf.canVerify(ws, "T02").ok).toBe(true);
  });
});

describe("investigations", () => {
  it("decisions are append-only and a Confirmed decision stays in the timeline after Match (I02)", () => {
    // Reading A makes S09 a Potential discrepancy; Confirm it; a later state makes it Match.
    let ws = vr();
    const saved = wf.saveCheck(ws, dev, line("S09"), "S09");
    ws = saved.state;
    const opened = wf.requestReview(ws, dev, saved.assessmentId);
    ws = opened.state;
    for (const t of ["T06", "T07", "T08"])
      ws = wf.reviewClause(
        ws,
        priya,
        t,
        t === "T07" ? "Disputed" : "Clear",
        "Fixed or adjustable?",
      );
    ws = wf.reviewClause(ws, priya, "T09", "Clear");
    expect(latest(ws, saved.assessmentId).result.status).toBe("Needs Legal");
    ws = wf.recordRuling(ws, anika, "C1", "A", "Note 2 is specific.");
    expect(latest(ws, saved.assessmentId).result.status).toBe("Potential discrepancy");
    ws = wf.decide(ws, priya, opened.investigationId, "Confirmed", "Rates fixed");
    const decided = ws.investigations[0]!;
    expect(decided.decisions).toHaveLength(1);
    const a = ws.assessments[0]!;
    expect(wf.investigationStatus(decided, a, ws.conflictCases)).toBe("Confirmed");
    expect(() => wf.decide(ws, priya, opened.investigationId, "Dismissed", "Changed mind")).toThrow(
      "already exists",
    );

    // The line becomes Match: correct T05 to 533 (supported by the notice? no: by Schedule text it is not).
    ws = wf.correctField(ws, priya, "T05", "ratePaise", 53300, {
      sourceQuote: "QA Analyst (Grade L2): ₹520 per hour.",
      reason: "test",
    });
    ws = { ...ws, terms: { ...ws.terms, T05: { ...ws.terms["T05"]!, status: "Verified" } } };
    ws = wf.recompute(ws, priya, "test");
    const inv = ws.investigations[0]!;
    const asmt = ws.assessments[0]!;
    expect(asmt.versions.at(-1)!.result.status).toBe("Match");
    expect(wf.investigationStatus(inv, asmt, ws.conflictCases)).toBe("Cleared");
    expect(inv.decisions).toEqual(decided.decisions);
    const entry = inv.timeline.find((e) => e.decision === 0)!;
    expect(wf.timelineText(inv, asmt, entry)).toContain(
      `Applied to version ${inv.decisions[0]!.version}, since reassessed`,
    );
  });

  it("a decision for an earlier version only gives Reopened", () => {
    let ws = vr();
    const saved = wf.saveCheck(ws, dev, line("S01"), "S01");
    ws = saved.state;
    const opened = wf.raiseInvestigation(ws, dev, saved.assessmentId);
    ws = wf.decide(
      opened.state,
      priya,
      opened.investigationId,
      "Dismissed",
      "Supplier credit note expected",
    );
    ws = wf.supplyFact(ws, priya, saved.assessmentId, {
      kind: "grade",
      value: "Senior Software Engineer",
    });
    // Grade text changes the line, so a new version exists with the same verdict.
    const a = ws.assessments[0]!;
    expect(a.versions).toHaveLength(2);
    expect(wf.investigationStatus(ws.investigations[0]!, a, ws.conflictCases)).toBe("Reopened");
  });

  it("one investigation per line, and kind follows the latest version (Journey B)", () => {
    let ws = vr();
    const saved = wf.saveCheck(ws, dev, line("S07"), "S07");
    ws = saved.state;
    expect(wf.saveCheck(ws, dev, line("S07"), "S07").assessmentId).toBe(saved.assessmentId);
    const first = wf.requestReview(ws, dev, saved.assessmentId);
    ws = first.state;
    expect(wf.requestReview(ws, dev, saved.assessmentId).investigationId).toBe(
      first.investigationId,
    );
    expect(wf.investigationKind(ws.assessments[0]!)).toBe("Information needed");
    ws = wf.supplyFact(ws, priya, saved.assessmentId, {
      kind: "location",
      value: "Pune",
      note: "Timesheet",
    });
    const a = ws.assessments[0]!;
    expect(a.versions.map((v) => v.result.status)).toEqual(["Needs information", "Match"]);
    expect(wf.investigationStatus(ws.investigations[0]!, a, ws.conflictCases)).toBe("Cleared");
    expect(ws.investigations).toHaveLength(1);
  });
});

describe("Legal ruling", () => {
  it("a ruling never verifies the clauses and needs the case to be With Legal", () => {
    let ws = vr();
    expect(() => wf.recordRuling(ws, anika, "C1", "A", "Too early")).toThrow("With Legal");
    ws = wf.reviewClause(ws, priya, "T07", "Disputed", "Fixed or adjustable?");
    expect(ws.conflictCases["C1"]!.status).toBe("With Legal");
    const before = Object.fromEntries(Object.entries(ws.terms).map(([k, v]) => [k, v.status]));
    ws = wf.recordRuling(ws, anika, "C1", "B", "4.3 operates");
    const after = Object.fromEntries(Object.entries(ws.terms).map(([k, v]) => [k, v.status]));
    expect(after).toEqual(before);
    expect(ws.terms["T06"]!.status).toBe("Needs review");
    expect(ws.conflictCases["C1"]!.status).toBe("Ruled");
    expect(() => wf.recordRuling(ws, anika, "C1", "A", "Again")).toThrow("cannot be changed");
  });

  it("after a ruling every dependent assessment recomputes as a new version", () => {
    let ws = vr();
    const s533 = wf.saveCheck(ws, dev, line("S09"), "S09");
    ws = s533.state;
    const s540 = wf.saveCheck(ws, dev, { ...line("S09"), billedRatePaise: 54000 }, null);
    ws = s540.state;
    const s08 = wf.saveCheck(ws, dev, line("S08"), "S08");
    ws = s08.state;
    for (const t of ["T06", "T07", "T08", "T09"])
      ws = wf.reviewClause(ws, priya, t, "Disputed", "Which reading?");
    expect(latest(ws, s533.assessmentId).result.status).toBe("Needs Legal");
    ws = wf.recordRuling(ws, anika, "C1", "B", "Adjustment applies");
    expect(latest(ws, s533.assessmentId).result.status).toBe("Match");
    expect(latest(ws, s540.assessmentId).result).toMatchObject({
      status: "Potential discrepancy",
      differencePaise: 70000,
    });
    expect(ws.assessments.find((a) => a.id === s08.assessmentId)!.versions).toHaveLength(1);
    expect(
      ws.assessments.find((a) => a.id === s533.assessmentId)!.versions.map((v) => v.result.status),
    ).toEqual(["Awaiting verification", "Needs Legal", "Match"]);
  });
});
