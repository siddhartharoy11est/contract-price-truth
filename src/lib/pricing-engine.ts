/**
 * Pricing engine. Pure, deterministic, no UI code and no AI.
 * AI proposes terms; this module selects the governing rate and does all arithmetic.
 */
import type { Conflict, EngineTerm, Grade, InvoiceLine, Location, Reading } from "@/data/types";
import { amountFor, formatINR, type Paise } from "./money";
import { daysBetween, formatDate, formatPeriod, isIsoDate } from "./dates";

export type ResultStatus =
  | "Match"
  | "Potential discrepancy"
  | "Billed below contract"
  | "Awaiting verification"
  | "Needs information"
  | "Needs Legal"
  | "Invalid input";

export type Verdict = "Match" | "Potential discrepancy" | "Billed below contract";

export interface Outcome {
  label: string;
  ratePaise: Paise;
  expectedPaise: Paise;
  differencePaise: Paise;
  verdict: Verdict;
  termId: string;
  verified: boolean;
}

export interface PriceResult {
  status: ResultStatus;
  grade: Grade | null;
  applicableRatePaise: Paise | null;
  expectedPaise: Paise | null;
  billedPaise: Paise | null;
  differencePaise: Paise | null;
  governingTermId: string | null;
  citedTermIds: string[];
  explanation: string[];
  need?: { kind: "location" | "split" | "grade" | "no-rate"; question: string } | undefined;
  outcomes?: Outcome[] | undefined;
  poNote?: string | undefined;
  errors?: string[] | undefined;
  conflictId?: string | undefined;
  rulingApplied?: Reading | undefined;
}

export interface EngineContext {
  terms: EngineTerm[];
  conflicts: Conflict[];
  rulings: Partial<Record<string, Reading>>;
}

export const SCHEDULE_A_GRADES: { grade: Grade; role: string }[] = [
  { grade: "L4", role: "Senior Software Engineer" },
  { grade: "L3", role: "Software Engineer" },
  { grade: "L2", role: "QA Analyst" },
];

export const PO_AGREES_NOTE =
  "The invoice agrees with its purchase order, so a two-way match would pass. The contract says otherwise.";

/** Maps grade text to exactly one Schedule A grade, or null. Never inferred from a rate. */
export function resolveGrade(text: string): Grade | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  for (const { grade, role } of SCHEDULE_A_GRADES) {
    const g = grade.toLowerCase();
    const r = role.toLowerCase();
    const aliases = [g, `grade ${g}`, r, `${r} ${g}`, `${r} (${g})`, `${r} (grade ${g})`, `${r}, ${g}`];
    if (aliases.includes(t)) return grade;
  }
  return null;
}

const empty = (grade: Grade | null): Omit<PriceResult, "status" | "explanation"> => ({
  grade,
  applicableRatePaise: null,
  expectedPaise: null,
  billedPaise: null,
  differencePaise: null,
  governingTermId: null,
  citedTermIds: [],
});

function cite(t: EngineTerm): string {
  return `${t.id} (${t.docId} ${t.clauseId})`;
}

/** Latest effective term wins; on a tie, a location-specific term beats a general one. */
export function selectGoverning(
  terms: EngineTerm[],
  date: string,
  location: Location | "" | "general-only",
): EngineTerm | null {
  const applicable = terms.filter((t) => {
    if (!t.effectiveFrom || t.effectiveFrom > date) return false;
    if (t.location === "all") return true;
    if (location === "" || location === "general-only") return false;
    return t.location === location;
  });
  applicable.sort((a, b) => {
    if (a.effectiveFrom !== b.effectiveFrom) return a.effectiveFrom! < b.effectiveFrom! ? 1 : -1;
    const aSpecific = a.location !== "all" ? 1 : 0;
    const bSpecific = b.location !== "all" ? 1 : 0;
    return bSpecific - aSpecific;
  });
  return applicable[0] ?? null;
}

