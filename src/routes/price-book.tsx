import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { FileCheck2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/app/page-header";
import { Chip, SourceLabel, TermStatusChip } from "@/components/app/chips";
import { QuoteHighlight, TermCitation } from "@/components/app/citation";
import { ConflictCard } from "@/components/app/conflict-card";
import { RoleGate } from "@/components/app/role-gate";
import { CONFLICTS } from "@/data/seed";
import { DISPUTE_START, DISPUTE_HINT } from "@/lib/demo-hints";
import type { SeedTerm } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import { formatINR, parseRupees } from "@/lib/money";
import { formatDate, formatTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { aiOriginal, currentValue, type EditableField, type FieldValue } from "@/lib/term-state";
import { canVerify, isUnsigned as isUnsignedIn } from "@/lib/workflow";
import { quoteInDocument, valueSupported } from "@/lib/evidence";

type PriceBookTab = "rates" | "clauses" | "pending";
interface PriceBookSearch {
  tab?: PriceBookTab;
}

export const Route = createFileRoute("/price-book")({
  validateSearch: (search: Record<string, unknown>): PriceBookSearch => ({
    ...(search["tab"] === "clauses" || search["tab"] === "pending" ? { tab: search["tab"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Price Book · Contract Price Truth" },
      {
        name: "description",
        content:
          "Effective-dated BrightHire rates and clauses with exact source citations and Procurement verification.",
      },
      { property: "og:title", content: "Price Book · Contract Price Truth" },
      {
        property: "og:description",
        content:
          "Effective-dated BrightHire rates and clauses with exact source citations and Procurement verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PriceBookPage,
});

const locLabel = (t: SeedTerm, loc: string | null = t.location) =>
  loc === "all"
    ? "All centers"
    : loc
      ? `${loc} only`
      : t.source === "Live"
        ? "Not stated"
        : "Not applicable";
const selectClass = "h-9 rounded-md border border-input bg-card px-2.5 text-xs";

/** Seed plus uploaded terms, documents and role maps, from the demo store. */
function useCatalog() {
  const { catalog, state } = useDemo();
  return {
    TERMS: catalog.terms,
    termById: (id: string) => catalog.terms.find((t) => t.id === id),
    docById: (id: string) => catalog.documents.find((d) => d.id === id),
    centersOf: (supplierId: string) => catalog.deliveryCenters[supplierId] ?? [],
    ROLE_MAPS: catalog.roleMaps,
    documents: catalog.documents,
    isUnsigned: (id: string) => isUnsignedIn(id, state.uploads),
  };
}

function PriceBookPage() {
  const { TERMS, termById } = useCatalog();
  const { state } = useDemo();
  const hash = useLocation({ select: (l) => l.hash });
  const { tab = "rates" } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [location, setLocation] = useState("all");

  useEffect(() => {
    if (hash && termById(hash)) setSelected(hash);
  }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TERMS.filter((t) => {
      const ts = state.terms[t.id]!;
      const tabMatch =
        tab === "rates"
          ? t.kind === "rate" || t.kind === "draft"
          : tab === "clauses"
            ? t.kind === "clause" || t.kind === "notice"
            : ts.status === "Proposed" || ts.status === "Needs review" || ts.secondReadDiffers;
      const queryMatch =
        !q ||
        [t.id, t.title, t.docId, t.grade ?? "", t.location ?? ""].some((v) =>
          v.toLowerCase().includes(q),
        );
      return (
        tabMatch &&
        queryMatch &&
        (status === "all" || ts.status === status) &&
        (grade === "all" || t.grade === grade) &&
        (location === "all" ||
          t.location === location ||
          (location === "all-centers" && t.location === "all"))
      );
    });
  }, [TERMS, tab, query, status, grade, location, state.terms]);

  const pendingCount = TERMS.filter((t) => {
    const ts = state.terms[t.id]!;
    return ts.status === "Proposed" || ts.status === "Needs review" || ts.secondReadDiffers;
  }).length;
  const setTab = (next: PriceBookTab) => {
    void navigate({
      to: "/price-book",
      search: next === "rates" ? {} : { tab: next },
      replace: true,
    });
  };
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setGrade("all");
    setLocation("all");
  };

  return (
    <div>
      <PageHeader title="Price Book">
        Verified, effective-dated commercial terms. Seed terms come from a Stored extraction and
        uploaded terms from a Live extraction. Only Verified terms can drive an invoice result.
      </PageHeader>
      <div
        className="mb-4 flex flex-wrap items-center gap-1 border-b"
        role="tablist"
        aria-label="Price Book sections"
      >
        {(
          [
            {
              id: "rates",
              label: "Rates",
              count: TERMS.filter((t) => t.kind === "rate" || t.kind === "draft").length,
            },
            {
              id: "clauses",
              label: "Contractual Clauses",
              count: TERMS.filter((t) => t.kind === "clause" || t.kind === "notice").length,
            },
            { id: "pending", label: "Pending Verification", count: pendingCount },
          ] as { id: PriceBookTab; label: string; count: number }[]
        ).map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium",
              tab === item.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px]",
                tab === item.id ? "bg-accent" : "bg-muted",
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 text-xs"
              placeholder="Search terms, IDs or source agreements"
              aria-label="Search Price Book"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex">
            <select
              className={selectClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by verification status"
            >
              <option value="all">All statuses</option>
              {["Verified", "Proposed", "Needs review", "Ignored"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              className={selectClass}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              aria-label="Filter by grade"
            >
              <option value="all">All grades</option>
              {[...new Set(TERMS.map((t) => t.grade).filter((g): g is string => !!g))].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <select
              className={selectClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Filter by delivery location"
            >
              <option value="all">All locations</option>
              <option value="all-centers">All centers</option>
              {[
                ...new Set(
                  TERMS.map((t) => t.location).filter((l): l is string => !!l && l !== "all"),
                ),
              ].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        </div>
        <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "term" : "terms"} shown
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FileCheck2 className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No terms match this view</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Change the filters or select another Price Book section.
            </p>
          </div>
        ) : tab === "clauses" ? (
          <ClauseTable terms={filtered} onSelect={setSelected} />
        ) : (
          <RateTable terms={filtered} onSelect={setSelected} pending={tab === "pending"} />
        )}
      </section>

      {tab === "clauses" && (
        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Contractual conflicts</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open a clause to review it. Choosing Disputed sends the conflict to Legal with your
              question. A Legal ruling never verifies the clauses.
            </p>
          </div>
          {CONFLICTS.map((c) => (
            <ConflictCard key={c.id} conflict={c}>
              <ConflictCaseNote conflictId={c.id} />
            </ConflictCard>
          ))}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {selected && (
            <ReviewPanel key={selected} termId={selected} onDone={() => setSelected(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RateTable({
  terms,
  onSelect,
  pending,
}: {
  terms: SeedTerm[];
  onSelect: (id: string) => void;
  pending: boolean;
}) {
  const { isUnsigned } = useCatalog();
  const { state } = useDemo();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr>
            {[
              "Term / job role",
              "Grade",
              "Delivery location",
              "Contracted rate",
              "Effective date",
              "Source agreement",
              "Verification status",
            ].map((h) => (
              <th key={h} className="table-heading">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {terms.map((t) => {
            const ts = state.terms[t.id]!;
            const rate = currentValue(t, ts, "ratePaise") as number | null;
            const link = ts.override;
            return (
              <tr
                key={t.id}
                data-tour={`term-${t.id}`}
                onClick={() => onSelect(t.id)}
                className="cursor-pointer hover:bg-muted/40"
              >
                <td className="table-cell">
                  <button className="text-left font-medium text-primary hover:underline">
                    {t.title}
                  </button>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {t.id}
                    {t.source === "Live" ? " · Live (uploaded)" : " · Stored (seed)"}
                    {link
                      ? ` · Overrides ${link.target}${t.location !== "all" ? ` for ${t.location}` : ""}${link.confirmed ? ", link confirmed" : ", link not confirmed"}`
                      : ""}
                  </span>
                  {pending && ts.secondReadDiffers && (
                    <span className="mt-1 block text-[11px] text-danger">
                      Live second read differs. Re-verification required.
                    </span>
                  )}
                </td>
                <td className="table-cell text-xs">
                  {(currentValue(t, ts, "grade") as string | null) ??
                    (t.source === "Live" ? "Unknown" : "Any")}
                </td>
                <td className="table-cell text-xs">
                  {locLabel(t, currentValue(t, ts, "location") as string | null)}
                </td>
                <td className="table-cell whitespace-nowrap">
                  <span className="tabular font-mono text-xs font-medium">
                    {rate !== null ? `${formatINR(rate)}/h` : "Not a rate"}
                  </span>
                  {rate !== t.ratePaise && t.ratePaise !== null && (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      AI proposed {formatINR(t.ratePaise!)}
                    </span>
                  )}
                </td>
                <td className="table-cell whitespace-nowrap text-xs">
                  {t.effectiveFrom ? formatDate(t.effectiveFrom) : "Not stated"}
                </td>
                <td className="table-cell text-xs text-muted-foreground">
                  {t.docId}
                  <span className="block">{t.clauseId}</span>
                </td>
                <td className="table-cell">
                  <div className="flex flex-col items-start gap-1">
                    <TermStatusChip status={isUnsigned(t.id) ? "Ignored" : ts.status} />
                    {t.conflictId && !state.rulings[t.conflictId] && (
                      <Chip tone="legal">Conflict {t.conflictId}</Chip>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClauseTable({ terms, onSelect }: { terms: SeedTerm[]; onSelect: (id: string) => void }) {
  const { state } = useDemo();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr>
            {[
              "Clause or notice",
              "Type",
              "Applicability",
              "Source agreement",
              "Verification status",
            ].map((h) => (
              <th key={h} className="table-heading">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {terms.map((t) => {
            const ts = state.terms[t.id]!;
            return (
              <tr
                key={t.id}
                data-tour={`term-${t.id}`}
                onClick={() => onSelect(t.id)}
                className="cursor-pointer hover:bg-muted/40"
              >
                <td className="table-cell">
                  <button className="text-left font-medium text-primary hover:underline">
                    {t.title}
                  </button>
                  <span className="mt-0.5 block max-w-lg truncate text-xs text-muted-foreground">
                    "{t.quote}"
                  </span>
                </td>
                <td className="table-cell capitalize text-xs">{t.kind}</td>
                <td className="table-cell text-xs">
                  {t.effectiveFrom
                    ? `From ${formatDate(t.effectiveFrom)}`
                    : t.grade
                      ? `Grade ${t.grade}`
                      : "Agreement-wide"}
                  {t.noticeDate && (
                    <span className="mt-0.5 block text-muted-foreground">
                      Notice {formatDate(t.noticeDate)}
                    </span>
                  )}
                </td>
                <td className="table-cell text-xs text-muted-foreground">
                  {t.docId}
                  <span className="block">{t.clauseId}</span>
                </td>
                <td className="table-cell">
                  <TermStatusChip status={ts.status} />
                  {ts.interpretation && (
                    <span className="mt-1 block text-[11px]">{ts.interpretation.choice}</span>
                  )}
                  {t.conflictId && (
                    <span className="mt-1 block text-[11px] text-legal">
                      Conflict {t.conflictId}: {state.conflictCases[t.conflictId]?.status ?? "Open"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const FIELD_LABEL: Record<EditableField, string> = {
  ratePaise: "Rate (₹ per hour)",
  grade: "Role or grade",
  location: "Delivery location",
  effectiveFrom: "Effective from",
  effectiveTo: "Effective to",
};
const RATE_FIELDS: EditableField[] = [
  "ratePaise",
  "grade",
  "location",
  "effectiveFrom",
  "effectiveTo",
];

function showValue(field: EditableField, v: FieldValue): string {
  if (v === null || v === "") return "Not stated";
  if (field === "ratePaise") return `${formatINR(Number(v))}/h`;
  if (field === "location") return v === "all" ? "All centers" : String(v);
  if (field === "effectiveFrom" || field === "effectiveTo") return formatDate(String(v));
  return String(v);
}

function PanelHeader({ t }: { t: SeedTerm }) {
  const { docById, isUnsigned } = useCatalog();
  const { state } = useDemo();
  const ts = state.terms[t.id]!;
  const doc = docById(t.docId)!;
  return (
    <SheetHeader className="shrink-0 border-b p-5 pr-12 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
        <TermStatusChip status={isUnsigned(t.id) ? "Ignored" : ts.status} />
        {ts.secondReadDiffers && <Chip tone="danger">Second read differs</Chip>}
        <SourceLabel live={t.source === "Live"} />
      </div>
      <SheetTitle className="text-xl font-semibold tracking-tight">{t.title}</SheetTitle>
      <SheetDescription className="text-xs">
        {doc.title} ({doc.id}), {t.clauseId}. {doc.dateLine}
      </SheetDescription>
    </SheetHeader>
  );
}

function QuoteInContext({ t }: { t: SeedTerm }) {
  const { docById } = useCatalog();
  const doc = docById(t.docId)!;
  return (
    <section className="paper-sheet p-4">
      <h3 className="eyebrow mb-3">Quote in context</h3>
      <div className="space-y-3">
        {doc.clauses.map((c) => (
          <div key={c.id} className={c.id === t.clauseId ? "" : "opacity-45"}>
            <p className="font-mono text-[11px] text-muted-foreground">{c.label}</p>
            <p className="mt-0.5 text-sm leading-relaxed">
              <QuoteHighlight text={c.text} quote={c.id === t.clauseId ? t.quote : null} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function History({ t }: { t: SeedTerm }) {
  const { state } = useDemo();
  const ts = state.terms[t.id]!;
  return (
    <section>
      <h3 className="eyebrow mb-3">Review history</h3>
      {ts.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t.initialStatus === "Verified"
            ? "Verified in the seed data before this session."
            : "No review actions yet."}
        </p>
      ) : (
        <ol className="space-y-3 border-l pl-4">
          {ts.history.map((h, i) => (
            <li key={i} className="text-sm">
              <p>
                <span className="font-medium">{h.by}</span>: {h.action}
              </p>
              {h.reason && <p className="mt-0.5 text-muted-foreground">"{h.reason}"</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">{formatTimestamp(h.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReviewPanel({ termId, onDone }: { termId: string; onDone: () => void }) {
  const { termById } = useCatalog();
  const t = termById(termId)!;
  return t.kind === "clause" || t.kind === "notice" ? (
    <ClauseReviewPanel t={t} onDone={onDone} />
  ) : (
    <RateReviewPanel t={t} onDone={onDone} />
  );
}

function CorrectionForm({ t }: { t: SeedTerm }) {
  const { docById, centersOf, ROLE_MAPS, documents } = useCatalog();
  const { state, correctField } = useDemo();
  const ts = state.terms[t.id]!;
  const centers = centersOf(docById(t.docId)!.supplierId);
  const roleMap = ROLE_MAPS[docById(t.docId)!.supplierId] ?? [];
  const [field, setField] = useState<EditableField>("ratePaise");
  const [text, setText] = useState("");
  const [quote, setQuote] = useState(t.quote);
  const [allConfirmed, setAllConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  const parsed: FieldValue | undefined =
    field === "ratePaise"
      ? (parseRupees(text) ?? undefined)
      : text.trim()
        ? text.trim()
        : field === "effectiveTo"
          ? null
          : undefined;
  const preview =
    parsed !== undefined
      ? valueSupported(field, parsed, [t.quote, quote], {
          supplierId: docById(t.docId)!.supplierId,
          allLocationsConfirmed: allConfirmed,
          roleMaps: ROLE_MAPS,
        })
      : false;
  const quoteOk = quoteInDocument(t.docId, quote, documents);

  const input =
    field === "grade" ? (
      <select
        className={selectClass + " w-full"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      >
        <option value="">Choose</option>
        {roleMap.map((r) => (
          <option key={r.grade} value={r.grade}>
            {r.grade}, {r.role}
          </option>
        ))}
      </select>
    ) : field === "location" ? (
      <select
        className={selectClass + " w-full"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      >
        <option value="">Choose</option>
        <option value="all">All centers</option>
        {centers.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    ) : field === "effectiveFrom" || field === "effectiveTo" ? (
      <Input type="date" value={text} onChange={(e) => setText(e.target.value)} />
    ) : (
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        inputMode="decimal"
        className="font-mono"
        placeholder="For example 1050"
      />
    );

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Correct a field</h3>
      <p className="text-xs text-muted-foreground">
        The AI original stays visible. A correction needs a source quote from this document. Editing
        a Verified term returns it to Needs review and recomputes dependent checks.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="eyebrow">Field</span>
          <select
            className={selectClass + " mt-1 w-full"}
            value={field}
            onChange={(e) => {
              setField(e.target.value as EditableField);
              setText("");
            }}
          >
            {RATE_FIELDS.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="eyebrow">New value</span>
          <div className="mt-1">{input}</div>
        </label>
      </div>
      <label className="block text-sm">
        <span className="eyebrow">Source quote</span>
        <Textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={2}
          className="mt-1"
        />
        <span
          className={cn("mt-1 block text-xs", quoteOk ? "text-muted-foreground" : "text-danger")}
        >
          {quoteOk
            ? "Quote found in the document text."
            : "Quote must be exact text from this document."}
        </span>
      </label>
      {field === "location" && text === "all" && (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox
            checked={allConfirmed}
            onCheckedChange={(v) => setAllConfirmed(v === true)}
            className="mt-0.5"
          />
          <span>I confirm the source does not restrict this rate to particular locations</span>
        </label>
      )}
      <label className="block text-sm">
        <span className="eyebrow">Reason</span>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          className="mt-1"
        />
      </label>
      {parsed !== undefined && (
        <p className={cn("text-xs", preview ? "text-success" : "text-warning")}>
          {preview
            ? "Value found in a cited quote. It can be verified."
            : "Value not found in a cited quote. It can be saved, but Verify stays disabled until a supporting quote is added."}
        </p>
      )}
      <RoleGate role="procurement" action="Correcting a term">
        <Button
          size="sm"
          variant="outline"
          disabled={parsed === undefined || !quoteOk || !reason.trim()}
          onClick={() => {
            if (
              correctField(t.id, field, parsed!, {
                sourceQuote: quote,
                reason,
                allLocationsConfirmed: allConfirmed,
              })
            ) {
              toast.success(
                `${FIELD_LABEL[field]} corrected. ${t.id} is ${ts.status === "Verified" ? "back to Needs review" : ts.status}.`,
              );
              setText("");
              setReason("");
            }
          }}
        >
          Save correction
        </Button>
      </RoleGate>
    </section>
  );
}

function OverrideSelector({ t, reason }: { t: SeedTerm; reason: string }) {
  const { TERMS, isUnsigned, docById } = useCatalog();
  const { state, setOverride, confirmOverride } = useDemo();
  const ts = state.terms[t.id]!;
  const link = ts.override ?? null;
  const supplierOf = (id: string) => docById(id)?.supplierId;
  const candidates = TERMS.filter(
    (x) =>
      x.id !== t.id &&
      x.kind === "rate" &&
      x.grade === t.grade &&
      supplierOf(x.docId) === supplierOf(t.docId) &&
      !isUnsigned(x.id),
  );
  const scope = `${t.grade ?? ""}${t.location === "all" ? ", all centers" : t.location ? `, ${t.location}` : ""}${
    t.effectiveFrom ? `, from ${formatDate(t.effectiveFrom)}` : ""
  }`;
  return (
    <section className="space-y-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Overrides</h3>
      <p className="text-xs text-muted-foreground">
        A later date never overrides by itself. The link is scoped to this term's role, location and
        dates ({scope}) and counts only once confirmed and this term is Verified.
      </p>
      <RoleGate role="procurement" action="Changing an override">
        <select
          className={selectClass + " w-full"}
          value={link?.target ?? ""}
          onChange={(e) => setOverride(t.id, e.target.value || null, reason)}
        >
          <option value="">Overrides nothing</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}: {c.title}
              {t.location && t.location !== "all" ? ` for ${t.location}` : ""}
            </option>
          ))}
        </select>
      </RoleGate>
      {link && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {link.confirmed ? (
            <Chip tone="success">
              Link to {link.target} confirmed by {link.by},{" "}
              {link.at ? formatTimestamp(link.at) : ""}
            </Chip>
          ) : (
            <>
              <Chip tone="warning">Link to {link.target} not confirmed</Chip>
              <RoleGate role="procurement" action="Confirming a link">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    confirmOverride(t.id) &&
                    toast.success(`${t.id} overrides ${link.target}: link confirmed`)
                  }
                >
                  Confirm link
                </Button>
              </RoleGate>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RateReviewPanel({ t, onDone }: { t: SeedTerm; onDone: () => void }) {
  const { isUnsigned } = useCatalog();
  const { state, verifyTerm, markNeedsReview } = useDemo();
  const ts = state.terms[t.id]!;
  const unsigned = isUnsigned(t.id);
  const [valueOk, setValueOk] = useState(false);
  const [governsOk, setGovernsOk] = useState(false);
  const [reason, setReason] = useState(
    "Quote matches the signed document; role, location and effective date checked.",
  );
  const gate = canVerify(state, t.id);
  const corrections = ts.corrections ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader t={t} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <QuoteInContext t={t} />
        <section>
          <h3 className="eyebrow mb-2">Fields: AI original and current value</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 font-normal">Field</th>
                <th className="py-1 font-normal">AI original</th>
                <th className="py-1 font-normal">Current</th>
                <th className="py-1 font-normal">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {RATE_FIELDS.map((f) => {
                const orig = aiOriginal(t, f);
                const cur = currentValue(t, ts, f);
                const last = [...corrections].reverse().find((c) => c.field === f);
                return (
                  <tr key={f}>
                    <td className="py-1.5 text-xs">{FIELD_LABEL[f]}</td>
                    <td className="py-1.5 font-mono text-xs text-muted-foreground">
                      {showValue(f, orig)}
                    </td>
                    <td className={cn("py-1.5 font-mono text-xs", cur !== orig && "font-semibold")}>
                      {showValue(f, cur)}
                    </td>
                    <td className="py-1.5 text-xs">
                      {last ? (
                        <span
                          className={last.supported ? "text-success" : "text-warning"}
                          title={last.sourceQuote}
                        >
                          {last.supported ? "Corrected, supported" : "Corrected, support missing"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Term quote</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {corrections.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {corrections.map((c, i) => (
                <li key={i}>
                  {c.by}, {formatTimestamp(c.at)}: {FIELD_LABEL[c.field]}{" "}
                  {showValue(c.field, c.from)} to {showValue(c.field, c.to)}. Source: "
                  {c.sourceQuote}"
                </li>
              ))}
            </ul>
          )}
          {t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}
        </section>

        {unsigned ? (
          <p className="rounded-md border bg-muted p-3 text-sm">
            Ignored. This term comes from an unsigned document. It never governs a price and cannot
            be verified.
          </p>
        ) : (
          <>
            <OverrideSelector t={t} reason={reason} />
            <CorrectionForm t={t} />
            {ts.status !== "Verified" ? (
              <section className="space-y-3 rounded-md border p-4">
                <h3 className="text-sm font-semibold">Verification checks</h3>
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={valueOk}
                    onCheckedChange={(v) => setValueOk(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    1. The extracted values and quote are accurate and supported by the cited source
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={governsOk}
                    onCheckedChange={(v) => setGovernsOk(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    2. The term governs under the stated conditions, including the overrides field
                  </span>
                </label>
                {!gate.ok && <p className="text-xs text-warning">{gate.reason}</p>}
              </section>
            ) : (
              <p className="rounded-md border border-success/30 bg-success-soft p-3 text-sm">
                Verified. This term can drive invoice results. Any edit returns it to Needs review.
              </p>
            )}
            <label className="block text-sm">
              <span className="eyebrow">Reason</span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                className="mt-1.5"
              />
            </label>
          </>
        )}
        <History t={t} />
      </div>
      <div className="shrink-0 border-t bg-card p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!unsigned && (
            <RoleGate role="procurement" action="Verifying a term">
              {ts.status !== "Needs review" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    markNeedsReview(t.id, reason) && toast.success(`${t.id} marked Needs review`)
                  }
                >
                  Needs review
                </Button>
              )}
              {ts.status !== "Verified" && (
                <Button
                  disabled={!valueOk || !governsOk || !gate.ok}
                  onClick={() => {
                    if (verifyTerm(t.id, reason)) {
                      toast.success(`${t.id} verified`);
                      onDone();
                    }
                  }}
                >
                  Verify
                </Button>
              )}
            </RoleGate>
          )}
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClauseReviewPanel({ t, onDone }: { t: SeedTerm; onDone: () => void }) {
  const { isUnsigned } = useCatalog();
  const { state, reviewClause, markNeedsReview } = useDemo();
  const ts = state.terms[t.id]!;
  const conflict = t.conflictId ? CONFLICTS.find((c) => c.id === t.conflictId) : undefined;
  const caseState = t.conflictId ? state.conflictCases[t.conflictId] : undefined;
  const [quoteOk, setQuoteOk] = useState(false);
  const [choice, setChoice] = useState<"Clear" | "Disputed">("Disputed");
  const [question, setQuestion] = useState(conflict?.question ?? "");
  const unsigned = isUnsigned(t.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader t={t} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <QuoteInContext t={t} />
        {t.kind === "notice" && (
          <section className="rounded-md border border-info/30 bg-info-soft p-3 text-sm">
            <p className="font-medium">Supplier claim, not an agreed price</p>
            <p className="mt-1 text-xs">
              {t.grade} at {t.ratePaise !== null ? formatINR(t.ratePaise) : "no rate"}/h from{" "}
              {t.effectiveFrom ? formatDate(t.effectiveFrom) : "unknown"}. Notice dated{" "}
              {t.noticeDate ? formatDate(t.noticeDate) : "unknown"}.
              {t.statedCpiPct !== undefined &&
                ` Supplier-stated CPI ${t.statedCpiPct}%, not independently verified.`}
            </p>
          </section>
        )}
        {conflict && (
          <section className="rounded-md border border-legal/30 bg-legal-soft p-3 text-sm">
            <p>
              Linked conflict {conflict.id}:{" "}
              <span className="font-medium">
                {caseState?.status === "Ruled"
                  ? `Ruled, Reading ${state.rulings[conflict.id]?.reading}`
                  : (caseState?.status ?? "Open")}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{conflict.question}</p>
            {caseState?.status === "Open" && <DisputeHint conflictId={conflict.id} termId={t.id} />}
            {caseState?.status !== "Open" && (
              <Link
                to="/legal/$conflictId"
                params={{ conflictId: conflict.id }}
                className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
              >
                Open in Legal queue
              </Link>
            )}
          </section>
        )}
        {ts.interpretation && (
          <p className="rounded-md border p-3 text-sm">
            Interpretation: <span className="font-medium">{ts.interpretation.choice}</span> by{" "}
            {ts.interpretation.by}, {formatTimestamp(ts.interpretation.at)}
            {ts.interpretation.question && (
              <span className="mt-1 block text-muted-foreground">
                Question: "{ts.interpretation.question}"
              </span>
            )}
          </p>
        )}
        {unsigned ? (
          <p className="rounded-md border bg-muted p-3 text-sm">
            Ignored. Unsigned documents cannot be verified.
          </p>
        ) : ts.status !== "Verified" ? (
          <section className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-semibold">Clause review</h3>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={quoteOk}
                onCheckedChange={(v) => setQuoteOk(v === true)}
                className="mt-0.5"
              />
              <span>1. The quote is accurate and supported by the cited source</span>
            </label>
            <fieldset className="space-y-2 text-sm">
              <legend className="eyebrow mb-1">2. Interpretation</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={choice === "Clear"}
                  onChange={() => setChoice("Clear")}
                />{" "}
                Clear
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={choice === "Disputed"}
                  onChange={() => setChoice("Disputed")}
                />{" "}
                Disputed, send to Legal
              </label>
            </fieldset>
            {choice === "Disputed" && (
              <label className="block text-sm">
                <span className="eyebrow">Question for Legal</span>
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="mt-1"
                />
              </label>
            )}
          </section>
        ) : null}
        <History t={t} />
      </div>
      <div className="shrink-0 border-t bg-card p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!unsigned && (
            <RoleGate role="procurement" action="Reviewing a clause">
              {ts.status === "Verified" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    markNeedsReview(t.id, "Clause review reopened") &&
                    toast.success(`${t.id} marked Needs review`)
                  }
                >
                  Needs review
                </Button>
              ) : (
                <Button
                  disabled={!quoteOk || (choice === "Disputed" && !question.trim())}
                  onClick={() => {
                    if (reviewClause(t.id, choice, question)) {
                      toast.success(
                        choice === "Clear"
                          ? `${t.id} reviewed: Clear`
                          : `${t.id} disputed and sent to Legal`,
                      );
                      onDone();
                    }
                  }}
                >
                  {choice === "Clear" ? "Save as Clear" : "Send to Legal"}
                </Button>
              )}
            </RoleGate>
          )}
          <Button variant="ghost" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Demo hint shown while a conflict is still Open, so a first-time evaluator is not stuck with
 * every clause Clear and nothing for Legal to rule on.
 */
function DisputeHint({ conflictId, termId }: { conflictId: string; termId?: string }) {
  const { state } = useDemo();
  const start = DISPUTE_START[conflictId];
  if (!start) return null;
  const conflict = CONFLICTS.find((c) => c.id === conflictId);
  const allReviewed = conflict?.termIds.every((id) => state.terms[id]?.status === "Verified");
  const here = termId === start.termId;
  return (
    <div
      role="note"
      className="mt-2 rounded-md border border-primary/30 bg-accent/60 p-2.5 text-xs text-foreground"
    >
      <p className="font-medium">Demo hint</p>
      <p className="mt-0.5">
        {allReviewed ? (
          <>
            Every clause is reviewed but none is Disputed, so Legal has nothing to rule on. Open{" "}
            <Link
              to="/price-book"
              search={{ tab: "clauses" }}
              hash={start.termId}
              className="font-medium text-primary hover:underline"
            >
              {start.label}
            </Link>
            , press Needs review, then review it again as Disputed with your question.
          </>
        ) : here ? (
          <>
            This is the clause to mark Disputed. Tick the quote check, choose Disputed and send the
            question below.
          </>
        ) : (
          <>
            To send this conflict to Legal, open{" "}
            <Link
              to="/price-book"
              search={{ tab: "clauses" }}
              hash={start.termId}
              className="font-medium text-primary hover:underline"
            >
              {start.label}
            </Link>{" "}
            and mark it Disputed.
          </>
        )}{" "}
        {DISPUTE_HINT}
      </p>
    </div>
  );
}

function ConflictCaseNote({ conflictId }: { conflictId: string }) {
  const { state } = useDemo();
  const c = state.conflictCases[conflictId];
  if (!c || c.status === "Open")
    return (
      <div className="text-sm text-muted-foreground">
        <p>Not sent to Legal. Review a clause and choose Disputed to send it with a question.</p>
        <DisputeHint conflictId={conflictId} />
      </div>
    );
  return (
    <div className="space-y-1 text-sm">
      <p>
        {c.status === "Ruled"
          ? "Ruled by Legal. Dependent checks were recomputed as new versions."
          : "With Legal, awaiting a ruling."}{" "}
        <Link
          to="/legal/$conflictId"
          params={{ conflictId }}
          className="font-medium text-primary hover:underline"
        >
          Open
        </Link>
      </p>
      {c.questions.map((q, i) => (
        <p key={i} className="text-xs text-muted-foreground">
          {q.by} on {q.termId}: "{q.text}"
        </p>
      ))}
    </div>
  );
}
