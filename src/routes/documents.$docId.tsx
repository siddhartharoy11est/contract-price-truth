import { createFileRoute, Link, notFound, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DocStatusBadge, SourceLabel, TermStatusChip, Chip } from "@/components/app/chips";
import { QuoteHighlight, clauseAnchor } from "@/components/app/citation";
import { LiveReadPanel } from "@/components/app/live-read-panel";
import { docById, supplierById, TERMS } from "@/data/seed";
import { useDemo } from "@/lib/demo-store";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents/$docId")({
  loader: ({ params }) => {
    const doc = docById(params.docId);
    if (!doc) throw notFound();
    return { docId: doc.id, title: doc.title };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.title} (${loaderData.docId}) · Contract Price Truth`
          : "Document unavailable · Contract Price Truth",
      },
      {
        name: "description",
        content: "Stored contract source text with cited clauses and extracted commercial terms.",
      },
      {
        property: "og:title",
        content: loaderData
          ? `${loaderData.title} · Contract Price Truth`
          : "Document · Contract Price Truth",
      },
      {
        property: "og:description",
        content: "Stored contract source text with cited clauses and extracted commercial terms.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-xl font-semibold">Document not found</p>
      <Link to="/documents" className="mt-3 inline-block text-sm text-primary hover:underline">
        Back to All Contracts
      </Link>
    </div>
  ),
});

function DocumentPage() {
  const { docId } = Route.useLoaderData();
  const doc = docById(docId)!;
  const supplier = supplierById(doc.supplierId);
  const { state } = useDemo();
  const hash = useLocation({ select: (l) => l.hash });
  const terms = TERMS.filter((t) => t.docId === doc.id);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to="/documents" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          All Contracts
        </Link>
        <span>/</span>
        {supplier && (
          <Link
            to="/suppliers/$supplierId"
            params={{ supplierId: supplier.id }}
            className="hover:text-foreground"
          >
            {supplier.name}
          </Link>
        )}
      </div>
      <PageHeader
        eyebrow={`${supplier?.name} · ${doc.id}`}
        title={doc.title}
        actions={<DocStatusBadge doc={doc} />}
      >
        {doc.dateLine}
      </PageHeader>
      {doc.note && (
        <div className="mb-5 flex gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>{doc.note}</p>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
        <article className="paper-sheet h-fit overflow-hidden">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold">Stored document text</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Text record only. No rendered PDF is represented.
            </p>
          </div>
          <ol className="space-y-5 p-5 sm:p-6">
            {doc.clauses.map((c) => {
              const quote = terms.find((t) => t.clauseId === c.id)?.quote;
              const anchor = clauseAnchor(c.id);
              return (
                <li
                  key={c.id}
                  id={anchor}
                  className={cn(
                    "scroll-mt-24 rounded-md px-3 py-2",
                    hash === anchor && "flash-target ring-1 ring-primary/40",
                  )}
                >
                  <p className="font-mono text-[11px] font-medium text-muted-foreground">
                    {doc.kind === "Supplier letter" ? "Letter text" : `Clause ${c.label}`}
                  </p>
                  <p className="mt-1.5 text-sm leading-7">
                    <QuoteHighlight text={c.text} quote={quote} />
                  </p>
                </li>
              );
            })}
          </ol>
        </article>
        <div className="space-y-5">
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Extracted terms</h2>
              <SourceLabel live={false} />
            </div>
            {terms.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No terms were extracted from this document.
              </p>
            ) : (
              <div className="divide-y">
                {terms.map((t) => {
                  const ts = state.terms[t.id];
                  return (
                    <div key={t.id} className="p-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/price-book"
                          hash={t.id}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {t.id}
                        </Link>
                        <span className="flex-1 font-medium">{t.title}</span>
                        <TermStatusChip status={ts?.status ?? t.initialStatus} />
                      </div>
                      {t.ratePaise !== null && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t.grade} · {t.location === "all" ? "All centers" : t.location} ·{" "}
                          <span className="font-mono text-foreground">
                            {formatINR(ts?.editedRatePaise ?? t.ratePaise)}/h
                          </span>{" "}
                          from {t.effectiveFrom ? formatDate(t.effectiveFrom) : "unknown"}
                        </p>
                      )}
                      {ts?.secondReadDiffers && (
                        <Chip tone="danger" className="mt-2">
                          Second read differs
                        </Chip>
                      )}
                      {t.note && <p className="mt-1.5 text-xs text-muted-foreground">{t.note}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {doc.supplierId === "brighthire" && <LiveReadPanel docId={doc.id} />}
        </div>
      </div>
    </div>
  );
}
