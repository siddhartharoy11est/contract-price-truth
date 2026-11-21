import { Database } from "lucide-react";
import { Chip } from "./chips";

/**
 * Seeded documents use their stored extraction. The old live re-read of a seed document
 * through the Lovable gateway is removed; live extraction now runs only for uploaded
 * documents through the guarded server function.
 */
export function LiveReadPanel({ docId }: { docId: string }) {
  return (
    <section aria-labelledby={`stored-${docId}`} className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 id={`stored-${docId}`} className="text-sm font-semibold">
          Stored demo extraction
        </h2>
        <Chip tone="info">Stored demo</Chip>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        The terms for this seeded document come from a stored extraction, checked against the document text. Live
        re-reading of seeded documents is turned off. Live extraction is available for uploaded documents and is
        limited by daily caps.
      </p>
    </section>
  );
}
