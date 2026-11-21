/**
 * Journey D: uploaded documents and live extraction results. Pure transitions over the
 * workflow state. Extraction only proposes: it never creates a Verified term, and a failed
 * run changes nothing but its own run record (PRD M3, 5.4).
 */
import type { CheckedTerm } from "./extraction/core";
import type { ExtractResponse } from "./extraction/guard";
import { ROLE_MAPS } from "@/data/seed";
import type { ContractDocument, SeedTerm, Supplier } from "@/data/types";
import { resolveGrade } from "./pricing-engine";
import type { ExtractionRun } from "./catalog";
import {
  catalogFor,
  log,
  recompute,
  WorkflowError,
  type Actor,
  type WorkflowState,
} from "./workflow";

/** Browser side limits, stricter than the server's. The server enforces its own (PRD 7.5). */
export const UPLOAD_LIMITS = { maxPages: 25, maxChars: 80_000, maxFileBytes: 10_000_000 } as const;
/** Below this much text a PDF is treated as scanned or empty. */
export const MIN_TEXT_CHARS = 80;

export const DOCUMENT_TYPES = [
  "Agreement",
  "Schedule",
  "Amendment",
  "Order Form",
  "Supplier notice",
  "Other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const SIGNING_STATUSES = ["Signed", "Unsigned draft", "Received notice"] as const;
export type SigningStatus = (typeof SIGNING_STATUSES)[number];

const fail = (msg: string): never => {
  throw new WorkflowError(msg);
};

/** Checks the chosen file before any text is read. Returns a plain message, or null. */
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  const pdfName = /\.pdf$/i.test(file.name);
  const pdfType = !file.type || file.type === "application/pdf";
  if (!pdfName || !pdfType) return "Choose a PDF file. Other file types are not accepted.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > UPLOAD_LIMITS.maxFileBytes)
    return `This file is larger than ${UPLOAD_LIMITS.maxFileBytes / 1_000_000} MB.`;
  return null;
}

/** Checks the extracted page text. Returns a plain message, or null. */
export function checkPages(pages: string[]): string | null {
  if (!pages.length) return "This PDF has no pages.";
  if (pages.length > UPLOAD_LIMITS.maxPages)
    return `This PDF has ${pages.length} pages. The limit is ${UPLOAD_LIMITS.maxPages}.`;
  const chars = pages.reduce((n, p) => n + p.length, 0);
  const visible = pages.join("").replace(/\s+/g, "").length;
  if (visible < MIN_TEXT_CHARS)
    return "No readable text was found. The PDF looks scanned or empty. Upload a PDF with selectable text.";
  if (chars > UPLOAD_LIMITS.maxChars)
    return `This PDF has ${chars.toLocaleString("en-IN")} characters of text. The limit is ${UPLOAD_LIMITS.maxChars.toLocaleString("en-IN")}.`;
  return null;
}

/** Page marked text for the server function: one "[[PAGE n]]" line before each page. */
export const pageMarkedText = (pages: string[]) =>
  pages.map((p, i) => `[[PAGE ${i + 1}]]\n${p}`).join("\n\n");

