import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, CheckCircle2, FileCheck2, FileText, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/app/chips";
import { CONFLICTS, DOCUMENTS, TERMS, docById, termById } from "@/data/seed";
import type { ActivityEvent } from "@/lib/workflow";
import { useDemo, useDerived } from "@/lib/demo-store";
import { formatDate, formatTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Procurement Overview · Contract Price Truth" },
      {
        name: "description",
        content:
          "Monitor supplier agreements, pricing changes and pending reviews from a live contract operations dashboard.",
      },
      { property: "og:title", content: "Procurement Overview · Contract Price Truth" },
      {
        property: "og:description",
        content: "Monitor supplier agreements, pricing changes and pending reviews.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function MetricCard({
  label,
  value,
  detail,
  to,
  search,
  hash,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  to: "/price-book" | "/findings" | "/legal";
  search?: { tab: "pending" | "open" | "legal" | "confirmed" | "clauses" };
  hash?: string;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <Link
      to={to}
      {...(search ? { search } : {})}
      {...(hash ? { hash } : {})}
      className="surface group p-4 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p
        className={cn(
          "tabular mt-3 text-2xl font-semibold",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

function ActionRow({
  title,
  detail,
  action,
  to,
  search,
  hash,
  icon,
}: {
  title: string;
  detail: string;
  action: string;
  to: "/price-book" | "/findings" | "/legal" | "/invoice-check";
  search?: { tab: "pending" | "open" | "legal" | "confirmed" | "clauses" };
  hash?: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      to={to}
      {...(search ? { search } : {})}
      {...(hash ? { hash } : {})}
      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
        {icon ?? <AlertCircle className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
        {action}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function StatusBars() {
  const { state } = useDemo();
  const statuses = ["Verified", "Proposed", "Needs review", "Ignored"] as const;
  const counts = statuses.map((status) => ({
    status,
    count: TERMS.filter((t) => state.terms[t.id]?.status === status).length,
  }));
  return (
    <section className="surface p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Pricing terms by verification status</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Current BrightHire term review state</p>
      </div>
      <div className="space-y-3">
        {counts.map(({ status, count }) => (
          <div
            key={status}
            className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-3 text-xs"
          >
            <span className="text-muted-foreground">{status}</span>
            <div className="h-2 overflow-hidden rounded-sm bg-muted">
              <div
                className={cn(
                  "h-full rounded-sm",
                  status === "Verified"
                    ? "bg-success"
                    : status === "Proposed"
                      ? "bg-info"
                      : status === "Needs review"
                        ? "bg-warning"
                        : "bg-muted-foreground/40",
                )}
                style={{ width: `${(count / TERMS.length) * 100}%` }}
              />
            </div>
            <span className="tabular text-right font-medium">{count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentBars() {
  const kinds = [...new Set(DOCUMENTS.map((d) => d.kind))];
  return (
    <section className="surface p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Contract documents by type</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Documents with stored source text</p>
      </div>
      <div className="space-y-3">
        {kinds.map((kind) => {
          const count = DOCUMENTS.filter((d) => d.kind === kind).length;
          return (
            <div
              key={kind}
              className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-3 text-xs"
            >
              <span className="text-muted-foreground">{kind}</span>
              <div className="h-2 overflow-hidden rounded-sm bg-muted">
                <div
                  className="h-full rounded-sm bg-primary"
                  style={{ width: `${(count / DOCUMENTS.length) * 100}%` }}
                />
              </div>
              <span className="tabular text-right font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivity() {
  const { state } = useDemo();
  const linkFor = (ref: ActivityEvent["ref"]) =>
    ref?.kind === "term"
      ? { to: "/price-book" as const, hash: ref.id }
      : ref?.kind === "investigation"
        ? { to: "/findings" as const, hash: ref.id }
        : ref?.kind === "conflict"
          ? { to: "/legal" as const, hash: ref.id }
          : { to: "/invoice-check" as const, hash: "" };
  const events = state.activity
    .map((e) => ({ at: e.at, actor: e.by, text: e.text, ...linkFor(e.ref) }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);
  return (
    <section className="surface overflow-hidden">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Recent Contract Activity</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Verification and investigation events from this browser session
        </p>
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">No session activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify a term or raise an investigation to create an audit event.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr>
                {["Event", "Owner", "Date"].map((h) => (
                  <th key={h} className="table-heading">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event, index) => (
                <tr key={`${event.at}-${index}`} className="hover:bg-muted/40">
                  <td className="table-cell">
                    <Link
                      to={event.to}
                      hash={event.hash}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {event.text}
                    </Link>
                  </td>
                  <td className="table-cell text-xs text-muted-foreground">{event.actor}</td>
                  <td className="table-cell whitespace-nowrap text-xs text-muted-foreground">
                    {formatTimestamp(event.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProcurementDashboard() {
  const { state } = useDemo();
  const d = useDerived();
  const activeConflicts = d.conflictsOpen;
  const activeInvestigations = d.openInvestigations;
  const proposedAmendmentRates = TERMS.filter(
    (t) => t.docId === "BH-AMD-01-2026" && state.terms[t.id]?.status === "Proposed",
  );
  const rateTerms = TERMS.filter((t) => t.kind === "rate" && t.initialStatus !== "Ignored");
  const rateVerified = rateTerms.filter((t) => state.terms[t.id]?.status === "Verified").length;
  const coverage = rateTerms.length ? Math.round((rateVerified / rateTerms.length) * 100) : 0;
  const actions: ReactNode[] = [];
  if (proposedAmendmentRates.length)
    actions.push(
      <ActionRow
        key="rates"
        title={`BrightHire Amendment 1: ${proposedAmendmentRates.length} rates awaiting verification`}
        detail="Signed 20 Jul 2026. Effective 1 Aug 2026."
        action="Review rates"
        to="/price-book"
        search={{ tab: "pending" }}
        icon={<FileCheck2 className="size-4" />}
      />,
    );
  for (const conflict of CONFLICTS.filter((c) => !state.rulings[c.id]))
    actions.push(
      <ActionRow
        key={conflict.id}
        title="BrightHire annual adjustment: contractual conflict requiring review"
        detail={
          state.conflictCases[conflict.id]?.status === "With Legal"
            ? "Sent to Legal. Awaiting a ruling."
            : "Fixed-rate and annual-adjustment clauses compete. Review the clauses."
        }
        action={
          state.conflictCases[conflict.id]?.status === "With Legal"
            ? "View conflict"
            : "Review clauses"
        }
        to={state.conflictCases[conflict.id]?.status === "With Legal" ? "/legal" : "/price-book"}
        hash={conflict.id}
        icon={<Scale className="size-4" />}
      />,
    );
  for (const r of d.rows.filter((x) => x.status === "Open" || x.status === "Reopened").slice(0, 3))
    actions.push(
      <ActionRow
        key={r.investigation.id}
        title={`${r.investigation.id}: ${r.kind}`}
        detail={`${r.latest.inputs.line.grade} · ${r.latest.inputs.line.location || "Location not stated"} · Raised ${formatDate(r.investigation.createdAt.slice(0, 10))}`}
        action="Open investigation"
        to="/findings"
        hash={r.investigation.id}
      />,
    );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Rate terms awaiting verification"
          value={d.rateToVerify}
          detail={`Plus ${d.clausesToReview} clause items awaiting review`}
          to="/price-book"
          search={{ tab: "pending" }}
          tone={d.rateToVerify ? "warning" : "default"}
        />
        <MetricCard
          label="Open conflicts"
          value={activeConflicts}
          detail="Clauses competing over price applicability"
          to="/price-book"
          search={{ tab: "clauses" }}
        />
        <MetricCard
          label="Open investigations"
          value={activeInvestigations}
          detail="Invoice issues requiring attention or Legal review"
          to="/findings"
          search={{ tab: "open" }}
        />
        <MetricCard
          label="Coverage (prototype proxy)"
          value={`${coverage}%`}
          detail={`${rateVerified} of ${rateTerms.length} signed rate terms verified`}
          to="/price-book"
          tone="success"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <section className="surface h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Action Required</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pending work from current contract and invoice state
              </p>
            </div>
            <Chip tone={actions.length ? "warning" : "success"}>
              {actions.length} {actions.length === 1 ? "item" : "items"}
            </Chip>
          </div>
          {actions.length ? (
            <div className="divide-y">{actions}</div>
          ) : (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <CheckCircle2 className="mb-2 size-6 text-success" />
              <p className="text-sm font-medium">No pending actions</p>
              <p className="mt-1 text-xs text-muted-foreground">
                All current verification and investigation work is complete.
              </p>
            </div>
          )}
        </section>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <StatusBars />
          <DocumentBars />
        </div>
      </div>
      <div className="mt-5">
        <RecentActivity />
      </div>
    </>
  );
}

function FinanceDashboard() {
  const { state } = useDemo();
  const d = useDerived();
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Investigations"
          value={d.rows.length}
          detail="Saved from Invoice Check in this session"
          to="/findings"
        />
        <MetricCard
          label="Open investigations"
          value={d.openInvestigations}
          detail="Awaiting Procurement attention"
          to="/findings"
          search={{ tab: "open" }}
        />
        <MetricCard
          label="Confirmed discrepancies"
          value={d.rows.filter((r) => r.status === "Confirmed").length}
          detail="Recovery is not tracked"
          to="/findings"
          search={{ tab: "confirmed" }}
        />
      </div>
      <section className="surface overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Finance workspace</h2>
        </div>
        <ActionRow
          title="Check an invoice line against the contract"
          detail="Compare service dates, grade, location, hours and billed rate with verified terms."
          action="Open Invoice Check"
          to="/invoice-check"
          icon={<FileCheck2 className="size-4" />}
        />
        {d.rows.slice(0, 4).map((r) => (
          <ActionRow
            key={r.investigation.id}
            title={`${r.investigation.id}: ${r.kind}, ${r.status}`}
            detail={`Version ${r.latest.n}: ${r.latest.result.status}`}
            action="View status"
            to="/findings"
            hash={r.investigation.id}
          />
        ))}
      </section>
      <p className="text-xs text-muted-foreground">
        Invoice checks are advisory. They never block payment and nothing is sent to suppliers.
      </p>
    </div>
  );
}

function LegalDashboard() {
  const { state } = useDemo();
  const escalated = CONFLICTS.filter(
    (c) => (state.conflictCases[c.id]?.status ?? "Open") !== "Open",
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Awaiting Legal decision"
          value={CONFLICTS.filter((c) => state.conflictCases[c.id]?.status === "With Legal").length}
          detail="Escalated contractual conflicts"
          to="/legal"
          tone="warning"
        />
        <MetricCard
          label="Decisions recorded"
          value={CONFLICTS.filter((c) => state.rulings[c.id]).length}
          detail="Dependent investigations recalculate automatically"
          to="/legal"
          tone="success"
        />
      </div>
      <section className="surface overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Legal review queue</h2>
        </div>
        {escalated.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Procurement has not escalated a contractual conflict.
          </p>
        ) : (
          escalated.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Scale className="size-4 text-legal" />
              <Link
                to="/legal"
                hash={c.id}
                className="flex-1 text-sm font-medium text-primary hover:underline"
              >
                {c.question}
              </Link>
              {state.rulings[c.id] ? (
                <Chip tone="success">Decided</Chip>
              ) : (
                <Chip tone="legal">Awaiting decision</Chip>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Home() {
  const { role } = useDemo();
  const copy =
    role.id === "procurement"
      ? {
          title: "Procurement Overview",
          subtitle: "Monitor supplier agreements, pricing changes, and pending reviews.",
        }
      : role.id === "finance"
        ? {
            title: "Finance Overview",
            subtitle: "Check invoice pricing and monitor investigations raised for Procurement.",
          }
        : {
            title: "Legal Overview",
            subtitle: "Review contractual conflicts escalated for a reasoned decision.",
          };
  return (
    <div>
      <PageHeader title={copy.title}>{copy.subtitle}</PageHeader>
      {role.id === "procurement" ? (
        <ProcurementDashboard />
      ) : role.id === "finance" ? (
        <FinanceDashboard />
      ) : (
        <LegalDashboard />
      )}
    </div>
  );
}
