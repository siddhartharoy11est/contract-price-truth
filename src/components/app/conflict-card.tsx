import type { ReactNode } from "react";
import { Scale } from "lucide-react";
import type { Conflict } from "@/data/types";
import { termById } from "@/data/seed";
import { useDemo } from "@/lib/demo-store";
import { formatTimestamp } from "@/lib/dates";
import { Chip } from "./chips";
import { TermCitation } from "./citation";

export function ConflictCard({ conflict, children }: { conflict: Conflict; children?: ReactNode }) {
  const { state } = useDemo();
  const ruling = state.rulings[conflict.id];
  const escalation = state.escalations[conflict.id];
  return (
    <section id={conflict.id} className="surface scroll-mt-24 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex gap-3">
          <Scale className="mt-0.5 size-5 shrink-0 text-legal" />
          <div>
            <p className="eyebrow">
              Conflict {conflict.id} · Terms {conflict.termIds.join(", ")}
            </p>
            <h3 className="mt-1 text-base font-semibold leading-snug">{conflict.question}</h3>
          </div>
        </div>
        {ruling ? (
          <Chip tone="success">Decided: Reading {ruling.reading}</Chip>
        ) : escalation ? (
          <Chip tone="legal">With Legal</Chip>
        ) : (
          <Chip tone="warning">Not decided</Chip>
        )}
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        {conflict.readings.map((r) => (
          <div key={r.reading} className="bg-card p-5">
            <p className="eyebrow mb-1">Reading {r.reading}</p>
            <p className="font-medium">{r.summary}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.detail}</p>
            <ul className="mt-4 space-y-3">
              {r.termIds.map((id) => (
                <li key={id} className="text-sm">
                  <TermCitation termId={id} />
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    "{termById(id)?.quote}"
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {ruling && (
        <div className="border-t bg-success-soft/40 px-5 py-3 text-sm">
          <span className="font-medium">Decision by {ruling.by}</span>, {formatTimestamp(ruling.at)}
          : Reading {ruling.reading}. "{ruling.reasoning}"
        </div>
      )}
      {children && <div className="border-t px-5 py-4">{children}</div>}
    </section>
  );
}
