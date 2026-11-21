import { useState } from "react";
import { formatTimestamp } from "@/lib/dates";
import { describeResult, type Assessment } from "@/lib/workflow";
import { ResultStatusChip } from "./chips";
import { LineSummary, ResultBody } from "./result-card";

/** Every version of a saved check, newest first. Earlier versions are read only. */
export function VersionHistory({ assessment }: { assessment: Assessment }) {
  const [shown, setShown] = useState<number | null>(null);
  const versions = [...assessment.versions].reverse();
  return (
    <section className="surface p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold">Version history</h3>
      <ol className="space-y-2">
        {versions.map((v) => (
          <li key={v.n} className="rounded-md border p-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium">v{v.n}</span>
              <ResultStatusChip status={v.result.status} />
              <span className="flex-1 text-xs text-muted-foreground">
                {formatTimestamp(v.at)} · {v.by} · {v.trigger}
              </span>
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setShown(shown === v.n ? null : v.n)}
              >
                {shown === v.n ? "Hide" : "View"}
              </button>
            </div>
            <p className="mt-1 text-xs">{describeResult(v.result)}</p>
            {shown === v.n && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <LineSummary line={v.inputs.line} />
                <ResultBody result={v.result} line={v.inputs.line} compact />
              </div>
            )}
          </li>
        ))}
      </ol>
      {assessment.facts.length > 0 && (
        <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {assessment.facts.map((f, i) => (
            <p key={i}>
              {f.by} supplied {f.kind === "location" ? "delivery center" : "role"} {f.value} on{" "}
              {formatTimestamp(f.at)} (version {f.version})
              {f.note ? `. Source note: ${f.note}` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
