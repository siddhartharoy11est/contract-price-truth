import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useDemo } from "@/lib/demo-store";

export const clauseAnchor = (clauseId: string) => `clause-${clauseId.replace(/\s+/g, "-")}`;

/** How a term's location in its document is shown: a clause, a row, a letter or a page. */
export function locatorText(clauseId: string): string {
  if (/^p\d+$/.test(clauseId)) return `page ${clauseId.slice(1)}`;
  if (clauseId.startsWith("Row") || clauseId.startsWith("Note") || clauseId === "Letter")
    return clauseId;
  return `cl. ${clauseId}`;
}

/** Links a term to its document and clause (or page, for an uploaded document). */
export function TermCitation({
  termId,
  showQuote = false,
}: {
  termId: string;
  showQuote?: boolean;
}) {
  const { catalog } = useDemo();
  const t = catalog.terms.find((x) => x.id === termId);
  if (!t) return null;
  const doc = catalog.documents.find((d) => d.id === t.docId);
  return (
    <span className="inline">
      <Link
        to="/documents/$docId"
        params={{ docId: t.docId }}
        hash={clauseAnchor(t.clauseId)}
        className="font-mono text-xs text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      >
        {t.id} · {doc?.title} {locatorText(t.clauseId)}
        {t.source === "Live" && " (Live, uploaded)"}
      </Link>
      {showQuote && (
        <span className="mt-1 block text-sm text-muted-foreground">
          "<mark>{t.quote}</mark>"
        </span>
      )}
    </span>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds a quote in text, exactly or with any run of whitespace standing for any other. */
function findQuote(text: string, quote: string): [number, number] | null {
  const i = text.indexOf(quote);
  if (i >= 0) return [i, i + quote.length];
  const parts = quote.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const m = new RegExp(parts.map(escapeRe).join("\\s+")).exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}

/** Renders text with one or more exact quotes highlighted, where they appear. */
export function QuoteHighlight({
  text,
  quote,
  extra = [],
}: {
  text: string;
  quote?: string | null | undefined;
  extra?: string[];
}) {
  const spans = [quote, ...extra]
    .filter((q): q is string => !!q)
    .map((q) => findQuote(text, q))
    .filter((x): x is [number, number] => !!x)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  spans.forEach(([s, e], k) => {
    if (s < at) return;
    out.push(text.slice(at, s), <mark key={k}>{text.slice(s, e)}</mark>);
    at = e;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}
