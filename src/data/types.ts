/** A role or grade code from a supplier's price book, for example "L4". Supplier specific. */
export type Grade = string;
/** A delivery center name, for example "Bengaluru". Supplier specific. */
export type Location = string;
export type TermStatus = "Proposed" | "Verified" | "Needs review" | "Ignored";
export type TermKind = "rate" | "clause" | "notice" | "draft";
export type RoleId = "procurement" | "finance" | "legal";
export type Reading = "A" | "B";

export interface Clause {
  id: string;
  label: string;
  text: string;
}

export interface ContractDocument {
  id: string;
  supplierId: string;
  title: string;
  kind: string;
  status: "Signed" | "Draft, unsigned" | "Received notice";
  /** Declared signing status. Not cryptographically checked. */
  signed: boolean;
  dateLine: string;
  effectiveFrom: string | null;
  clauses: Clause[];
  note?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  /** Known delivery centers. Empty when the supplier has no price book. */
  deliveryCenters?: Location[];
  /** Stub suppliers have titles only, no extracted terms. */
  stubDocuments?: string[];
}

export interface SeedTerm {
  id: string;
  kind: TermKind;
  title: string;
  docId: string;
  clauseId: string;
  quote: string;
  grade: Grade | null;
  location: Location | "all" | null;
  ratePaise: number | null;
  effectiveFrom: string | null;
  /** Inclusive last day. Null or absent means open ended. */
  effectiveTo?: string | null;
  /** Override link: the term this term overrides within its own role, location and dates. */
  replaces?: string;
  /** Clause parameters, for an annual adjustment clause. */
  capPct?: number;
  noticeDaysRequired?: number;
  initialStatus: TermStatus;
  conflictId?: string;
  noticeDate?: string;
  statedCpiPct?: number;
  note?: string;
}

export interface ConflictReading {
  reading: Reading;
  summary: string;
  detail: string;
  termIds: string[];
}

export interface Conflict {
  id: string;
  question: string;
  termIds: string[];
  readings: [ConflictReading, ConflictReading];
}

/** The shape the pricing engine consumes: seed term plus current review state. */
export interface EngineTerm extends SeedTerm {
  status: TermStatus;
  signed: boolean;
  /** Supplier of the term's document. Defaults to the demo supplier when absent. */
  supplierId?: string | undefined;
  /** Whether the override link in `replaces` is Verified. */
  overrideVerified?: boolean | undefined;
}

/** One row in a supplier's role map. Aliases are matched exactly after normalising case and spaces. */
export interface RoleMapEntry {
  grade: Grade;
  role: string;
  aliases?: string[];
}

/** Invoice line location value meaning "Other or not listed". */
export const OTHER_LOCATION = "Other or not listed";

export interface InvoiceLine {
  /** Defaults to the demo supplier when absent. */
  supplierId?: string;
  grade: string;
  /** "" means not stated. OTHER_LOCATION means a center not in the price book. */
  location: Location | "";
  serviceStart: string;
  serviceEnd: string;
  hours: number;
  billedRatePaise: number;
  poRatePaise: number | null;
}
