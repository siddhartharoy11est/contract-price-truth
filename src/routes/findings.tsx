import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/app/page-header";
import { Chip, InvestigationStatusChip, ResultStatusChip } from "@/components/app/chips";
import { LineSummary, ResultBody } from "@/components/app/result-card";
import { RoleGate } from "@/components/app/role-gate";
import { DiscrepancyTotals } from "@/components/app/totals";
import { VersionHistory } from "@/components/app/version-history";
import { termById } from "@/data/seed";
import { useDemo, useInvestigations, type InvestigationRow } from "@/lib/demo-store";
import { DEFAULT_SUPPLIER_ID } from "@/lib/pricing-engine";
import { formatINR } from "@/lib/money";
import { formatTimestamp } from "@/lib/dates";
import { timelineText } from "@/lib/workflow";
import { cn } from "@/lib/utils";

type InvestigationTab = "open" | "legal" | "confirmed" | "resolved" | "all";
interface InvestigationSearch {
  tab?: InvestigationTab;
}
const TABS: InvestigationTab[] = ["open", "legal", "confirmed", "resolved", "all"];

export const Route = createFileRoute("/findings")({
  validateSearch: (search: Record<string, unknown>): InvestigationSearch => ({
    ...(TABS.includes(search["tab"] as InvestigationTab)
      ? { tab: search["tab"] as InvestigationTab }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Investigations · Contract Price Truth" },
      {
        name: "description",
        content:
          "One investigation per checked invoice line, with assessment versions, append-only decisions and a timeline.",
      },
      { property: "og:title", content: "Investigations · Contract Price Truth" },
      {
        property: "og:description",
        content: "Invoice pricing investigations with versions, decisions and a timeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvestigationsPage,
});

const inTab = (r: InvestigationRow, tab: InvestigationTab) => {
  if (tab === "all") return true;
  if (tab === "open") return r.status === "Open" || r.status === "Reopened";
  if (tab === "legal") return r.status === "With Legal";
  if (tab === "confirmed") return r.status === "Confirmed";
  return r.status === "Dismissed" || r.status === "Cleared";
};

const TAB_LABEL: Record<InvestigationTab, string> = {
  open: "Open",
  legal: "With Legal",
  confirmed: "Confirmed",
  resolved: "Dismissed or cleared",
  all: "All",
};

function InvestigationsPage() {
  const rows = useInvestigations();
  const hash = useLocation({ select: (l) => l.hash });
  const { tab = "all" } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (rows.some((r) => r.investigation.id === hash)) setSelected(hash);
  }, [hash, rows]);
  const visible = rows.filter((r) => inTab(r, tab));
  const current = rows.find((r) => r.investigation.id === selected);

  return (
    <div>
      <PageHeader title="Investigations">
        One investigation per checked invoice line. Its kind follows the latest assessment version.
        Decisions are append-only and name the version they were made against.
      </PageHeader>
      <div className="mb-5">
        <DiscrepancyTotals />
      </div>
      <div
        className="mb-4 flex gap-1 overflow-x-auto border-b"
        role="tablist"
        aria-label="Investigation statuses"
      >
        {TABS.map((id) => (
          <Link
            key={id}
            to="/findings"
            search={id === "all" ? {} : { tab: id }}
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABEL[id]}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {rows.filter((r) => inTab(r, id)).length}
            </span>
          </Link>
        ))}
      </div>
      <section className="surface overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <ClipboardList className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="text-sm font-semibold">No investigations yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              In Invoice Check, Request review on any result other than Match, or Raise
              investigation on a Potential discrepancy.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/invoice-check">
                <FilePlus2 />
                Open Invoice Check
              </Link>
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No investigations in this status.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr>
                  {["Investigation", "Line", "Kind", "Latest version", "Potential", "Status"].map(
                    (h) => (
                      <th key={h} className="table-heading">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr
                    key={r.investigation.id}
                    onClick={() => setSelected(r.investigation.id)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <td className="table-cell">
                      <span className="font-mono text-xs font-medium text-primary">
                        {r.investigation.id}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {r.assessment.id}
                        {r.assessment.fixtureId ? ` · ${r.assessment.fixtureId}` : ""} ·{" "}
                        {r.investigation.origin}
                      </span>
                    </td>
                    <td className="table-cell text-xs">
                      <LineSummary line={r.latest.inputs.line} />
                    </td>
                    <td className="table-cell text-xs">{r.kind}</td>
                    <td className="table-cell">
                      <span className="mr-1.5 font-mono text-xs">v{r.latest.n}</span>
                      <ResultStatusChip status={r.latest.result.status} />
                    </td>
                    <td className="table-cell font-mono text-xs">
                      {r.latest.result.status === "Potential discrepancy"
                        ? formatINR(r.latest.result.differencePaise!)
                        : ""}
                    </td>
                    <td className="table-cell">
                      <InvestigationStatusChip status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Sheet open={!!current} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {current && <InvestigationDetail key={current.investigation.id} row={current} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InvestigationDetail({ row }: { row: InvestigationRow }) {
  const { investigation: inv, assessment: a, latest, kind, status } = row;
  const result = latest.result;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {inv.id} · {a.id}
          </span>
          <Chip>{kind}</Chip>
          <InvestigationStatusChip status={status} />
        </div>
        <SheetTitle className="text-lg font-semibold">
          Version {latest.n}: {result.status}
        </SheetTitle>
        <SheetDescription className="text-xs">
          {inv.origin} by {inv.createdBy}, {formatTimestamp(inv.createdAt)}. No payment is blocked
          and nothing is sent to the supplier.
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <LineSummary line={latest.inputs.line} />
          <div className="mt-3">
            <ResultBody result={result} line={latest.inputs.line} compact />
          </div>
        </section>
        <NextStep row={row} />
        <section>
          <h3 className="eyebrow mb-2">Decisions (append-only)</h3>
          {inv.decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            <ul className="space-y-2">
              {inv.decisions.map((d, i) => (
                <li key={i} className="rounded-md border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={d.kind === "Confirmed" ? "danger" : "neutral"}>{d.kind}</Chip>
                    <span className="font-mono text-xs">version {d.version}</span>
                    {d.amountPaise !== null && (
                      <span className="font-mono text-xs">{formatINR(d.amountPaise)}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {d.by}, {formatTimestamp(d.at)}
                    </span>
                  </div>
                  <p className="mt-1">Reason: {d.reason}</p>
                  {d.version < latest.n && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applied to version {d.version}, since reassessed.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <VersionHistory assessment={a} />
        <section>
          <h3 className="eyebrow mb-2">Timeline</h3>
          <ol className="space-y-3 border-l pl-4">
            {inv.timeline.map((e, i) => (
              <li key={i} className="text-sm">
                <p>
                  <span className="font-medium">{e.by}</span>: {timelineText(inv, a, e)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatTimestamp(e.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** What Procurement can do next, depending on the latest version. */
function NextStep({ row }: { row: InvestigationRow }) {
  const { supplyFact, decide, catalog } = useDemo();
  const { investigation: inv, assessment: a, latest, status } = row;
  const result = latest.result;
  const supplierId = latest.inputs.line.supplierId ?? DEFAULT_SUPPLIER_ID;
  const centers = catalog.deliveryCenters[supplierId] ?? [];
  const roles = catalog.roleMaps[supplierId] ?? [];
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const needKind = result.need?.kind;

  if (result.status === "Needs information" && (needKind === "location" || needKind === "grade")) {
    const options = needKind === "location" ? centers : roles.map((r) => r.grade);
    return (
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Supply the missing fact</h3>
        <p className="text-xs text-muted-foreground">{result.need!.question}</p>
        <select
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="">Choose</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional source note, for example timesheet reference"
          maxLength={200}
        />
        <RoleGate role="procurement" action="Supplying a fact">
          <Button
            size="sm"
            disabled={!value}
            onClick={() => {
              if (supplyFact(a.id, { kind: needKind, value, note }))
                toast.success(`Recorded. ${a.id} recomputed as a new version.`);
            }}
          >
            Record and recompute
          </Button>
        </RoleGate>
      </section>
    );
  }

  if (result.status === "Awaiting verification" || result.status === "Needs Legal") {
    const ids = [...new Set((result.blockers ?? []).flatMap((b) => b.termIds))];
    return (
      <section className="rounded-md border p-4 text-sm">
        <h3 className="mb-1 font-semibold">Waiting on {result.blockers?.[0]?.owner}</h3>
        <p className="text-xs text-muted-foreground">{result.blockers?.[0]?.reason}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.status === "Needs Legal" && result.conflictId ? (
            <Link
              to="/legal/$conflictId"
              params={{ conflictId: result.conflictId }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open conflict {result.conflictId}
            </Link>
          ) : (
            ids.map((id) => (
              <Link
                key={id}
                to="/price-book"
                search={termById(id)?.kind === "rate" ? {} : { tab: "clauses" }}
                hash={id}
                className="text-xs font-medium text-primary hover:underline"
              >
                Review {id}
              </Link>
            ))
          )}
        </div>
      </section>
    );
  }

  if (result.status === "Potential discrepancy" && (status === "Open" || status === "Reopened")) {
    return (
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="text-sm font-semibold">Decision on version {latest.n}</h3>
        <p className="text-xs text-muted-foreground">
          Potential excess {formatINR(result.differencePaise!)}. A decision is recorded against this
          version and is never edited.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Reason"
        />
        <RoleGate role="procurement" action="Recording a decision">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!reason.trim()}
              onClick={() => decide(inv.id, "Confirmed", reason) && toast.success("Confirmed")}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!reason.trim()}
              onClick={() => decide(inv.id, "Dismissed", reason) && toast.success("Dismissed")}
            >
              Dismiss
            </Button>
          </div>
        </RoleGate>
      </section>
    );
  }
  return null;
}
