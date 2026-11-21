import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { LOCATIONS } from "@/data/seed";
import type { InvoiceLine, Location } from "@/data/types";
import { formatINR } from "@/lib/money";
import { formatPeriod } from "@/lib/dates";
import { describeOutcome, type PriceResult } from "@/lib/pricing-engine";
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

export function ResultBody({
  result,
  onSupplyLocation,
  compact = false,
}: {
  result: PriceResult;
  onSupplyLocation?: ((loc: Location) => void) | undefined;
  compact?: boolean;
}) {
  const hasAmounts =
    result.expectedPaise !== null && result.billedPaise !== null && result.differencePaise !== null;
  const diff = result.differencePaise ?? 0;
  return (
    <div className="space-y-4">
      {hasAmounts && (
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
      )}

      {result.outcomes && result.outcomes.length > 0 && (
        <div className="rounded-md border border-dashed p-3">
          <p className="eyebrow mb-2">
            {result.status === "Needs Legal" ? "Both readings, not decided" : "Possible outcomes"}
          </p>
          <ul className="space-y-1.5">
            {result.outcomes.map((o) => (
              <li
                key={o.label}
                className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
              >
                <span className="font-medium">{o.label}</span>
                <span className="tabular font-mono text-xs">
                  {formatINR(o.ratePaise)}/h, {describeOutcome(o)}
                  {!o.verified && (
                    <span className="text-muted-foreground"> (term not yet verified)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.need && (
        <div className="flex gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex-1 space-y-2">
            <p className="font-medium">{result.need.question}</p>
            {result.need.kind === "location" && onSupplyLocation && (
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map((l) => (
                  <button
                    key={l}
                    onClick={() => onSupplyLocation(l)}
                    className="rounded-md border bg-card px-2.5 py-1 text-xs font-medium hover:bg-accent"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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

      {result.poNote && (
        <div className="flex gap-2 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>{result.poNote}</p>
        </div>
      )}

      {result.citedTermIds.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">Cited terms</p>
          <ul className="flex flex-col gap-1">
            {result.citedTermIds.map((id) => (
              <li key={id}>
                <TermCitation termId={id} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ResultCard({
  result,
  line,
  title,
  actions,
  onSupplyLocation,
}: {
  result: PriceResult;
  line: InvoiceLine;
  title?: string;
  actions?: ReactNode;
  onSupplyLocation?: (loc: Location) => void;
}) {
  return (
    <section className="surface p-4 sm:p-5" aria-live="polite">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title ?? "Contract comparison result"}</h2>
        <ResultStatusChip status={result.status} />
      </div>
      <div className="mb-4">
        <LineSummary line={line} />
      </div>
      <ResultBody result={result} onSupplyLocation={onSupplyLocation} />
      {actions && <div className="mt-5 border-t pt-4">{actions}</div>}
    </section>
  );
}
