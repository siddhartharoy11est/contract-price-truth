import { Link } from "@tanstack/react-router";
import { docById, termById } from "@/data/seed";

export const clauseAnchor = (clauseId: string) => `clause-${clauseId.replace(/\s+/g, "-")}`;

/** Links a term to its document and clause. */
export function TermCitation({ termId, showQuote = false }: { termId: string; showQuote?: boolean }) {
  const t = termById(termId);
  if (!t) return null;
  const doc = docById(t.docId);
  return (
    <span className="inline">
      <Link
        to="/documents/$docId"
        params={{ docId: t.docId }}
        hash={clauseAnchor(t.clauseId)}
        className="font-mono text-xs text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      >
        {t.id} · {doc?.title} {t.clauseId.startsWith("Row") || t.clauseId.startsWith("Note") || t.clauseId === "Letter" ? t.clauseId : `cl. ${t.clauseId}`}
      </Link>
      {showQuote && <span className="mt-1 block text-sm text-muted-foreground">"<mark>{t.quote}</mark>"</span>}
    </span>
  );
}

/** Renders text with an exact quote highlighted, if it appears. */
export function QuoteHighlight({ text, quote }: { text: string; quote?: string | null | undefined }) {
  if (!quote) return <>{text}</>;
  const i = text.indexOf(quote);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{quote}</mark>
      {text.slice(i + quote.length)}
    </>
  );
}
