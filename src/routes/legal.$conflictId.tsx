import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { ConflictCard } from "@/components/app/conflict-card";
import { InvestigationStatusChip, ResultStatusChip, TermStatusChip } from "@/components/app/chips";
import { TermCitation } from "@/components/app/citation";
import { LineSummary } from "@/components/app/result-card";
import { RoleGate } from "@/components/app/role-gate";
import { CONFLICTS } from "@/data/seed";
import type { Reading } from "@/data/types";
import { useDemo, useInvestigations } from "@/lib/demo-store";
import { formatINR } from "@/lib/money";
import { daysBetween, formatDate, formatTimestamp } from "@/lib/dates";
import { describeOutcome, permittedAdjustedRate } from "@/lib/pricing-engine";
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
  const { state, ctx, evaluate, recordRuling } = useDemo();
  const rows = useInvestigations();
  const [reading, setReading] = useState<Reading | null>(null);
  const [reasoning, setReasoning] = useState("");
  const ruling = state.rulings[conflict.id];
  const caseState = state.conflictCases[conflict.id];
  const withLegal = caseState?.status === "With Legal";
  const affected = state.assessments.filter((a) =>
    a.versions.some((v) => v.result.conflictId === conflict.id),
  );
  const terms = conflict.termIds.map((id) => ctx.terms.find((t) => t.id === id)!);
  const notice = terms.find((t) => t.kind === "notice");
  const clause = terms.find((t) => t.capPct !== undefined);
  const base = notice
    ? ctx.terms.find(
        (t) => t.kind === "rate" && t.grade === notice.grade && t.location === "all" && !t.replaces,
      )
    : undefined;
  const days =
    notice?.noticeDate && notice.effectiveFrom
      ? daysBetween(notice.noticeDate, notice.effectiveFrom)
      : null;
  const permitted =
    base?.ratePaise != null && clause?.capPct !== undefined && notice?.statedCpiPct !== undefined
      ? permittedAdjustedRate(base.ratePaise, clause.capPct, notice.statedCpiPct)
      : null;
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
        Review both readings and their source clauses. The application never makes the Legal
        decision itself.
      </PageHeader>
      <ConflictCard conflict={conflict}>
        <div className="space-y-5">
          <section>
            <h3 className="eyebrow mb-2">Question from Procurement</h3>
            {caseState?.questions.length ? (
              caseState.questions.map((q, i) => (
                <p key={i} className="text-sm">
                  "{q.text}"{" "}
                  <span className="text-xs text-muted-foreground">
                    {q.by} on {q.termId}, {formatTimestamp(q.at)}
                  </span>
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Not sent to Legal yet.</p>
            )}
          </section>
          <section>
            <h3 className="eyebrow mb-2">Passages and review status</h3>
            <ul className="space-y-1.5 text-sm">
              {terms.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2">
                  <TermCitation termId={t.id} />
                  <TermStatusChip status={t.status} />
                  {state.terms[t.id]?.interpretation && (
                    <span className="text-xs text-muted-foreground">
                      {state.terms[t.id]!.interpretation!.choice}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Review status is set by Procurement. A ruling does not change it.
            </p>
          </section>
          {notice && (
            <section>
              <h3 className="eyebrow mb-2">
                Notice {notice.id}: facts and engine-checked conditions
              </h3>
              <dl className="grid gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-[12rem_1fr]">
                <dt className="text-muted-foreground">Claim</dt>
                <dd className="font-mono">
                  {notice.grade} to {formatINR(notice.ratePaise!)}/h from{" "}
                  {formatDate(notice.effectiveFrom!)}
                </dd>
                <dt className="text-muted-foreground">Notice given</dt>
                <dd className="font-mono">
                  {notice.noticeDate ? formatDate(notice.noticeDate) : "Unknown"}, {days ?? "?"}{" "}
                  days ahead ({clause?.noticeDaysRequired ?? "?"} required):{" "}
                  {days !== null &&
                  clause?.noticeDaysRequired !== undefined &&
                  days >= clause.noticeDaysRequired
                    ? "timely"
                    : "not timely"}
                </dd>
                <dt className="text-muted-foreground">Index</dt>
                <dd className="font-mono">
                  {notice.statedCpiPct}% stated by the supplier, not independently verified
                </dd>
                <dt className="text-muted-foreground">Cap</dt>
                <dd className="font-mono">{clause?.capPct}%</dd>
                <dt className="text-muted-foreground">Permitted rate if Reading B</dt>
                <dd className="font-mono">
                  {permitted !== null && base?.ratePaise != null
                    ? `${formatINR(base.ratePaise)} x (1 + ${Math.min(clause!.capPct!, notice.statedCpiPct!)}%) = ${formatINR(permitted)}/h`
                    : "Unknown"}
                </dd>
              </dl>
            </section>
          )}
          <section>
            <h3 className="eyebrow mb-2">Affected checks</h3>
            {affected.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved checks depend on this conflict yet.
              </p>
            ) : (
              <div className="space-y-2">
                {affected.map((a) => {
                  const latest = a.versions[a.versions.length - 1]!;
                  const result = evaluate(latest.inputs.line);
                  const inv = rows.find((r) => r.assessment.id === a.id);
                  return (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs">
                          {a.id} v{latest.n}
                        </span>
                        <ResultStatusChip status={latest.result.status} />
                        {inv && (
                          <>
                            <Link
                              to="/findings"
                              hash={inv.investigation.id}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {inv.investigation.id}
                            </Link>
                            <InvestigationStatusChip status={inv.status} />
                          </>
                        )}
                      </div>
                      <div className="mt-2">
                        <LineSummary line={latest.inputs.line} />
                      </div>
                      {result.outcomes?.map((o) => (
                        <p key={o.label} className="mt-1 text-xs">
                          {o.label}: governs {formatINR(o.ratePaise)}/h, {describeOutcome(o)}.
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {ruling ? (
            <p className="rounded-md border border-success/30 bg-success-soft p-3 text-sm">
              Human ruling by {ruling.by}, {formatTimestamp(ruling.at)}. It cannot be changed in
              this prototype. Every affected check was recomputed as a new version.
            </p>
          ) : !withLegal ? (
            <p className="rounded-md border bg-muted p-3 text-sm">
              A ruling can be recorded only once Procurement marks a clause Disputed and sends this
              conflict to Legal.
            </p>
          ) : (
            <RoleGate role="legal" action="Recording a ruling">
              <section className="space-y-4 rounded-md border p-4" data-tour="legal-readings">
                <div>
                  <h3 className="text-sm font-semibold">Record ruling</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose a reading and write the reasoning. The ruling is stored with your name
                    and time.
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
                  <span className="eyebrow">Reasoning</span>
                  <Textarea
                    className="mt-1.5"
                    value={reasoning}
                    onChange={(e) => setReasoning(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                </label>
                <Button
                  disabled={!reading || reasoning.trim().length < 5}
                  onClick={() => {
                    if (recordRuling(conflict.id, reading!, reasoning))
                      toast.success(`Ruling recorded: Reading ${reading}`);
                  }}
                >
                  Record ruling
                </Button>
              </section>
            </RoleGate>
          )}
        </div>
      </ConflictCard>
    </div>
  );
}
