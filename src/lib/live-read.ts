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
