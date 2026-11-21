import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DocStatusBadge, SourceLabel } from "@/components/app/chips";
import { UploadContractDialog } from "@/components/app/upload-dialog";
import type { ContractDocument } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import type { Catalog } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface RepositorySearch {
  q?: string;
}
export const Route = createFileRoute("/documents/")({
  validateSearch: (search: Record<string, unknown>): RepositorySearch => ({
    ...(typeof search["q"] === "string" ? { q: search["q"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "All Contracts · Contract Price Truth" },
      {
        name: "description",
        content: "Search, filter and sort supplier contracts, schedules, amendments and notices.",
      },
      { property: "og:title", content: "All Contracts · Contract Price Truth" },
      {
        property: "og:description",
        content: "Search, filter and sort supplier contracts, schedules, amendments and notices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

type RepositoryRow = {
  key: string;
  title: string;
  supplierId: string;
  supplier: string;
  category: string;
  kind: string;
  status: ContractDocument["status"] | "Not provided";
  effective: string | null;
  termsText: string;
  doc?: ContractDocument;
};
type SortKey = "title" | "supplier" | "kind" | "status" | "effective";

const rowsOf = ({
  documents: DOCUMENTS,
  suppliers: SUPPLIERS,
  terms: TERMS,
}: Catalog): RepositoryRow[] => [
  ...DOCUMENTS.map((doc) => {
    const supplier = SUPPLIERS.find((s) => s.id === doc.supplierId)!;
    return {
      key: doc.id,
      title: doc.title,
      supplierId: supplier.id,
      supplier: supplier.name,
      category: supplier.category,
      kind: doc.kind,
      status: doc.status,
      effective: doc.effectiveFrom,
      termsText: TERMS.filter((term) => term.docId === doc.id)
        .map((term) =>
          [term.title, term.grade ?? "", term.location ?? "", term.clauseId, term.quote].join(" "),
        )
        .join(" "),
      doc,
    };
  }),
  ...SUPPLIERS.flatMap((supplier) =>
    (supplier.stubDocuments ?? []).map((title, index) => ({
      key: `${supplier.id}-stub-${index}`,
      title,
      supplierId: supplier.id,
      supplier: supplier.name,
      category: supplier.category,
      kind: "Not provided",
      status: "Not provided" as const,
      effective: null,
      termsText: "",
    })),
  ),
];

const selectClass = "h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground";

function DocumentsPage() {
  const { catalog, role } = useDemo();
  const ROWS = useMemo(() => rowsOf(catalog), [catalog]);
  const { documents: DOCUMENTS, suppliers: SUPPLIERS } = catalog;
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(searchParams.q ?? "");
  const [supplier, setSupplier] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("title");
  const [ascending, setAscending] = useState(true);
  useEffect(() => setQ(searchParams.q ?? ""), [searchParams.q]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = ROWS.filter((row) => {
      const matchesQuery =
        !query ||
        [row.title, row.supplier, row.category, row.kind, row.doc?.id ?? "", row.termsText].some(
          (value) => value.toLowerCase().includes(query),
        );
      return (
        matchesQuery &&
        (supplier === "all" || row.supplierId === supplier) &&
        (kind === "all" || row.kind === kind) &&
        (status === "all" || row.status === status)
      );
    });
    return filtered.sort((a, b) => {
      const av = sort === "effective" ? (a.effective ?? "") : a[sort];
      const bv = sort === "effective" ? (b.effective ?? "") : b[sort];
      return av.localeCompare(bv) * (ascending ? 1 : -1);
    });
  }, [ROWS, q, supplier, kind, status, sort, ascending]);

  const setSorting = (key: SortKey) => {
    if (sort === key) setAscending((v) => !v);
    else {
      setSort(key);
      setAscending(true);
    }
  };
  const clear = () => {
    setQ("");
    setSupplier("all");
    setKind("all");
    setStatus("all");
    setSort("title");
    setAscending(true);
    void navigate({ to: "/documents", search: {} });
  };
  const hasFilters = Boolean(q || supplier !== "all" || kind !== "all" || status !== "all");

  return (
    <div>
      <PageHeader
        title="All Contracts"
        actions={role.id === "procurement" ? <UploadContractDialog /> : undefined}
      >
        A searchable repository of supplier documents. Signing status is declared, not
        cryptographically checked. Seed documents use a Stored extraction. Uploaded documents use a
        Live extraction.
      </PageHeader>
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search document name, ID, supplier or category"
              className="pl-9 text-xs"
              aria-label="Search contract repository"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
            <select
              className={selectClass}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              aria-label="Filter by supplier"
            >
              <option value="all">All suppliers</option>
              {SUPPLIERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Filter by document type"
            >
              <option value="all">All document types</option>
              {[...new Set(DOCUMENTS.map((d) => d.kind))].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by signing status"
            >
              <option value="all">All signing statuses</option>
              {["Signed", "Draft, unsigned", "Received notice"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={!hasFilters}
              className="h-9"
            >
              Clear filters
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <span>
            {results.length} of {ROWS.length} document records
          </span>
          <span>{DOCUMENTS.length} include source text</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr>
                {(
                  [
                    { key: "title", label: "Contract / document" },
                    { key: "supplier", label: "Supplier" },
                    { key: "kind", label: "Document type" },
                    { key: "status", label: "Signing status" },
                    { key: "effective", label: "Effective date" },
                  ] as { key: SortKey; label: string }[]
                ).map((column) => (
                  <th key={column.key} className="table-heading">
                    <button
                      className="flex items-center gap-1.5 hover:text-foreground"
                      onClick={() => setSorting(column.key)}
                    >
                      {column.label}
                      {sort === column.key ? (
                        ascending ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="table-heading">Supplier category</th>
                <th className="table-heading text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map((row) => (
                <tr key={row.key} className="hover:bg-muted/40">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        {row.doc ? (
                          <Link
                            to="/documents/$docId"
                            params={{ docId: row.doc.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.title}</span>
                        )}
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                          {row.doc?.id ?? "Title only. No stored source text."}
                          {row.doc && <SourceLabel live={row.doc.source === "Live"} />}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <Link
                      to="/suppliers/$supplierId"
                      params={{ supplierId: row.supplierId }}
                      className="text-xs font-medium hover:text-primary hover:underline"
                    >
                      {row.supplier}
                    </Link>
                  </td>
                  <td className="table-cell text-xs">{row.kind}</td>
                  <td className="table-cell">
                    {row.doc ? <DocStatusBadge doc={row.doc} /> : <Chip>Not provided</Chip>}
                  </td>
                  <td className="table-cell whitespace-nowrap text-xs">
                    {row.effective ? formatDate(row.effective) : "Not available"}
                  </td>
                  <td className="table-cell text-xs text-muted-foreground">{row.category}</td>
                  <td className="table-cell text-right">
                    {row.doc ? (
                      <Link
                        to="/documents/$docId"
                        params={{ docId: row.doc.id }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View document
                      </Link>
                    ) : (
                      <Link
                        to="/suppliers/$supplierId"
                        params={{ supplierId: row.supplierId }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View supplier
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium">No documents match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Change the search or clear filters to see all records.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={clear}>
                Clear filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
