import { useDemo } from "@/lib/demo-store";
import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { InvoiceLine, Location } from "@/data/types";
import { formatINR } from "@/lib/money";
import { formatDate, formatPeriod } from "@/lib/dates";
import {
  describeOutcome,
  type AdjustmentCheck,
  type Blocker,
  type Outcome,
  type PriceResult,
} from "@/lib/pricing-engine";
import { ResultStatusChip } from "./chips";
import { TermCitation } from "./citation";
import { cn } from "@/lib/utils";

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success" | "info";
}) {
  return (
    <div className="rounded-md border bg-background/60 px-3 py-2">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "tabular mt-0.5 font-mono text-lg font-medium",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function LineSummary({ line }: { line: InvoiceLine }) {
  return (
    <p className="text-sm text-muted-foreground">
      {formatPeriod(line.serviceStart, line.serviceEnd)} · {line.grade || "No grade"} ·{" "}
      {line.location || "Location not stated"} · {line.hours} h · billed{" "}
      {formatINR(line.billedRatePaise)}/h
      {line.poRatePaise !== null ? ` · PO ${formatINR(line.poRatePaise)}/h` : ""}
    </p>
  );
}

const OWNER_NAME: Record<Blocker["owner"], string> = {
  Finance: "Finance (Dev Mehta)",
  Procurement: "Procurement (Priya Nair)",
  Legal: "Legal (Anika Rao)",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function OutcomeRow({ o }: { o: Outcome }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
      <span className="font-medium">{o.label}</span>
      {o.provisional ? (
        <span className="text-xs text-muted-foreground">
          {o.note ?? "Provisional"}. Extracted rate {formatINR(o.ratePaise)}/h, provisional.
        </span>
      ) : (
        <span className="tabular font-mono text-xs">
          governs {formatINR(o.ratePaise)}/h, {describeOutcome(o)}
          {o.conditional && (
            <span className="text-muted-foreground"> (conditional, not a finding)</span>
          )}
        </span>
      )}
    </li>
  );
}

function AdjustmentDetails({ a }: { a: AdjustmentCheck }) {
  const rows: [string, string][] = [
    [
      "Supplier claim",
      `${a.claimTermId}: ${formatINR(a.claimedRatePaise)}/h from ${formatDate(a.effectiveFrom)}`,
    ],
    [
      "Notice",
      a.noticeDate
        ? `${formatDate(a.noticeDate)}, ${a.noticeDays} days ahead (${a.requiredNoticeDays} required)`
        : "No notice date",
    ],
    ["Base rate", a.baseRatePaise !== null ? `${formatINR(a.baseRatePaise)}/h` : "Not settled"],
    [
      "Increase applied",
      a.appliedPct !== null
        ? `${a.appliedPct}%, the lesser of the ${a.capPct}% cap and the supplier-stated index ${a.statedIndexPct}%`
        : "Unknown",
    ],
    [
      "Permitted rate",
      a.permittedRatePaise !== null ? `${formatINR(a.permittedRatePaise)}/h` : "Unknown",
    ],
  ];
  if (a.excessOverPermittedPaise > 0)
    rows.push([
      "Claim above permitted",
      `${formatINR(a.excessOverPermittedPaise)}/h, so the permitted rate governs`,
    ]);
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-[10rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-mono">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResultBody({
  result,
  line,
  onSupplyLocation,
  compact = false,
}: {
  result: PriceResult;
  line?: InvoiceLine | undefined;
  onSupplyLocation?: ((loc: Location) => void) | undefined;
  compact?: boolean;
}) {
  const hasAmounts =
    result.expectedPaise !== null && result.billedPaise !== null && result.differencePaise !== null;
  const diff = result.differencePaise ?? 0;
  const { catalog } = useDemo();
  const centers = catalog.deliveryCenters[line?.supplierId ?? "brighthire"] ?? [];
  const blockers = result.blockers ?? [];
  return (
    <div className="space-y-4">
      {hasAmounts && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Contract rate" value={`${formatINR(result.applicableRatePaise!)}/h`} />
            <Figure label="Expected" value={formatINR(result.expectedPaise!)} />
            <Figure label="Billed" value={formatINR(result.billedPaise!)} />
            <Figure
              label={diff > 0 ? "Potential excess" : diff < 0 ? "Below contract" : "Difference"}
              value={formatINR(Math.abs(diff))}
              tone={diff > 0 ? "danger" : diff < 0 ? "info" : "success"}
            />
          </div>
          {line && (
            <Section title="Calculation">
              <p className="tabular font-mono text-xs leading-relaxed">
                Expected {line.hours} h x {formatINR(result.applicableRatePaise!)} ={" "}
                {formatINR(result.expectedPaise!)}
                <br />
                Billed {line.hours} h x {formatINR(line.billedRatePaise)} ={" "}
                {formatINR(result.billedPaise!)}
                <br />
                Difference {formatINR(result.billedPaise!)} minus {formatINR(result.expectedPaise!)}{" "}
                = {formatINR(diff)}
              </p>
            </Section>
          )}
        </>
      )}

      {blockers.length > 0 && (
        <Section title="Blockers, in order">
          <ul className="space-y-2">
            {blockers.map((b, i) => (
              <li key={i} className="rounded-md border p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <ResultStatusChip status={b.status} />
                  <span className="text-xs text-muted-foreground">
                    Owner: {OWNER_NAME[b.owner]}
                  </span>
                </div>
                <p className="mt-1.5">{b.reason}</p>
                {b.termIds.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {b.termIds.map((id) => (
                      <TermCitation key={id} termId={id} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.outcomes && result.outcomes.length > 0 && (
        <div className="rounded-md border border-dashed p-3">
          <p className="eyebrow mb-2">
            {result.status === "Needs Legal"
              ? "Conditional on Legal ruling. Not a finding"
              : "Possible outcomes by delivery center"}
          </p>
          <ul className="space-y-1.5">
            {result.outcomes.map((o) => (
              <OutcomeRow key={o.label} o={o} />
            ))}
          </ul>
        </div>
      )}

      {result.need?.kind === "location" && onSupplyLocation && centers.length > 0 && (
        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex-1 space-y-2">
            <p className="font-medium">{result.need.question}</p>
            <div className="flex flex-wrap gap-2">
              {centers.map((l) => (
                <button
                  key={l}
                  onClick={() => onSupplyLocation(l)}
                  className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {result.adjustment && result.rulingApplied === "B" && (
        <Section title="Adjustment under Reading B">
          <AdjustmentDetails a={result.adjustment} />
        </Section>
      )}

      {result.poNote && (
        <div className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>{result.poNote}</p>
        </div>
      )}

      {result.citedTermIds.length > 0 && (
        <Section title="Evidence">
          <ul className="flex flex-col gap-1">
            {result.citedTermIds.map((id) => (
              <li key={id}>
                <TermCitation termId={id} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.notConsidered && result.notConsidered.length > 0 && (
        <Section title="Not considered">
          <ul className="space-y-1 text-sm">
            {result.notConsidered.map((n) => (
              <li key={n.termId} className="flex flex-wrap items-baseline gap-x-2">
                <TermCitation termId={n.termId} />
                <span className="text-xs text-muted-foreground">{n.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div>
        {!compact && <p className="eyebrow mb-1.5">Explanation</p>}
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {result.explanation.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ResultCard({
  result,
  line,
  title,
  actions,
  onSupplyLocation,
  meta,
}: {
  result: PriceResult;
  line: InvoiceLine;
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  onSupplyLocation?: (loc: Location) => void;
}) {
  return (
    <section className="surface p-4 sm:p-5" aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title ?? "Contract comparison result"}</h2>
        <ResultStatusChip status={result.status} />
      </div>
      <div className="mb-4 space-y-1">
        <LineSummary line={line} />
        {meta}
      </div>
      <ResultBody result={result} line={line} onSupplyLocation={onSupplyLocation} />
      {actions && <div className="mt-5 border-t pt-4">{actions}</div>}
    </section>
  );
}
