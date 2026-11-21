/**
 * Evidence rules from PRD 6.5. Pure text checks: a value and a quote agree textually.
 * They cannot confirm the meaning is right; that remains check 1 of the human review.
 */
import { docById, ROLE_MAPS } from "@/data/seed";
import type { EditableField, FieldValue } from "./term-state";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();

/** Rule 2: a quote must be an exact substring of the document text after whitespace normalization. */
export function quoteInDocument(docId: string, quote: string): boolean {
  const q = normalizeWs(quote);
  if (!q) return false;
  const doc = docById(docId);
  if (!doc) return false;
  return (
    doc.clauses.some((c) => normalizeWs(c.text).includes(q)) ||
    normalizeWs(doc.dateLine).includes(q)
  );
}

function numbersIn(text: string): string[] {
  const cleaned = text.replace(/₹|\bRs\.?|\bINR\b/gi, " ").replace(/(\d),(?=\d)/g, "$1");
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

function dateForms(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const month = MONTHS[m - 1]!;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return [
    iso,
    `${d} ${month} ${y}`,
    `${d} ${month.slice(0, 3)} ${y}`,
    `${month} ${d}, ${y}`,
    `${dd}/${mm}/${y}`,
    `${d}/${m}/${y}`,
    `${dd}.${mm}.${y}`,
  ];
}

/**
 * Rule 3: whether a corrected value appears in one of the quotes. "all" for a location needs
 * the reviewer's explicit confirmation instead.
 */
export function valueSupported(
  field: EditableField,
  value: FieldValue,
  quotes: string[],
  opts: { supplierId?: string; allLocationsConfirmed?: boolean } = {},
): boolean {
  const texts = quotes.map((q) => normalizeWs(q).toLowerCase()).filter(Boolean);
  if (!texts.length || value === null || value === "") return false;
  if (field === "ratePaise") {
    const paise = Number(value);
    const rupees = paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
    return texts.some((t) => numbersIn(t).some((n) => Number(n) === Number(rupees)));
  }
  if (field === "location" && value === "all") return opts.allLocationsConfirmed === true;
  if (field === "grade") {
    const entry = ROLE_MAPS[opts.supplierId ?? "brighthire"]?.find((r) => r.grade === value);
    const names = [String(value), ...(entry ? [entry.role, ...(entry.aliases ?? [])] : [])];
    return texts.some((t) => names.some((n) => t.includes(n.toLowerCase())));
  }
  if (field === "effectiveFrom" || field === "effectiveTo") {
    const forms = dateForms(String(value)).map((f) => f.toLowerCase());
    return texts.some((t) => forms.some((f) => t.includes(f)));
  }
  return texts.some((t) => t.includes(String(value).toLowerCase()));
}
