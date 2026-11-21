import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { ConflictCard } from "@/components/app/conflict-card";
import { FindingStatusChip } from "@/components/app/chips";
import { LineSummary } from "@/components/app/result-card";
import { RoleGate } from "@/components/app/role-gate";
import { CONFLICTS } from "@/data/seed";
import type { Reading } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import { describeOutcome } from "@/lib/pricing-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legal/$conflictId")({
  loader: ({ params }) => {
    const conflict = CONFLICTS.find((c) => c.id === params.conflictId);
    if (!conflict) throw notFound();
    return { conflictId: conflict.id };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.conflictId ?? "Conflict"} Legal Review · Contract Price Truth` },
      {
        name: "description",
        content:
          "Review competing clause interpretations, supporting citations and dependent pricing investigations.",
      },
      {
        property: "og:title",
        content: `${loaderData?.conflictId ?? "Conflict"} Legal Review · Contract Price Truth`,
      },
      {
        property: "og:description",
        content:
          "Competing clause interpretations with supporting citations and a recorded Legal decision.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConflictReviewPage,
  notFoundComponent: () => (
    <div className="py-16 text-center">
      <p className="text-xl font-semibold">Legal review not found</p>
      <Link to="/legal" className="mt-3 inline-block text-sm text-primary hover:underline">
        Back to Legal Reviews
      </Link>
    </div>
  ),
});

function ConflictReviewPage() {
  const { conflictId } = Route.useLoaderData();
  const conflict = CONFLICTS.find((c) => c.id === conflictId)!;
  const { state, evaluate, recordRuling } = useDemo();
  const [reading, setReading] = useState<Reading | null>(null);
  const [reasoning, setReasoning] = useState("");
  const ruling = state.rulings[conflict.id];
  const dependent = state.findings.filter(
    (f) => f.escalated || evaluate(f.line).conflictId === conflict.id,
  );
  return (
    <div>
      <Link
        to="/legal"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Legal Reviews
      </Link>
      <PageHeader
        eyebrow={`BrightHire Staffing · ${conflict.id}`}
        title="Contractual conflict review"
      >
        Review both interpretations and their source clauses. The application never makes the Legal
        decision itself.
      </PageHeader>
      <ConflictCard conflict={conflict}>
        <div className="space-y-5">
          <section>
            <h3 className="eyebrow mb-2">Relevant pricing context</h3>
            <p className="text-sm text-muted-foreground">
              The conflict affects the QA Analyst (L2) rate and any dependent invoice investigation.
              Recording a decision updates the affected terms and recalculates the assessment.
            </p>
          </section>
          <section>
            <h3 className="eyebrow mb-2">Dependent investigations</h3>
            {dependent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No investigations depend on this conflict yet.
              </p>
            ) : (
              <div className="space-y-2">
                {dependent.map((f) => {
                  const result = evaluate(f.line);
                  return (
                    <div key={f.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/findings"
                          hash={f.id}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {f.id}
                        </Link>
                        <FindingStatusChip status={f.status} />
                      </div>
                      <div className="mt-2">
                        <LineSummary line={f.line} />
                      </div>
                      {result.outcomes?.map((o) => (
                        <p key={o.label} className="mt-1 text-xs">
                          {o.label}: {describeOutcome(o)}.
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {!ruling && (
            <RoleGate role="legal" action="Recording a decision">
              <section className="space-y-4 rounded-md border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Record decision</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select the supported interpretation and provide concise reasoning.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {conflict.readings.map((r) => (
                    <button
                      key={r.reading}
                      onClick={() => setReading(r.reading)}
                      aria-pressed={reading === r.reading}
                      className={cn(
                        "rounded-md border p-3 text-left text-sm transition-colors",
                        reading === r.reading ? "border-primary bg-accent" : "hover:bg-muted",
                      )}
                    >
                      <span className="font-medium">Reading {r.reading}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{r.summary}</span>
                    </button>
                  ))}
                </div>
                <label className="block text-sm">
                  <span className="eyebrow">Decision reasoning</span>
                  <Textarea
                    className="mt-1.5"
                    value={reasoning}
                    onChange={(e) => setReasoning(e.target.value)}
                    placeholder="For example: Schedule A Note 2 is specific and MSA 11.2(b) gives Schedule A precedence on pricing."
                    rows={4}
                    maxLength={500}
                  />
                </label>
                <Button
                  disabled={!reading || reasoning.trim().length < 5}
                  onClick={() => {
                    recordRuling(conflict.id, reading!, reasoning);
                    toast.success(`Decision recorded: Reading ${reading}`);
                  }}
                >
                  Record Decision
                </Button>
              </section>
            </RoleGate>
          )}
        </div>
      </ConflictCard>
    </div>
  );
}
