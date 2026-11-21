/**
 * The catalog: seed suppliers, documents and terms plus anything the visitor uploaded.
 * Pure. Uploads live in the workflow state (and so only in localStorage), never in the seed.
 */
import { DOCUMENTS, ROLE_MAPS, SUPPLIERS, TERMS } from "@/data/seed";
import type {
  ContractDocument,
  ExtractionSource,
  RoleMapEntry,
  SeedTerm,
  Supplier,
} from "@/data/types";

export type RunStatus = "Completed" | "Failed";

/** One extraction run. Stored runs belong to the seed. Live runs are recorded when they finish. */
export interface ExtractionRun {
  id: string;
  docId: string;
  source: ExtractionSource;
  status: RunStatus;
  at: string;
  by: string;
  /** Terms created by this run (accepted quotes only). */
  termIds: string[];
  accepted: number;
  rejected: number;
  /** Reasons for each rejected item, for the run summary. */
  rejections: string[];
  code?: string;
  message?: string;
}

export interface Uploads {
  suppliers: Supplier[];
  documents: ContractDocument[];
  terms: SeedTerm[];
  runs: ExtractionRun[];
  nextNo: number;
}

export const emptyUploads = (): Uploads => ({
  suppliers: [],
  documents: [],
  terms: [],
  runs: [],
  nextNo: 1,
});

export interface Catalog {
  suppliers: Supplier[];
  documents: ContractDocument[];
  terms: SeedTerm[];
  roleMaps: Record<string, RoleMapEntry[]>;
  deliveryCenters: Record<string, string[]>;
}

/** Edited grade or location of a term, when the caller has review state. */
type Edits = Record<string, { edits?: Partial<Record<string, unknown>> } | undefined>;

const SEED_CATALOG: Catalog = {
  suppliers: SUPPLIERS,
  documents: DOCUMENTS,
  terms: TERMS,
  roleMaps: ROLE_MAPS,
  deliveryCenters: Object.fromEntries(
    SUPPLIERS.filter((x) => x.deliveryCenters).map((x) => [x.id, x.deliveryCenters!]),
  ),
};

const valueOf = (t: SeedTerm, states: Edits | undefined, f: "grade" | "location") => {
  const e = states?.[t.id]?.edits;
  return (e && f in e ? e[f] : t[f]) as string | null;
};

/**
 * Seed plus uploads. A supplier without a seed role map gets one from its uploaded rate terms,
 * one entry per role as written, so a role is still matched only through a map.
 */
export function catalogOf(u?: Uploads | null, states?: Edits): Catalog {
  if (!u || (!u.documents.length && !u.suppliers.length)) return SEED_CATALOG;
  const suppliers = [...SUPPLIERS, ...u.suppliers];
  const documents = [...DOCUMENTS, ...u.documents];
  const terms = [...TERMS, ...u.terms];
  const roleMaps: Record<string, RoleMapEntry[]> = { ...ROLE_MAPS };
  const deliveryCenters = { ...SEED_CATALOG.deliveryCenters };
  for (const t of u.terms) {
    if (t.kind !== "rate") continue;
    const sid = documents.find((d) => d.id === t.docId)?.supplierId;
    if (!sid || ROLE_MAPS[sid]) continue;
    const grade = valueOf(t, states, "grade");
    if (grade && !(roleMaps[sid] ?? []).some((r) => r.grade === grade))
      roleMaps[sid] = [...(roleMaps[sid] ?? []), { grade, role: grade }];
    const loc = valueOf(t, states, "location");
    if (loc && loc !== "all" && !SEED_CATALOG.deliveryCenters[sid] && !(deliveryCenters[sid] ?? []).includes(loc))
      deliveryCenters[sid] = [...(deliveryCenters[sid] ?? []), loc];
  }
  return { suppliers, documents, terms, roleMaps, deliveryCenters };
}

export const sourceOf = (x: { source?: ExtractionSource | undefined }): ExtractionSource =>
  x.source ?? "Stored";

/** Runs for a document. Seed documents have one implicit Stored run. */
export function runsFor(u: Uploads | undefined, doc: ContractDocument): ExtractionRun[] {
  if (sourceOf(doc) === "Stored")
    return [
      {
        id: `STORED-${doc.id}`,
        docId: doc.id,
        source: "Stored",
        status: "Completed",
        at: "",
        by: "Seed",
        termIds: TERMS.filter((t) => t.docId === doc.id).map((t) => t.id),
        accepted: TERMS.filter((t) => t.docId === doc.id).length,
        rejected: 0,
        rejections: [],
      },
    ];
  return (u?.runs ?? []).filter((r) => r.docId === doc.id);
}
