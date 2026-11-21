import { describe, expect, it } from "vitest";
import type { ExtractedTerm } from "./extraction/core";
import { evaluateLine } from "./pricing-engine";
import { fixtureState } from "./term-state";
import {
  addUploadedDocument,
  applyExtraction,
  checkFile,
  checkPages,
  pageMarkedText,
} from "./uploads";
import { contextOf, seedWorkflow, verifyTerm, type Actor, type WorkflowState } from "./workflow";
import {
  AMENDMENT_3_PAGES,
  amendment3Terms,
  mockResponse as response,
  ORBIS_PAGES,
  orbisTerms,
} from "./upload-fixtures";

const priya: Actor = { by: "Priya", role: "procurement", at: "2026-11-21T10:00:00Z" };


function vrState(): WorkflowState {
  const { states, rulings } = fixtureState("VR");
  return {
    ...seedWorkflow(),
    terms: states,
    rulings: Object.fromEntries(
      Object.entries(rulings).map(([k, r]) => [k, { reading: r!, reasoning: "x", by: "Anika", at: priya.at }]),
    ),
  };
}

describe("upload checks (U02 to U04)", () => {
  it("rejects wrong type, empty file and bad text with a plain message", () => {
    expect(checkFile({ name: "rates.docx", type: "application/msword", size: 10 })).toMatch(/PDF/);
    expect(checkFile({ name: "rates.pdf", type: "application/pdf", size: 0 })).toMatch(/empty/);
    expect(checkFile({ name: "rates.pdf", type: "application/pdf", size: 2000 })).toBeNull();
    expect(checkPages(["", " "])).toMatch(/scanned or empty/);
    expect(checkPages(Array.from({ length: 26 }, () => "text ".repeat(20)))).toMatch(/26 pages/);
    expect(checkPages(["x".repeat(80_001)])).toMatch(/limit is 80,000/);
    expect(checkPages(ORBIS_PAGES)).toBeNull();
  });

  it("page marks the text the server expects", () => {
    expect(pageMarkedText(["a", "b"])).toBe("[[PAGE 1]]\na\n\n[[PAGE 2]]\nb");
  });
});

