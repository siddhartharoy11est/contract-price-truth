import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { documentPlainText } from "@/data/seed";
import { getLiveAiStatus, rereadDocument } from "@/lib/ai.functions";
import { useDemo } from "@/lib/demo-store";
import { compareLiveRead, extractJson, type LiveVerdict } from "@/lib/live-read";
import { formatTimestamp } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { Chip, SourceLabel, type ChipTone } from "./chips";

const verdictTone: Record<LiveVerdict, ChipTone> = { Agrees: "success", Differs: "danger", Extra: "warning" };

export function LiveReadPanel({ docId }: { docId: string }) {
  const { state, saveLiveRead } = useDemo();
  const statusFn = useServerFn(getLiveAiStatus);
  const rereadFn = useServerFn(rereadDocument);
  const aiStatus = useQuery({ queryKey: ["live-ai-status"], queryFn: () => statusFn(), staleTime: 60_000 });
  const [busy, setBusy] = useState(false);
  const record = state.liveReads[docId];
  const configured = aiStatus.data?.configured === true;

  const run = async () => {
    setBusy(true);
    const at = new Date().toISOString();
    try {
      const res = await rereadFn({ data: { docId } });
      if (!res.ok) {
        saveLiveRead(docId, { at, ok: false, message: res.message });
        return;
      }
      let parsed: unknown;
      try {
        parsed = extractJson(res.raw);
      } catch {
        saveLiveRead(docId, { at, ok: false, message: "The live response was not valid JSON, so it was discarded. The stored extraction is still in use." });
        return;
      }
      const outcome = compareLiveRead(docId, documentPlainText(docId), parsed);
      saveLiveRead(docId, { at, ok: true, model: res.model, outcome });
    } catch {
      saveLiveRead(docId, { at, ok: false, message: "The live AI call failed. The stored extraction is still in use." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="eyebrow">Second read</p>
          <h2 className="font-display text-xl">Re-read with Claude</h2>
        </div>
        <Button onClick={run} disabled={busy || !configured} variant={configured ? "default" : "outline"}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {aiStatus.isPending ? "Checking live AI" : !configured ? "Live AI not configured" : busy ? "Reading" : "Re-read with Claude"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Claude reads only this document's text and proposes rate terms with exact quotes. Code then checks the JSON shape,
        rejects any quote that is not in the text, and compares the rest with the stored extraction. Any difference sends the
        stored term back for re-verification.
      </p>

      {!record && <p className="mt-4 text-sm text-muted-foreground">No live read yet. The Price Book uses the stored extraction.</p>}

      {record && !record.ok && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">
          <p className="font-medium">Live read did not complete ({formatTimestamp(record.at)})</p>
          <p className="text-muted-foreground">{record.message}</p>
        </div>
      )}

      {record?.ok && record.outcome && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SourceLabel live />
            <span>
              {record.model} · {formatTimestamp(record.at)}
            </span>
          </div>
          {record.outcome.comparisons.length === 0 && record.outcome.rejected.length === 0 && (
            <p className="text-sm">No rate terms returned for this document.</p>
          )}
          {record.outcome.comparisons.length > 0 && (
            <ul className="divide-y rounded-md border">
              {record.outcome.comparisons.map((c, i) => (
                <li key={i} className="space-y-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={verdictTone[c.verdict]}>{c.verdict}</Chip>
                    <span className="font-mono text-xs">
                      {c.live.grade ?? "grade null"} · {c.live.location ?? "location null"} ·{" "}
                      {c.live.rate_inr_per_hour === null ? "rate null" : typeof c.live.rate_inr_per_hour === "number" ? `${formatINR(Math.round(c.live.rate_inr_per_hour * 100))}/h` : c.live.rate_inr_per_hour} · {c.live.effective_date ?? "date null"} · cl.{" "}
                      {c.live.clause ?? "null"}
                    </span>
                    {c.storedTermId && <span className="text-xs text-muted-foreground">vs stored {c.storedTermId}</span>}
                  </div>
                  <p className="text-muted-foreground">"{c.live.quote}"</p>
                  {c.differences.length > 0 && <p className="text-xs text-danger">Differs on: {c.differences.join("; ")}</p>}
                </li>
              ))}
            </ul>
          )}
          {record.outcome.rejected.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm">
              <p className="font-medium">Rejected ({record.outcome.rejected.length})</p>
              <ul className="mt-1 space-y-1 text-xs">
                {record.outcome.rejected.map((r, i) => (
                  <li key={i}>
                    {r.reason}{" "}
                    {typeof r.live === "object" && r.live && "quote" in r.live ? `Quote: "${String((r.live as { quote: unknown }).quote)}"` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {record.outcome.missedStoredIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Stored terms the live read did not return: {record.outcome.missedStoredIds.join(", ")}. Shown for information.
            </p>
          )}
          {record.outcome.differingStoredIds.length > 0 && (
            <p className="text-sm text-danger">
              Flagged "Second read differs" and sent back for re-verification: {record.outcome.differingStoredIds.join(", ")}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