function verdictFor(differencePaise: Paise): Verdict {
  if (differencePaise > 0) return "Potential discrepancy";
  if (differencePaise < 0) return "Billed below contract";
  return "Match";
}

function outcome(label: string, term: EngineTerm, ratePaise: Paise, line: InvoiceLine): Outcome {
  const expectedPaise = amountFor(line.hours, ratePaise);
  const billedPaise = amountFor(line.hours, line.billedRatePaise);
  const differencePaise = billedPaise - expectedPaise;
  return {
    label,
    ratePaise,
    expectedPaise,
    differencePaise,
    verdict: verdictFor(differencePaise),
    termId: term.id,
    verified: term.status === "Verified",
  };
}

export function describeOutcome(o: Outcome): string {
  if (o.verdict === "Potential discrepancy") return `potential excess ${formatINR(o.differencePaise)}`;
  if (o.verdict === "Billed below contract") return `billed below contract by ${formatINR(-o.differencePaise)}`;
  return "Match";
}

function validate(line: InvoiceLine): string[] {
  const errors: string[] = [];
  if (!isIsoDate(line.serviceStart)) errors.push("Enter a valid service start date.");
  if (!isIsoDate(line.serviceEnd)) errors.push("Enter a valid service end date.");
  if (errors.length === 0 && line.serviceEnd < line.serviceStart)
    errors.push("The service end date is before the start date.");
  if (!Number.isFinite(line.hours) || line.hours <= 0) errors.push("Hours must be more than zero.");
  if (!Number.isInteger(line.billedRatePaise) || line.billedRatePaise <= 0)
    errors.push("Billed rate must be more than zero.");
  if (line.poRatePaise !== null && (!Number.isInteger(line.poRatePaise) || line.poRatePaise <= 0))
    errors.push("PO rate must be more than zero, or left empty.");
  if (!line.grade.trim()) errors.push("Enter a grade.");
  return errors;
}