describe("Journey D on the real engine", () => {
  it("D3 to D8: a new supplier's verified uploaded term prices a line with a citation", () => {
    let ws = seedWorkflow();
    const up = addUploadedDocument(ws, priya, {
      supplier: { newName: "Orbis Facilities Services" },
      fileName: "Orbis_Order_Form_SAMPLE.pdf",
      title: "Order Form OFS-2026-014",
      documentType: "Order Form",
      signingStatus: "Signed",
      pages: ORBIS_PAGES,
    });
    ws = up.state;
    const fabricated: ExtractedTerm = { ...orbisTerms()[0]!, role: "Night Guard", amount: 999, quote: "Role: Night Guard. Rate: INR 999 per hour." };
    const run = applyExtraction(ws, priya, up.docId, response([...orbisTerms(), fabricated], ORBIS_PAGES));
    ws = run.state;
    const r = ws.uploads.runs.at(-1)!;
    expect(r.status).toBe("Completed");
    expect(r.source).toBe("Live");
    expect(r.accepted).toBe(3);
    expect(r.rejected).toBe(1);
    const live = ws.uploads.terms;
    expect(live.every((t) => t.source === "Live")).toBe(true);
    expect(live.every((t) => ws.terms[t.id]!.status !== "Verified")).toBe(true);
    const sup = live.find((t) => t.grade === "Facilities Supervisor")!;
    expect(sup.location).toBe("all");
    expect(sup.ratePaise).toBe(64000);

    const line = {
      supplierId: up.supplierId,
      grade: "Facilities Supervisor",
      location: "",
      serviceStart: "2026-12-01",
      serviceEnd: "2026-12-31",
      hours: 100,
      billedRatePaise: 66000,
      poRatePaise: null,
    };
    const before = evaluateLine(line, contextOf(ws));
    expect(before.status).toBe("Awaiting verification");
    expect(before.differencePaise).toBeNull();

    ws = verifyTerm(ws, priya, sup.id, "Checked against page 2");
    const after = evaluateLine(line, contextOf(ws));
    expect(after.status).toBe("Potential discrepancy");
    expect(after.applicableRatePaise).toBe(64000);
    expect(after.differencePaise).toBe(200000);
    expect(after.citedTermIds).toContain(sup.id);
    expect(after.explanation.join(" ")).toContain(up.docId);
  });

  it("D9: a failed run records the reason and changes nothing else", () => {
    let ws = seedWorkflow();
    const up = addUploadedDocument(ws, priya, {
      supplier: { newName: "Orbis Facilities Services" },
      fileName: "o.pdf",
      title: "Order Form",
      documentType: "Order Form",
      signingStatus: "Signed",
      pages: ORBIS_PAGES,
    });
    ws = up.state;
    const out = applyExtraction(ws, priya, up.docId, { ok: false, code: "capacity", message: "Live extraction has reached today's limit." });
    expect(out.state.uploads.runs.at(-1)).toMatchObject({ status: "Failed", code: "capacity" });
    expect(out.state.uploads.terms).toEqual([]);
    expect(out.state.terms).toEqual(ws.terms);
    expect(out.state.assessments).toEqual(ws.assessments);
  });

  it("D10, S12 and U06: an unverified later amendment leaves the line Awaiting verification naming it", () => {
    let ws = vrState();
    const up = addUploadedDocument(ws, priya, {
      supplier: { id: "brighthire" },
      fileName: "BrightHire_Amendment_3_SAMPLE.pdf",
      title: "Amendment 3",
      documentType: "Amendment",
      signingStatus: "Signed",
      pages: AMENDMENT_3_PAGES,
    });
    ws = applyExtraction(up.state, priya, up.docId, response(amendment3Terms(), AMENDMENT_3_PAGES)).state;
    const amd = ws.uploads.terms[0]!;
    expect(amd).toMatchObject({ grade: "L2", location: "Hyderabad", ratePaise: 50000, effectiveFrom: "2026-11-01" });
    expect(ws.terms[amd.id]!.status).toBe("Proposed");
    const r = evaluateLine(
      {
        grade: "L2",
        location: "Hyderabad",
        serviceStart: "2026-11-01",
        serviceEnd: "2026-11-30",
        hours: 100,
        billedRatePaise: 52000,
        poRatePaise: null,
      },
      contextOf(ws),
    );
    expect(r.status).toBe("Awaiting verification");
    expect(r.differencePaise).toBeNull();
    expect(r.blockers?.flatMap((b) => b.termIds)).toContain(amd.id);
    // Hyderabad only: a Pune line in the same month is not affected by the amendment.
    const pune = evaluateLine(
      { grade: "L4", location: "Pune", serviceStart: "2026-11-01", serviceEnd: "2026-11-30", hours: 10, billedRatePaise: 120000, poRatePaise: null },
      contextOf(ws),
    );
    expect(pune.status).toBe("Match");
  });

  it("an unsigned upload yields Ignored terms that cannot be verified", () => {
    let ws = seedWorkflow();
    const up = addUploadedDocument(ws, priya, {
      supplier: { newName: "Orbis Facilities Services" },
      fileName: "o.pdf",
      title: "Draft",
      documentType: "Order Form",
      signingStatus: "Unsigned draft",
      pages: ORBIS_PAGES,
    });
    ws = applyExtraction(up.state, priya, up.docId, response(orbisTerms(), ORBIS_PAGES)).state;
    const id = ws.uploads.terms[0]!.id;
    expect(ws.terms[id]!.status).toBe("Ignored");
    expect(() => verifyTerm(ws, priya, id, "x")).toThrow(/unsigned/);
  });

  it("a term missing a required value is Needs review and Verify is blocked", () => {
    let ws = seedWorkflow();
    const up = addUploadedDocument(ws, priya, {
      supplier: { newName: "Orbis Facilities Services" },
      fileName: "o.pdf",
      title: "Order Form",
      documentType: "Order Form",
      signingStatus: "Signed",
      pages: ORBIS_PAGES,
    });
    const t = { ...orbisTerms()[1]!, effective_from: null };
    ws = applyExtraction(up.state, priya, up.docId, response([t], ORBIS_PAGES)).state;
    const id = ws.uploads.terms[0]!.id;
    expect(ws.terms[id]!.status).toBe("Needs review");
    expect(() => verifyTerm(ws, priya, id, "x")).toThrow(/effective from/);
  });
});
