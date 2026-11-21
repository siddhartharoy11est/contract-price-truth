/** Validates and compares a live AI read against the stored extraction. Pure. */
import { z } from "zod";
import { TERMS } from "@/data/seed";
import type { SeedTerm } from "@/data/types";
import { parseRupees } from "./money";

export const liveTermSchema = z.object({
  grade: z.string().nullable(),
  role: z.string().nullable().optional(),
  location: z.string().nullable(),
  rate_inr_per_hour: z.union([z.number(), z.string()]).nullable(),
  effective_date: z.string().nullable(),
  clause: z.string().nullable(),
  quote: z.string().min(1),
});
export const liveResponseSchema = z.object({ terms: z.array(liveTermSchema) });
export type LiveTerm = z.infer<typeof liveTermSchema>;

export type LiveVerdict = "Agrees" | "Differs" | "Extra";

export interface LiveComparison {
  live: LiveTerm;
  verdict: LiveVerdict;
  storedTermId: string | null;
  differences: string[];
}

export interface LiveReadOutcome {
  comparisons: LiveComparison[];
  rejected: { live: unknown; reason: string }[];
  missedStoredIds: string[];
  differingStoredIds: string[];
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The response did not contain a JSON object.");
  return JSON.parse(body.slice(start, end + 1));
}

const norm = (s: string) =>
  s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, " ").trim();