export function evaluateLine(line: InvoiceLine, ctx: EngineContext): PriceResult {
  const errors = validate(line);
  if (errors.length) {
    return { ...empty(null), status: "Invalid input", errors, explanation: errors };
  }

  // Rule 7: grade must map to exactly one Schedule A grade.
  const grade = resolveGrade(line.grade);
  if (!grade) {
    return {
      ...empty(null),
      status: "Needs information",
      need: {
        kind: "grade",
        question: `Which Schedule A grade is "${line.grade.trim()}"? It does not map to exactly one of L4, L3 or L2.`,
      },
      explanation: [
        `The grade "${line.grade.trim()}" does not match exactly one Schedule A grade (Senior Software Engineer L4, Software Engineer L3, QA Analyst L2).`,
        "The grade is never inferred from the billed rate. Confirm the grade to get a price.",
      ],
    };
  }

  // Rule 1: signed documents only. Drafts and Ignored terms never count.
  const usable = ctx.terms.filter((t) => t.signed && t.status !== "Ignored" && t.kind !== "draft");
  const rateTerms = usable.filter(
    (t) => t.kind === "rate" && t.grade === grade && t.ratePaise !== null && t.effectiveFrom,
  );
  const noticeTerms = usable.filter(
    (t) => t.kind === "notice" && t.grade === grade && t.ratePaise !== null && t.effectiveFrom,
  );

  // Rule 6: the service period must not span an effective date.
  const relevant = [...rateTerms, ...noticeTerms].filter(
    (t) => !line.location || t.location === "all" || t.location === line.location,
  );
  const crossing = relevant
    .filter((t) => t.effectiveFrom! > line.serviceStart && t.effectiveFrom! <= line.serviceEnd)
    .sort((a, b) => (a.effectiveFrom! < b.effectiveFrom! ? -1 : 1));
  if (crossing.length) {
    const first = crossing[0]!;
    return {
      ...empty(grade),
      status: "Needs information",
      citedTermIds: crossing.map((t) => t.id),
      need: {
        kind: "split",
        question: `Split this line by date: hours before ${formatDate(first.effectiveFrom!)} and hours from ${formatDate(first.effectiveFrom!)}.`,
      },
      explanation: [
        `The service period ${formatPeriod(line.serviceStart, line.serviceEnd)} spans ${formatDate(first.effectiveFrom!)}, when ${cite(first)} takes effect.`,
        "Different rates apply on either side of that date, so one rate cannot be applied to the whole line.",
      ],
    };
  }

  const date = line.serviceStart;

  // Rule 5: location missing and the rate depends on location.
  if (!line.location) {
    const general = selectGoverning(rateTerms, date, "general-only");
    const specificLocations = Array.from(
      new Set(
        rateTerms
          .filter((t) => t.location !== "all" && t.effectiveFrom! <= date)
          .map((t) => t.location as Location),
      ),
    );
    const differing = specificLocations
      .map((loc) => ({ loc, term: selectGoverning(rateTerms, date, loc) }))
      .filter((x) => x.term && x.term.id !== general?.id);
    if (differing.length) {
      const outcomes: Outcome[] = differing.map((x) =>
        outcome(`If ${x.loc}`, x.term!, x.term!.ratePaise!, line),
      );
      if (general) outcomes.push(outcome("If another center", general, general.ratePaise!, line));
      return {
        ...empty(grade),
        status: "Needs information",
        citedTermIds: outcomes.map((o) => o.termId),
        outcomes,
        need: { kind: "location", question: "Which delivery center delivered this work?" },
        explanation: [
          "The invoice line does not state a delivery center, and the contract rate depends on it.",
          outcomes.map((o) => `${o.label}: ${formatINR(o.ratePaise)} per hour.`).join(" "),
        ],
      };
    }
  }

  const governing = selectGoverning(rateTerms, date, line.location);
  if (!governing) {
    return {
      ...empty(grade),
      status: "Needs information",
      need: { kind: "no-rate", question: "No signed rate covers this grade on this date. Check the service dates." },
      explanation: [`No signed rate for ${grade} is in effect on ${formatDate(date)}.`],
    };
  }

  // Rule 4: the governing term must be Verified.
  if (governing.status !== "Verified") {
    return {
      ...empty(grade),
      status: "Awaiting verification",
      governingTermId: governing.id,
      citedTermIds: [governing.id],
      explanation: [
        `The governing price is ${cite(governing)}, which is ${governing.status} and not yet verified by Procurement.`,
        "No amounts or verdict are shown until a person verifies it.",
      ],
    };
  }

  const explanation: string[] = [
    `${cite(governing)} sets ${formatINR(governing.ratePaise!)} per hour for ${grade}${
      governing.location === "all" ? " at all delivery centers" : ` at ${governing.location}`
    } from ${formatDate(governing.effectiveFrom!)}.`,
  ];
  if (governing.replaces) explanation.push(`It replaces ${governing.replaces} for these conditions.`);
  if (!line.location) explanation.push("The rate does not depend on delivery center, so none is needed.");

  // Rule 9: an annual increase is considered only if a supplier notice covers this grade.
  const notice = noticeTerms
    .filter(
      (t) =>
        t.effectiveFrom! <= date &&
        t.effectiveFrom! > governing.effectiveFrom! &&
        (t.location === "all" || !line.location || t.location === line.location),
    )
    .sort((a, b) => (a.effectiveFrom! < b.effectiveFrom! ? 1 : -1))[0];

  let ratePaise = governing.ratePaise!;
  let rateTerm = governing;
  const cited = [governing.id];
  let rulingApplied: Reading | undefined;

  if (notice) {
    const conflict = ctx.conflicts.find((c) => c.id === notice.conflictId);
    const ruling = notice.conflictId ? ctx.rulings[notice.conflictId] : undefined;
    const readingA = conflict?.readings[0];
    const readingB = conflict?.readings[1];
    const capPaise = Math.floor((governing.ratePaise! * 103) / 100);
    const noticeDays = notice.noticeDate ? daysBetween(notice.noticeDate, notice.effectiveFrom!) : null;
    const noticeFacts = [
      `Supplier notice ${cite(notice)} states ${formatINR(notice.ratePaise!)} per hour from ${formatDate(notice.effectiveFrom!)}.`,
      noticeDays !== null
        ? `Notice was given ${noticeDays} days before the effective date (60 required). The 3% cap on ${formatINR(governing.ratePaise!)} is ${formatINR(capPaise)}. The stated CPI is not independently verified.`
        : "",
    ].filter(Boolean);

    if (!ruling) {
      const outcomes = [
        outcome(`If Reading A (rates fixed)`, governing, governing.ratePaise!, line),
        outcome(`If Reading B (increase applies)`, notice, notice.ratePaise!, line),
      ];
      return {
        ...empty(grade),
        status: "Needs Legal",
        governingTermId: governing.id,
        citedTermIds: [governing.id, ...(conflict?.termIds ?? [notice.id])],
        outcomes,
        conflictId: notice.conflictId,
        explanation: [
          ...explanation,
          ...noticeFacts,
          `The contract does not establish one price: ${conflict?.question ?? "an open clause conflict applies."}`,
          outcomes.map((o) => `${o.label}: ${describeOutcome(o)}.`).join(" "),
          "Only a Legal ruling can resolve this. A maximum of 3% is never applied automatically.",
        ],
      };
    }

    rulingApplied = ruling;
    if (ruling === "A") {
      cited.push(...(readingA?.termIds ?? []));
      explanation.push(
        ...noticeFacts,
        "Legal ruled Reading A: rates are fixed for the Initial Term, so the notice does not change the price.",
      );
    } else {
      if (notice.status !== "Verified") {
        return {
          ...empty(grade),
          status: "Awaiting verification",
          governingTermId: notice.id,
          citedTermIds: [notice.id],
          conflictId: notice.conflictId,
          rulingApplied: ruling,
          explanation: [
            `Legal ruled Reading B, so ${cite(notice)} governs, but it is ${notice.status} and not yet verified.`,
            "No amounts or verdict are shown until a person verifies it.",
          ],
        };
      }
      ratePaise = notice.ratePaise!;
      rateTerm = notice;
      cited.splice(0, cited.length, notice.id, ...(readingB?.termIds ?? []).filter((id) => id !== notice.id), governing.id);
      explanation.push(
        ...noticeFacts,
        `Legal ruled Reading B: the annual adjustment applies, so the rate is ${formatINR(ratePaise)} per hour.`,
      );
    }
  }

  // Rule 8: arithmetic.
  const expectedPaise = amountFor(line.hours, ratePaise);
  const billedPaise = amountFor(line.hours, line.billedRatePaise);
  const differencePaise = billedPaise - expectedPaise;
  const status = verdictFor(differencePaise);

  explanation.push(
    `Expected ${line.hours} h x ${formatINR(ratePaise)} = ${formatINR(expectedPaise)}. Billed ${line.hours} h x ${formatINR(line.billedRatePaise)} = ${formatINR(billedPaise)}.`,
  );
  if (status === "Potential discrepancy")
    explanation.push(`The invoice is ${formatINR(differencePaise)} above the contract price. This is a potential excess, not a confirmed one.`);
  if (status === "Billed below contract")
    explanation.push(`The invoice is ${formatINR(-differencePaise)} below the contract price. Shown for information only.`);
  if (status === "Match") explanation.push("The billed rate matches the verified contract rate.");

  // Rule 10: PO agrees with the invoice but the contract says otherwise.
  const poNote =
    status === "Potential discrepancy" && line.poRatePaise !== null && line.poRatePaise === line.billedRatePaise
      ? PO_AGREES_NOTE
      : undefined;

  return {
    status,
    grade,
    applicableRatePaise: ratePaise,
    expectedPaise,
    billedPaise,
    differencePaise,
    governingTermId: rateTerm.id,
    citedTermIds: Array.from(new Set(cited)),
    explanation,
    poNote,
    conflictId: notice?.conflictId,
    rulingApplied,
  };
}
