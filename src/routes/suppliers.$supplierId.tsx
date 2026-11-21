import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Building2, FileText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Chip, DocStatusBadge, TermStatusChip } from "@/components/app/chips";
import { DOCUMENTS, SUPPLIERS, TERMS, supplierById } from "@/data/seed";
import { useDemo } from "@/lib/demo-store";
import { formatDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { currentValue } from "@/lib/term-state";

export const Route = createFileRoute("/suppliers/$supplierId")({
  loader: ({ params }) => {
    const supplier = supplierById(params.supplierId);
    if (!supplier) throw notFound();
    return { supplierId: supplier.id, name: supplier.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Supplier"} · Contract Price Truth` },
      {
        name: "description",
        content:
          "Supplier workspace with associated contract documents and extracted pricing information.",
      },
      { property: "og:title", content: `${loaderData?.name ?? "Supplier"} · Contract Price Truth` },
      {
        property: "og:description",
        content: "Associated agreements, amendments and pricing information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierWorkspace,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-xl font-semibold">Supplier not found</p>
      <Link to="/suppliers" className="mt-3 inline-block text-sm text-primary hover:underline">
        Back to Suppliers
      </Link>
    </div>
  ),
});

function SupplierWorkspace() {
  const { supplierId } = Route.useLoaderData();
  const supplier = SUPPLIERS.find((s) => s.id === supplierId)!;
  const documents = DOCUMENTS.filter((d) => d.supplierId === supplierId);
  const terms = TERMS.filter((t) => documents.some((d) => d.id === t.docId));
  const { state } = useDemo();
  return (
    <div>
      <Link
        to="/suppliers"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Suppliers
      </Link>
      <PageHeader
        eyebrow={supplier.category}
        title={supplier.name}
        actions={
          <Chip tone="info">
            {documents.length + (supplier.stubDocuments?.length ?? 0)} document records
          </Chip>
        }
      >
        Supplier workspace for contract source documents and extracted commercial terms.
      </PageHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="surface h-fit overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Agreements and related documents</h2>
          </div>
          <div className="divide-y">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                to="/documents/$docId"
                params={{ docId: doc.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-primary">{doc.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {doc.kind} · {doc.id} ·{" "}
                    {doc.effectiveFrom
                      ? `Effective ${formatDate(doc.effectiveFrom)}`
                      : doc.dateLine}
                  </span>
                </span>
                <DocStatusBadge doc={doc} />
              </Link>
            ))}
            {(supplier.stubDocuments ?? []).map((title) => (
              <div key={title} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Title only. No stored source text.
                  </span>
                </span>
                <Chip>Not extracted</Chip>
              </div>
            ))}
          </div>
        </section>
        <section className="surface h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Pricing information</h2>
            {terms.length > 0 && (
              <Link to="/price-book" className="text-xs font-medium text-primary hover:underline">
                Open Price Book
              </Link>
            )}
          </div>
          {terms.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">No extracted pricing terms</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only document titles are available for this supplier.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {terms
                .filter((t) => t.kind === "rate" || t.kind === "draft")
                .map((term) => {
                  const ts = state.terms[term.id]!;
                  return (
                    <Link
                      key={term.id}
                      to="/price-book"
                      hash={term.id}
                      className="block px-4 py-3 hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{term.title}</span>
                        <TermStatusChip status={ts.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {term.grade} · {term.location === "all" ? "All centers" : term.location} ·{" "}
                        <span className="font-mono text-foreground">
                          {formatINR(Number(currentValue(term, ts, "ratePaise") ?? 0))}/h
                        </span>
                        {term.effectiveFrom ? ` from ${formatDate(term.effectiveFrom)}` : ""}
                      </p>
                    </Link>
                  );
                })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
