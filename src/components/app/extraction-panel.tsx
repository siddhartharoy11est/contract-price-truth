import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Database, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ContractDocument } from "@/data/types";
import { runsFor, type ExtractionRun } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { formatTimestamp } from "@/lib/dates";
import { extractDocumentFn } from "@/lib/extract.functions";
import type { ExtractResponse } from "@/lib/extraction/guard";
import { pageMarkedText } from "@/lib/uploads";
import { Chip, SourceLabel } from "./chips";

/** Plain reasons for each failure code, shown with the server's own message. */
const REASON: Record<string, string> = {
  disabled: "Live extraction is switched off.",
  not_configured: "Live extraction is not configured on this server.",
  client_limit: "Daily limit for this connection reached.",
  capacity: "Daily limit for everyone reached.",
  store_unavailable: "Usage counter unavailable, so the call was refused.",
  too_large: "Document too large for live extraction.",
  invalid_request: "The request was not valid.",
  extraction_failed: "The model call failed.",
  network: "The server could not be reached.",
};

/**
 * Journey D4, D5 and D9. Seed documents show their Stored run. Uploaded documents offer
 * Extract Prices, which calls the guarded server function. A failure records a Failed run
 * with its reason and leaves everything else as it was.
 */
export function ExtractionPanel({ doc }: { doc: ContractDocument }) {
  const { state, recordExtraction, role } = useDemo();
  const extract = useServerFn(extractDocumentFn);
  const [running, setRunning] = useState(false);
  const live = doc.source === "Live";
  const runs = runsFor(state.uploads, doc);
  const last = runs.at(-1);
  const completed = runs.some((r) => r.status === "Completed");

  const start = async () => {
    setRunning(true);
    let res: ExtractResponse;
    try {
      res = await extract({
        data: {
          documentType: doc.kind as never,
          signingStatus:
            doc.status === "Signed"
              ? "Signed"
              : doc.status === "Received notice"
                ? "Received notice"
                : "Unsigned draft",
          text: pageMarkedText(doc.clauses.map((c) => c.text)),
        },
      });
    } catch {
      res = {
        ok: false,
        code: "network" as never,
        message:
          "The server could not be reached. Check your connection and retry. The stored demo keeps working.",
      };
    }
    recordExtraction(doc.id, res);
    setRunning(false);
  };

  if (!live) {
    return (
      <section className="surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Extraction run</h2>
          <SourceLabel live={false} />
          <Chip tone="success">Completed</Chip>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          The terms for this seed document come from a stored extraction, checked against the
          document text. It needs no API call. Live extraction is for uploaded documents.
        </p>
      </section>
    );
  }

  return (
    <section className="surface p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold">Extract Prices</h2>
        <SourceLabel live />
        {running ? <Chip tone="info">Running</Chip> : last && <RunChip run={last} />}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sends this document's page-marked text to the Claude API through the server. The AI only
        proposes rate terms. Every quote is re-checked against the page text, and nothing becomes
        Verified until Procurement reviews it.
      </p>

      {running && (
        <p className="mt-3 flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Running live extraction. This can take up to a
          minute.
        </p>
      )}

      {!running && last?.status === "Completed" && <CompletedSummary run={last} />}

      {!running && last?.status === "Failed" && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-danger/30 bg-danger-soft p-3 text-sm"
        >
          <p className="flex items-center gap-2 font-medium text-danger">
            <AlertTriangle className="size-4" /> Run failed:{" "}
            {REASON[last.code ?? ""] ?? "Unknown reason."}
          </p>
          <p className="mt-1 text-xs">{last.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No terms were created and the stored demo is unchanged.
          </p>
        </div>
      )}

      {!running && !completed && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {role.id === "procurement" ? (
            <Button size="sm" onClick={() => void start()}>
              {last?.status === "Failed" ? (
                <RotateCcw className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {last?.status === "Failed" ? "Retry" : "Extract Prices"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Switch to Priya (Procurement) to run extraction.
            </p>
          )}
        </div>
      )}

      {runs.length > 1 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Run history ({runs.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{r.id}</span>
                <RunChip run={r} />
                <span className="text-muted-foreground">{formatTimestamp(r.at)}</span>
                {r.status === "Failed" && <span>{REASON[r.code ?? ""]}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RunChip({ run }: { run: ExtractionRun }) {
  return run.status === "Completed" ? (
    <Chip tone="success">Completed</Chip>
  ) : (
    <Chip tone="danger">Failed</Chip>
  );
}

function CompletedSummary({ run }: { run: ExtractionRun }) {
  return (
    <div className="mt-3 rounded-md border p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-success" /> Live run {run.id} completed
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Terms proposed</dt>
          <dd className="font-mono text-base">{run.accepted}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rejected quotes</dt>
          <dd className="font-mono text-base">{run.rejected}</dd>
        </div>
      </dl>
      {run.rejections.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Why items were rejected
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {run.rejections.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        New terms are Proposed or Needs review, never Verified. Review them in the{" "}
        <Link to="/price-book" className="text-primary hover:underline">
          Price Book
        </Link>
        .
      </p>
    </div>
  );
}
