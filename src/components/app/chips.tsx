import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContractDocument, TermStatus } from "@/data/types";
import type { ResultStatus } from "@/lib/pricing-engine";
import type { InvestigationStatus } from "@/lib/workflow";

export const chipVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      tone: {
        success: "border-success/25 bg-success-soft text-success",
        info: "border-info/25 bg-info-soft text-info",
        warning: "border-warning/25 bg-warning-soft text-warning",
        danger: "border-danger/25 bg-danger-soft text-danger",
        legal: "border-legal/25 bg-legal-soft text-legal",
        neutral: "border-border bg-neutral-soft text-muted-foreground",
        primary: "border-primary/25 bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type ChipTone = NonNullable<VariantProps<typeof chipVariants>["tone"]>;

export function Chip({
  tone,
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string | undefined;
}) {
  return <span className={cn(chipVariants({ tone }), className)}>{children}</span>;
}

const termTone: Record<TermStatus, ChipTone> = {
  Verified: "success",
  Proposed: "info",
  "Needs review": "warning",
  Ignored: "neutral",
};
export function TermStatusChip({ status }: { status: TermStatus }) {
  return <Chip tone={termTone[status]}>{status}</Chip>;
}

export const resultTone: Record<ResultStatus, ChipTone> = {
  Match: "success",
  "Potential discrepancy": "danger",
  "Billed below contract": "info",
  "Awaiting verification": "neutral",
  "Needs information": "warning",
  "Needs Legal": "legal",
  "Invalid input": "neutral",
};
export function ResultStatusChip({ status }: { status: ResultStatus }) {
  return <Chip tone={resultTone[status]}>{status}</Chip>;
}

const investigationTone: Record<InvestigationStatus, ChipTone> = {
  Open: "warning",
  Reopened: "warning",
  "With Legal": "legal",
  Confirmed: "danger",
  Dismissed: "neutral",
  Cleared: "success",
};
export function InvestigationStatusChip({ status }: { status: InvestigationStatus }) {
  return <Chip tone={investigationTone[status]}>{status}</Chip>;
}

/** Every extraction result, term and run is labelled Stored (seed) or Live (uploaded), PRD M3.6. */
export function SourceLabel({
  live,
  className,
}: {
  live: boolean;
  className?: string | undefined;
}) {
  return live ? (
    <Chip tone="primary" className={className}>
      Live (uploaded)
    </Chip>
  ) : (
    <Chip tone="neutral" className={className}>
      Stored (seed)
    </Chip>
  );
}

const docTone: Record<ContractDocument["status"], ChipTone> = {
  Signed: "success",
  "Draft, unsigned": "warning",
  "Received notice": "info",
};
export function DocStatusBadge({ doc }: { doc: ContractDocument }) {
  return (
    <Chip tone={docTone[doc.status]}>
      {doc.status === "Draft, unsigned" ? "Draft, unsigned" : doc.status}
    </Chip>
  );
}