export interface UploadInput {
  supplier: { id: string } | { newName: string; category?: string };
  fileName: string;
  title: string;
  documentType: DocumentType;
  signingStatus: SigningStatus;
  pages: string[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const DOC_STATUS: Record<SigningStatus, ContractDocument["status"]> = {
  Signed: "Signed",
  "Unsigned draft": "Draft, unsigned",
  "Received notice": "Received notice",
};

/** Adds an uploaded document (and a new supplier when asked). Its pages become its clauses. */
export function addUploadedDocument(
  ws: WorkflowState,
  actor: Actor,
  input: UploadInput,
): { state: WorkflowState; docId: string; supplierId: string } {
  const problem = checkPages(input.pages);
  if (problem) fail(problem);
  if (!input.title.trim()) fail("Give the document a title.");
  const catalog = catalogFor(ws);
  const u = ws.uploads;
  let supplierId: string;
  let suppliers = u.suppliers;
  if ("id" in input.supplier) {
    const id = input.supplier.id;
    supplierId = catalog.suppliers.find((s) => s.id === id)?.id ?? fail("Choose a supplier.");
  } else {
    const name = input.supplier.newName.trim();
    if (!name) fail("Type the new supplier's name.");
    const existing = catalog.suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) supplierId = existing.id;
    else {
      supplierId = `u-${slug(name) || "supplier"}-${u.nextNo}`;
      const s: Supplier = {
        id: supplierId,
        name,
        category: input.supplier.category?.trim() || "Uploaded supplier",
      };
      suppliers = [...suppliers, s];
    }
  }
  const docId = `UP-${String(u.nextNo).padStart(3, "0")}`;
  const doc: ContractDocument = {
    id: docId,
    supplierId,
    title: input.title.trim(),
    kind: input.documentType,
    status: DOC_STATUS[input.signingStatus],
    signed: input.signingStatus === "Signed",
    dateLine: `Uploaded ${actor.at.slice(0, 10)} from ${input.fileName}. Signing status as declared: ${input.signingStatus}.`,
    effectiveFrom: null,
    clauses: input.pages.map((text, i) => ({ id: `p${i + 1}`, label: `Page ${i + 1}`, text })),
    source: "Live",
    fileName: input.fileName,
    uploadedAt: actor.at,
    uploadedBy: actor.by,
    ...(input.signingStatus === "Signed"
      ? {}
      : {
          note: "Declared as not signed. Terms from this document stay Ignored and cannot be verified.",
        }),
  };
  const next: WorkflowState = {
    ...ws,
    uploads: { ...u, suppliers, documents: [...u.documents, doc], nextNo: u.nextNo + 1 },
  };
  return {
    state: log(next, actor, `${docId} uploaded: ${doc.title}`),
    docId,
    supplierId,
  };
}

const ALL_WORDS =
  /^(all|any|all locations?|all delivery cent(er|re)s?|all cent(er|re)s?|all sites?)$/i;

function normalizeLocation(raw: string | null, centers: string[]): string | null {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim();
  if (ALL_WORDS.test(t)) return "all";
  const hit = centers.find((c) => t.toLowerCase().includes(c.toLowerCase()));
  return hit ?? t;
}

const UNIT_HOUR = /^(per\s+)?(hour|hours|hourly|hr|h)$/i;

/**
 * Turns one accepted live term into a price book term. Values the document does not support
 * stay unknown. A term missing a required field, or not per hour in INR, is Needs review.
 */
export function toLiveTerm(
  c: CheckedTerm,
  ctx: {
    id: string;
    docId: string;
    runId: string;
    signed: boolean;
    roleMap: { grade: string; role: string }[] | null;
    centers: string[];
  },
): SeedTerm {
  const t = c.term;
  const role = t.role?.trim() || null;
  const grade = role ? (ctx.roleMap ? resolveGrade(role, ctx.roleMap) : role) : null;
  const location = normalizeLocation(t.location, ctx.centers);
  const ratePaise =
    t.amount !== null && Number.isFinite(t.amount) ? Math.round(t.amount * 100) : null;
  const currency = t.currency?.trim() || null;
  const unit = t.unit?.trim() || null;
  const iso = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const notes: string[] = [];
  if (role && !grade)
    notes.push(`Role "${role}" does not match exactly one role in this supplier's role map.`);
  if (!location) notes.push("Location not stated.");
  if (currency && currency.toUpperCase() !== "INR" && currency !== "₹")
    notes.push(`Currency stated as ${currency}, not INR.`);
  if (unit && !UNIT_HOUR.test(unit)) notes.push(`Unit stated as ${unit}, not per hour.`);
  if (!iso(t.effective_from)) notes.push("Effective date not stated.");
  if (t.conditions) notes.push(`Conditions: ${t.conditions}`);
  const missing = !grade || !location || ratePaise === null || !iso(t.effective_from);
  const offUnit = notes.some((n) => n.startsWith("Currency") || n.startsWith("Unit"));
  return {
    id: ctx.id,
    kind: "rate",
    title: `${role ?? "Unknown role"} rate${location && location !== "all" ? `, ${location}` : ""}`,
    docId: ctx.docId,
    clauseId: `p${t.page}`,
    quote: t.quote,
    grade,
    location,
    ratePaise,
    effectiveFrom: iso(t.effective_from),
    effectiveTo: iso(t.effective_to),
    initialStatus: !ctx.signed ? "Ignored" : missing || offUnit ? "Needs review" : "Proposed",
    source: "Live",
    unit,
    currency,
    runId: ctx.runId,
    ...(notes.length ? { note: notes.join(" ") } : {}),
  };
}

/**
 * Records a finished live run. On success, accepted terms join the price book as Proposed or
 * Needs review (never Verified) and saved checks recompute. On failure only the run is added.
 */
export function applyExtraction(
  ws: WorkflowState,
  actor: Actor,
  docId: string,
  res: ExtractResponse,
): { state: WorkflowState; runId: string } {
  const catalog = catalogFor(ws);
  const doc =
    ws.uploads.documents.find((d) => d.id === docId) ??
    fail("Only uploaded documents use live extraction.");
  const u = ws.uploads;
  const runId = `RUN-${String(u.nextNo).padStart(3, "0")}`;
  if (!res.ok) {
    const run: ExtractionRun = {
      id: runId,
      docId,
      source: "Live",
      status: "Failed",
      at: actor.at,
      by: actor.by,
      termIds: [],
      accepted: 0,
      rejected: 0,
      rejections: [],
      code: res.code,
      message: res.message,
    };
    const next = { ...ws, uploads: { ...u, runs: [...u.runs, run], nextNo: u.nextNo + 1 } };
    return { state: log(next, actor, `${runId} on ${docId} failed: ${res.message}`), runId };
  }
  if (u.runs.some((r) => r.docId === docId && r.status === "Completed"))
    fail("This document already has a completed extraction.");
  const supplier = doc.supplierId;
  const ownMap = ROLE_MAPS[supplier] ?? null;
  const centers = catalog.deliveryCenters[supplier] ?? [];
  const accepted = res.terms.filter((c) => c.accepted);
  let n = u.nextNo + 1;
  const terms = accepted.map((c) =>
    toLiveTerm(c, {
      id: `LT${String(n++).padStart(3, "0")}`,
      docId,
      runId,
      signed: doc.signed,
      roleMap: ownMap,
      centers,
    }),
  );
  const rejections = res.terms
    .filter((c) => !c.accepted)
    .map((c) => `${c.term.role ?? "Unknown role"}: ${c.problems.join("; ")}`);
  const run: ExtractionRun = {
    id: runId,
    docId,
    source: "Live",
    status: "Completed",
    at: actor.at,
    by: actor.by,
    termIds: terms.map((t) => t.id),
    accepted: terms.length,
    rejected: res.terms.length - accepted.length,
    rejections,
  };
  const states = { ...ws.terms };
  for (const t of terms) states[t.id] = { status: t.initialStatus, history: [] };
  let next: WorkflowState = {
    ...ws,
    terms: states,
    uploads: { ...u, terms: [...u.terms, ...terms], runs: [...u.runs, run], nextNo: n },
  };
  next = log(
    next,
    actor,
    `${runId} on ${docId} completed: ${terms.length} terms proposed, ${run.rejected} rejected`,
  );
  return { state: recompute(next, actor, `live extraction of ${docId}`), runId };
}
