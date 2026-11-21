export type Grade = "L4" | "L3" | "L2";
export type Location = "Bengaluru" | "Pune" | "Hyderabad";
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
  status: "Signed" | "Draft, unsigned" | "Letter on file";
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
  replaces?: string;
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
}

export interface InvoiceLine {
  grade: string;
  location: Location | "";
  serviceStart: string;
  serviceEnd: string;
  hours: number;
  billedRatePaise: number;
  poRatePaise: number | null;
}
