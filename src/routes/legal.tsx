import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/app/chips";
import { CONFLICTS } from "@/data/seed";
import { useDemo } from "@/lib/demo-store";
import { formatTimestamp } from "@/lib/dates";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal Reviews · Contract Price Truth" },
      {
        name: "description",
        content:
          "A focused queue of contractual conflicts escalated by Procurement for Legal decision.",
      },
      { property: "og:title", content: "Legal Reviews · Contract Price Truth" },
      {
        property: "og:description",
        content: "Contractual conflicts escalated by Procurement for Legal decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  const { state } = useDemo();
  const { hash, pathname } = useLocation({
    select: (l) => ({ hash: l.hash, pathname: l.pathname }),
  });
  const navigate = useNavigate();
  const sent = (id: string) => (state.conflictCases[id]?.status ?? "Open") !== "Open";
  const escalated = CONFLICTS.filter((c) => sent(c.id));
  useEffect(() => {
    if (
      CONFLICTS.some(
        (c) => c.id === hash && (state.conflictCases[c.id]?.status ?? "Open") !== "Open",
      )
    )
      void navigate({ to: "/legal/$conflictId", params: { conflictId: hash }, replace: true });
  }, [hash, state.conflictCases, navigate]);
  if (pathname !== "/legal") return <Outlet />;
  return (
    <div>
      <PageHeader title="Legal Reviews">
        Only conflicts Procurement marked Disputed reach Legal. A ruling is a human decision with
        reasoning, cannot be changed, never verifies the clauses, and recomputes every dependent
        check as a new version.
      </PageHeader>
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Review queue</h2>
          <Chip tone={escalated.some((c) => !state.rulings[c.id]) ? "legal" : "neutral"}>
            {escalated.filter((c) => !state.rulings[c.id]).length} awaiting decision
          </Chip>
        </div>
        {escalated.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <Scale className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="text-sm font-semibold">No conflicts escalated</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Procurement has not sent any contractual conflicts for Legal review.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr>
                  {["Review", "Supplier", "Contractual question", "Sent by", "Status", ""].map(
                    (h) => (
                      <th key={h} className="table-heading">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {escalated.map((c) => {
                  const ruling = state.rulings[c.id];
                  const escalation = state.conflictCases[c.id]?.questions[0];
                  return (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="table-cell font-mono text-xs">{c.id}</td>
                      <td className="table-cell text-xs">BrightHire Staffing</td>
                      <td className="table-cell max-w-md">
                        <Link
                          to="/legal/$conflictId"
                          params={{ conflictId: c.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.question}
                        </Link>
                        {state.conflictCases[c.id]?.questions.map((q, i) => (
                          <span key={i} className="mt-1 block text-xs text-muted-foreground">
                            Procurement asks: "{q.text}"
                          </span>
                        ))}
                      </td>
                      <td className="table-cell text-xs text-muted-foreground">
                        {escalation ? (
                          <>
                            {escalation.by}
                            <span className="mt-0.5 block">{formatTimestamp(escalation.at)}</span>
                          </>
                        ) : (
                          "Before this session"
                        )}
                      </td>
                      <td className="table-cell">
                        {ruling ? (
                          <Chip tone="success">Reading {ruling.reading} decided</Chip>
                        ) : (
                          <Chip tone="legal">Awaiting decision</Chip>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <Link
                          to="/legal/$conflictId"
                          params={{ conflictId: c.id }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Open review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
