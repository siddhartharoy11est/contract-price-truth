import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ClipboardList, FilePlus2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/app/page-header";
import { FindingStatusChip, ResultStatusChip } from "@/components/app/chips";
import { LineSummary, ResultBody } from "@/components/app/result-card";
import { RoleGate } from "@/components/app/role-gate";
import { DiscrepancyTotals } from "@/components/app/totals";
import { LOCATIONS } from "@/data/seed";
import type { Grade } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import type { Finding } from "@/lib/findings";
import type { PriceResult } from "@/lib/pricing-engine";
import { formatINR } from "@/lib/money";
import { formatPeriod, formatTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";

type InvestigationTab = "open" | "info" | "legal" | "confirmed" | "resolved" | "all";
interface InvestigationSearch {
  tab?: InvestigationTab;
}

export const Route = createFileRoute("/findings")({
  validateSearch: (search: Record<string, unknown>): InvestigationSearch => ({
    ...(["open", "info", "legal", "confirmed", "resolved", "all"].includes(String(search["tab"]))
      ? { tab: search["tab"] as InvestigationTab }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Investigations · Contract Price Truth" },
      {
        name: "description",
        content:
          "Invoice pricing investigations raised by Finance and resolved by Procurement, with evidence and review history.",
      },
      { property: "og:title", content: "Investigations · Contract Price Truth" },
      {
        property: "og:description",
        content: "Invoice pricing investigations with contractual evidence and review history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvestigationsPage,
});

function InvestigationsPage() {
  const { state, evaluate } = useDemo();
  const hash = useLocation({ select: (l) => l.hash });
  const { tab = "open" } = Route.useSearch();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (state.findings.some((f) => f.id === hash)) setSelected(hash);
  }, [hash, state.findings]);

  const categorized = useMemo(
    () => state.findings.map((finding) => ({ finding, result: evaluate(finding.line) })),
    [state.findings, evaluate],
  );
  const matches = (finding: Finding, result: PriceResult, target: InvestigationTab) => {
    if (target === "all") return true;
    if (target === "confirmed") return finding.status === "Confirmed";
    if (target === "resolved")
      return finding.status === "Dismissed" || finding.status === "Cleared";
    if (target === "legal")
      return (
        finding.status === "With Legal" ||
        (finding.status === "Open" && result.status === "Needs Legal")
      );
    if (target === "info")
      return finding.status === "Open" && result.status === "Needs information";
    return (
      finding.status === "Open" &&
      result.status !== "Needs information" &&
      result.status !== "Needs Legal"
    );
  };
  const visible = categorized.filter(({ finding, result }) => matches(finding, result, tab));
  const tabs: { id: InvestigationTab; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "info", label: "Awaiting information" },
    { id: "legal", label: "Awaiting Legal" },
    { id: "confirmed", label: "Confirmed" },
    { id: "resolved", label: "Resolved" },
    { id: "all", label: "All" },
  ];

  return (
    <div>
      <PageHeader title="Investigations">
        Invoice pricing issues raised by Finance and investigated by Procurement. Legal decides only
        genuine contractual conflicts.
      </PageHeader>
      <div className="mb-5">
        <DiscrepancyTotals />
      </div>
      <div
        className="mb-4 flex gap-1 overflow-x-auto border-b"
        role="tablist"
        aria-label="Investigation statuses"
      >
        {tabs.map((item) => {
          const count = categorized.filter(({ finding, result }) =>
            matches(finding, result, item.id),
          ).length;
          return (
            <Link
              key={item.id}
              to="/findings"
              search={item.id === "open" ? {} : { tab: item.id }}
              role="tab"
              aria-selected={tab === item.id}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium",
                tab === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
            </Link>
          );
        })}
      </div>
      <section className="surface overflow-hidden">
        {state.findings.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <ClipboardList className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="text-sm font-semibold">No investigations yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Raise an investigation from Invoice Check when a line shows a potential discrepancy,
              needs information or needs Legal.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/invoice-check">
                <FilePlus2 />
                Open Invoice Check
              </Link>
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium">No investigations in this status</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select another status to see the saved worklist.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr>
                  {[
                    "Investigation",
                    "Supplier",
                    "Service and resource",
                    "Billed rate",
                    "Current assessment",
                    "Potential difference",
                    "Status",
                  ].map((h) => (
                    <th key={h} className="table-heading">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map(({ finding: f, result }) => (
                  <tr
                    key={f.id}
                    onClick={() => setSelected(f.id)}
                    className="cursor-pointer hover:bg-muted/40"
                  >
                    <td className="table-cell">
                      <button className="font-mono text-xs font-medium text-primary hover:underline">
                        {f.id}
                      </button>
                      {f.fixtureId && (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          Example {f.fixtureId}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-xs">BrightHire Staffing</td>
                    <td className="table-cell text-xs">
                      <span>{formatPeriod(f.line.serviceStart, f.line.serviceEnd)}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {f.line.grade} · {f.line.location || "Location not stated"} · {f.line.hours}{" "}
                        h
                      </span>
                    </td>
                    <td className="table-cell tabular font-mono text-xs">
                      {formatINR(f.line.billedRatePaise)}/h
                    </td>
                    <td className="table-cell">
                      <ResultStatusChip status={result.status} />
                    </td>
                    <td className="table-cell tabular font-mono text-xs">
                      {result.status === "Potential discrepancy" &&
                      result.differencePaise !== null ? (
                        <span className="text-danger">{formatINR(result.differencePaise)}</span>
                      ) : (
                        "Not determined"
                      )}
                    </td>
                    <td className="table-cell">
                      <FindingStatusChip status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          {selected &&
            (() => {
              const finding = state.findings.find((f) => f.id === selected);
              return finding ? (
                <InvestigationDetail
                  finding={finding}
                  result={evaluate(finding.line)}
                  onClose={() => setSelected(null)}
                />
              ) : null;
            })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InvestigationDetail({
  finding: f,
  result,
  onClose,
}: {
  finding: Finding;
  result: PriceResult;
  onClose: () => void;
}) {
  const { confirmFinding, dismissFinding, supplyFact, escalateConflict } = useDemo();
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const active = f.status === "Open";
  return (
    <div>
      <SheetHeader className="border-b p-5 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
          <FindingStatusChip status={f.status} />
          {f.fixtureId && (
            <span className="text-xs text-muted-foreground">Example {f.fixtureId}</span>
          )}
        </div>
        <SheetTitle className="text-xl font-semibold">Invoice pricing investigation</SheetTitle>
        <SheetDescription>
          BrightHire Staffing · Raised {formatTimestamp(f.createdAt)}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-5 p-5">
        <section className="rounded-md border bg-muted/30 p-4">
          <p className="eyebrow mb-2">Supplier and invoice details</p>
          <LineSummary line={f.line} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Current contractual assessment</h3>
            <ResultStatusChip status={result.status} />
          </div>
          <ResultBody result={result} compact />
        </section>
        <section className="rounded-md border p-4">
          <h3 className="mb-3 text-sm font-semibold">Available actions</h3>
          {f.status === "Confirmed" && (
            <p className="text-sm">
              Confirmed discrepancy of{" "}
              <span className="font-mono">{formatINR(f.confirmedPaise ?? 0)}</span>. Recovery is not
              tracked.
            </p>
          )}
          {f.status === "Dismissed" && (
            <p className="text-sm text-muted-foreground">Dismissed. No further action.</p>
          )}
          {f.status === "Cleared" && (
            <p className="text-sm text-muted-foreground">
              Cleared: the recalculated line matches the contract.
            </p>
          )}
          {f.status === "With Legal" && (
            <p className="text-sm">
              Waiting for a Legal decision.{" "}
              <Link to="/legal" className="text-primary hover:underline">
                Open Legal Reviews
              </Link>
            </p>
          )}
          {active && (
            <RoleGate role="procurement" action="Deciding an investigation">
              <div className="space-y-3">
                {result.status === "Potential discrepancy" && (
                  <Button
                    onClick={() => {
                      confirmFinding(f.id);
                      toast.success(`${f.id} confirmed`);
                    }}
                  >
                    Confirm discrepancy of {formatINR(result.differencePaise!)}
                  </Button>
                )}
                {result.need?.kind === "location" && (
                  <div>
                    <p className="mb-2 text-sm">Supply the delivery center:</p>
                    <div className="flex flex-wrap gap-2">
                      {LOCATIONS.map((l) => (
                        <Button
                          key={l}
                          size="sm"
                          variant="outline"
                          onClick={() => supplyFact(f.id, { location: l })}
                        >
                          {l}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {result.need?.kind === "grade" && (
                  <div>
                    <p className="mb-2 text-sm">
                      Confirm the Schedule A grade for "{f.line.grade}":
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(["L4", "L3", "L2"] as Grade[]).map((g) => (
                        <Button
                          key={g}
                          size="sm"
                          variant="outline"
                          onClick={() => supplyFact(f.id, { grade: g })}
                        >
                          {g}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {result.need?.kind === "split" && (
                  <p className="text-sm text-muted-foreground">
                    Ask Finance to resubmit this line as two lines split at the effective date, then
                    dismiss this one.
                  </p>
                )}
                {result.status === "Awaiting verification" && (
                  <p className="text-sm text-muted-foreground">
                    The governing term needs verification first.{" "}
                    <Link
                      to="/price-book"
                      {...(result.governingTermId ? { hash: result.governingTermId } : {})}
                      className="text-primary hover:underline"
                    >
                      Open in Price Book
                    </Link>
                  </p>
                )}
                {result.status === "Needs Legal" && result.conflictId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      escalateConflict(result.conflictId!, f.id);
                      toast.success(`${f.id} escalated to Legal`);
                    }}
                  >
                    Escalate to Legal
                  </Button>
                )}
                {!dismissing ? (
                  <Button variant="ghost" size="sm" onClick={() => setDismissing(true)}>
                    Dismiss investigation
                  </Button>
                ) : (
                  <div className="space-y-2 border-t pt-3">
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for dismissing"
                      rows={2}
                      maxLength={300}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={reason.trim().length < 3}
                        onClick={() => {
                          dismissFinding(f.id, reason);
                          setDismissing(false);
                        }}
                      >
                        Dismiss investigation
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDismissing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </RoleGate>
          )}
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold">Review history</h3>
          <ol className="space-y-3 border-l pl-4">
            {f.timeline.map((event, i) => (
              <li key={i} className="text-sm">
                <p>
                  <span className="font-medium">{event.by}</span>: {event.text}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatTimestamp(event.at)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="sticky bottom-0 flex justify-end border-t bg-card p-4">
        <Button variant="outline" onClick={onClose}>
          Close investigation
        </Button>
      </div>
    </div>
  );
}