export function quoteAppears(quote: string, docText: string): boolean {
  const q = norm(quote).replace(/^["']|["']$/g, "");
  return q.length >= 8 && norm(docText).includes(q);
}

const LIGATURES: Record<string, string> = {
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
  "ﬅ": "st",
  "ﬆ": "st",
};

/** Normalization for PDF text: ligatures, NFKC, curly quotes, dash variants, soft hyphens, whitespace. */
export function normalizePdfText(s: string): string {
  return norm(
    s
      .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
      .normalize("NFKC")
      .replace(/­/g, "")
      .replace(/[‐-―−]/g, "-"),
  );
}

export type PageQuoteCheck = { ok: true } | { ok: false; reason: string };

/**
 * Checks that a quote is an exact substring of the text of the page it cites (1-indexed),
 * after normalizing whitespace and ligatures.
 */
export function quoteOnPage(
  quote: string | null | undefined,
  page: number | null | undefined,
  pages: string[],
  /** The term's main quote. A short numeric quote is allowed only when it appears inside it. */
  mainQuote?: string,
): PageQuoteCheck {
  if (!quote || !quote.trim()) return { ok: false, reason: "empty quote" };
  if (!page || !Number.isInteger(page) || page < 1 || page > pages.length)
    return { ok: false, reason: `cited page ${page ?? "null"} does not exist` };
  const q = normalizePdfText(quote).replace(/^["']|["']$/g, "");
  if (q.length < 8) {
    const numeric = /^[\d.,\s₹$]+$/.test(q) && /\d/.test(q);
    if (!numeric) return { ok: false, reason: "quote shorter than 8 characters" };
    if (!mainQuote || !normalizePdfText(mainQuote).includes(q))
      return { ok: false, reason: "short numeric quote is not inside the term's main quote" };
    if (!normalizePdfText(pages[page - 1]!).includes(q))
      return { ok: false, reason: "short numeric quote not found on the cited page" };
    return { ok: true };
  }
  if (normalizePdfText(pages[page - 1]!).includes(q)) return { ok: true };
  const elsewhere = pages.findIndex((p) => normalizePdfText(p).includes(q));
  return {
    ok: false,
    reason: elsewhere >= 0 ? `quote is on page ${elsewhere + 1}, not page ${page}` : "quote not found in the document",
  };
}

const normGrade = (g: string | null) => {
  if (!g) return null;
  const m = g.toUpperCase().match(/L[234]/);
  return m ? m[0] : null;
};
const normLocation = (l: string | null) => {
  if (!l) return "all";
  const t = l.trim().toLowerCase();
  if (["all", "any", "all centers", "all delivery centers", "any delivery center"].includes(t)) return "all";
  for (const c of ["Bengaluru", "Pune", "Hyderabad"]) if (t.includes(c.toLowerCase())) return c;
  return l.trim();
};
const normClause = (c: string | null) =>
  (c ?? "").toLowerCase().replace(/clause|section|schedule a|amendment 1|[\s.:]/g, "").replace(/^row/, "row");
const ratePaiseOf = (r: number | string | null) =>
  r === null ? null : typeof r === "number" ? Math.round(r * 100) : parseRupees(r);

/** Stored price-bearing terms for this document that a live read can be compared with. */
export function comparableStored(docId: string): SeedTerm[] {
  return TERMS.filter((t) => t.docId === docId && (t.kind === "rate" || t.kind === "notice"));
}

export function compareLiveRead(docId: string, docText: string, raw: unknown): LiveReadOutcome {
  const rejected: LiveReadOutcome["rejected"] = [];
  const shape = liveResponseSchema.safeParse(raw);
  if (!shape.success) {
    return {
      comparisons: [],
      rejected: [{ live: raw, reason: "The response did not match the required JSON shape." }],
      missedStoredIds: comparableStored(docId).map((t) => t.id),
      differingStoredIds: [],
    };
  }
  const stored = comparableStored(docId);
  const comparisons: LiveComparison[] = [];
  const matched = new Set<string>();

  for (const live of shape.data.terms) {
    if (!quoteAppears(live.quote, docText)) {
      rejected.push({ live, reason: "Quote does not appear in the document text." });
      continue;
    }
    const g = normGrade(live.grade);
    const loc = normLocation(live.location);
    const byClause = stored.find((t) => !matched.has(t.id) && normClause(t.clauseId) === normClause(live.clause));
    const byKey = stored.find((t) => !matched.has(t.id) && t.grade === g && t.location === loc);
    const match = byClause ?? byKey;
    if (!match) {
      comparisons.push({ live, verdict: "Extra", storedTermId: null, differences: [] });
      continue;
    }
    matched.add(match.id);
    const diffs: string[] = [];
    if (g !== match.grade) diffs.push(`grade ${g ?? "null"} vs ${match.grade}`);
    if (loc !== match.location) diffs.push(`location ${loc} vs ${match.location}`);
    const rp = ratePaiseOf(live.rate_inr_per_hour);
    if (rp !== match.ratePaise) diffs.push(`rate ${rp === null ? "null" : rp / 100} vs ${match.ratePaise! / 100}`);
    if (live.effective_date && live.effective_date !== match.effectiveFrom)
      diffs.push(`effective date ${live.effective_date} vs ${match.effectiveFrom}`);
    comparisons.push({
      live,
      verdict: diffs.length ? "Differs" : "Agrees",
      storedTermId: match.id,
      differences: diffs,
    });
  }

  return {
    comparisons,
    rejected,
    missedStoredIds: stored.filter((t) => !matched.has(t.id) && t.initialStatus !== "Ignored").map((t) => t.id),
    differingStoredIds: comparisons.filter((c) => c.verdict === "Differs" && c.storedTermId).map((c) => c.storedTermId!),
  };
}

// ---------- client side field evidence ----------

export type FieldName =
  | "role"
  | "location"
  | "unit"
  | "amount"
  | "currency"
  | "effective_from"
  | "effective_to"
  | "conditions"
  | "clause_reference";

/** Where a field value was found: in the term's quote, elsewhere on the cited page, on a scope page, or not at all. */
export type FieldLocation = "quote" | "page" | "scope page" | null;

export interface FieldEvidence {
  field: FieldName;
  value: string;
  located: FieldLocation;
  /** The exact matched text, when located. */
  match: string | null;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Candidate patterns that a field value may appear as in contract text. */
function patternsFor(field: FieldName, value: string): RegExp[] {
  const v = value.trim();
  if (field === "amount") {
    const n = Number(v);
    if (!Number.isFinite(n)) return [];
    const [int, frac] = String(n).split(".");
    const grouped = (s: string, indian: boolean) => {
      if (s.length <= 3) return s;
      if (!indian) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const last = s.slice(-3);
      return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last}`;
    };
    const fracRe = frac ? `\\.${frac}0*` : "(?:\\.0+)?";
    return [...new Set([int!, grouped(int!, false), grouped(int!, true)])].map(
      (s) => new RegExp(`(?<![\\d.,])${escapeRe(s)}${fracRe}(?![\\d,]\\d)`),
    );
  }
  if (field === "effective_from" || field === "effective_to") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return [new RegExp(escapeRe(v), "i")];
    const [, y, mo, d] = m;
    const day = String(Number(d));
    const month = MONTH_NAMES[Number(mo) - 1]!;
    const mon = month.slice(0, 3);
    const ord = `${day}(?:st|nd|rd|th)?`;
    return [
      new RegExp(`${y}-${mo}-${d}`),
      new RegExp(`\\b0?${ord}\\s+(?:${month}|${mon}\\.?)\\s*,?\\s+${y}`, "i"),
      new RegExp(`(?:${month}|${mon}\\.?)\\s+0?${ord},?\\s+${y}`, "i"),
      new RegExp(`\\b0?${day}[/.]0?${Number(mo)}[/.]${y}`),
    ];
  }
  if (field === "currency") {
    const map: Record<string, string[]> = {
      INR: ["INR", "₹", "Rs\\.?", "rupees?"],
      USD: ["USD", "US\\$", "\\$", "US dollars?", "dollars?"],
    };
    const alts = map[v.toUpperCase()] ?? [escapeRe(v)];
    return alts.map((a) => new RegExp(a.startsWith("\\$") || a === "₹" ? a : `\\b${a}\\b`, "i"));
  }
  if (field === "unit") {
    const map: Record<string, string> = {
      hour: "hours?|hourly|hr\\b|/h\\b",
      day: "days?|daily",
      month: "months?|monthly",
      week: "weeks?|weekly",
    };
    const key = v.toLowerCase().replace(/^per\s+/, "").replace(/s$/, "");
    return [new RegExp(`\\b(?:${map[key] ?? escapeRe(v)})`, "i")];
  }
  if (field === "location" && v.toLowerCase() === "all") {
    return [
      /\ball\s+(?:of\s+the\s+)?(?:[A-Za-z]+\s+){0,2}(?:locations?|sites?|delivery\s+cent(?:er|re)s?|cent(?:er|re)s?|offices?)\b/i,
      /\bany\s+(?:[A-Za-z]+\s+){0,2}(?:location|site|delivery\s+cent(?:er|re)|cent(?:er|re))\b/i,
      /\bregardless\s+of\s+(?:location|site|delivery\s+cent(?:er|re))/i,
    ];
  }
  return [new RegExp(escapeRe(normalizePdfText(v)), "i")];
}

function findIn(text: string, patterns: RegExp[]): string | null {
  const t = normalizePdfText(text);
  for (const p of patterns) {
    const m = t.match(p);
    if (m) return m[0];
  }
  return null;
}

/**
 * Derives per field evidence for one extracted term by locating each non null field value
 * in the term's quote, then on the cited page, then on the scope page the model cited.
 * Fields that cannot be located are returned with `located: null`, never guessed.
 */
export function deriveEvidence(
  fields: Partial<Record<FieldName, string | number | null>>,
  quote: string,
  page: number | null,
  pages: string[],
  scopePage?: number | null,
): FieldEvidence[] {
  const pageText = page && page >= 1 && page <= pages.length ? pages[page - 1]! : "";
  const scopeText = scopePage && scopePage >= 1 && scopePage <= pages.length ? pages[scopePage - 1]! : "";
  const out: FieldEvidence[] = [];
  for (const [field, raw] of Object.entries(fields) as [FieldName, string | number | null][]) {
    if (raw === null || raw === undefined || raw === "") continue;
    const value = String(raw);
    const pats = patternsFor(field, value);
    let match = findIn(quote, pats);
    let located: FieldLocation = match ? "quote" : null;
    if (!match && pageText) {
      match = findIn(pageText, pats);
      if (match) located = "page";
    }
    if (!match && scopeText) {
      match = findIn(scopeText, pats);
      if (match) located = "scope page";
    }
    out.push({ field, value, located, match });
  }
  return out;
}
