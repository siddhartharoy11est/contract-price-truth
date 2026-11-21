import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/app/chips";
import { useDemo } from "@/lib/demo-store";

export const Route = createFileRoute("/suppliers/")({
  head: () => ({
    meta: [
      { title: "Suppliers · Contract Price Truth" },
      {
        name: "description",
        content: "Supplier records with associated contract documents and extracted pricing terms.",
      },
      { property: "og:title", content: "Suppliers · Contract Price Truth" },
      {
        property: "og:description",
        content: "Supplier records with associated contract documents and extracted pricing terms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { catalog } = useDemo();
  const { suppliers: SUPPLIERS, documents: DOCUMENTS, terms: TERMS } = catalog;
  return (
    <div>
      <PageHeader title="Suppliers">
        Supplier records and their associated agreements, amendments and pricing information.
      </PageHeader>
      <section className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr>
                {[
                  "Supplier",
                  "Category",
                  "Document records",
                  "Source text available",
                  "Extracted terms",
                  "",
                ].map((h) => (
                  <th key={h} className="table-heading">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {SUPPLIERS.map((supplier) => {
                const docCount =
                  DOCUMENTS.filter((d) => d.supplierId === supplier.id).length +
                  (supplier.stubDocuments?.length ?? 0);
                const sourceCount = DOCUMENTS.filter((d) => d.supplierId === supplier.id).length;
                const termCount = TERMS.filter(
                  (t) => DOCUMENTS.find((d) => d.id === t.docId)?.supplierId === supplier.id,
                ).length;
                return (
                  <tr key={supplier.id} className="hover:bg-muted/40">
                    <td className="table-cell">
                      <Link
                        to="/suppliers/$supplierId"
                        params={{ supplierId: supplier.id }}
                        className="flex items-center gap-3 font-medium text-primary hover:underline"
                      >
                        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                          <Building2 className="size-4" />
                        </span>
                        {supplier.name}
                      </Link>
                    </td>
                    <td className="table-cell text-xs text-muted-foreground">
                      {supplier.category}
                    </td>
                    <td className="table-cell tabular text-xs">{docCount}</td>
                    <td className="table-cell">
                      {sourceCount ? (
                        <Chip tone="info">{sourceCount} documents</Chip>
                      ) : (
                        <Chip>Title records only</Chip>
                      )}
                    </td>
                    <td className="table-cell tabular text-xs">{termCount}</td>
                    <td className="table-cell text-right">
                      <Link
                        to="/suppliers/$supplierId"
                        params={{ supplierId: supplier.id }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open workspace
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
