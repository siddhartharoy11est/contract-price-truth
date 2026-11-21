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
import { CONFLICTS, docById, TERMS, termById } from "@/data/seed";
import type { SeedTerm } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import { formatINR, parseRupees } from "@/lib/money";
import { formatDate, formatTimestamp } from "@/lib/dates";
import { cn } from "@/lib/utils";

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

const locLabel = (t: SeedTerm) =>
  t.location === "all" ? "All centers" : t.location ? `${t.location} only` : "Not applicable";
const selectClass = "h-9 rounded-md border border-input bg-card px-2.5 text-xs";

function PriceBookPage() {
  const { state, escalateConflict } = useDemo();
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
  }, [hash]);

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
  }, [tab, query, status, grade, location, state.terms]);

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
      <PageHeader title="Price Book" actions={<SourceLabel live={false} />}>
        Verified, effective-dated commercial terms for BrightHire Staffing. Only Verified terms can
        drive an invoice result.
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
              label: "Clauses and Notices",
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
              {["L4", "L3", "L2"].map((g) => (
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
              {["Bengaluru", "Pune", "Hyderabad"].map((l) => (
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
            <h2 className="text-base font-semibold">Open contractual conflicts</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Only a recorded Legal decision can resolve these terms.
            </p>
          </div>
          {CONFLICTS.map((c) => (
            <ConflictCard key={c.id} conflict={c}>
              {state.rulings[c.id] ? (
                <p className="text-sm text-muted-foreground">
                  Resolved by Legal. Dependent investigations were recalculated.
                </p>
              ) : state.escalations[c.id] ? (
                <p className="text-sm text-muted-foreground">
                  Escalated to Legal by {state.escalations[c.id]!.by}. Awaiting a decision.
                </p>
              ) : (
                <RoleGate role="procurement" action="Escalating a conflict">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        escalateConflict(c.id);
                        toast.success(`Conflict ${c.id} escalated to Legal`);
                      }}
                    >
                      Escalate to Legal
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      The application does not choose an interpretation.
                    </span>
                  </div>
                </RoleGate>
              )}
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
            const rate = ts.editedRatePaise ?? t.ratePaise;
            return (
              <tr
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="cursor-pointer hover:bg-muted/40"
              >
                <td className="table-cell">
                  <button className="text-left font-medium text-primary hover:underline">
                    {t.title}
                  </button>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {t.id}
                    {t.replaces
                      ? ` · Supersedes ${t.replaces}${t.location !== "all" ? ` for ${t.location}` : ""}`
                      : ""}
                  </span>
                  {pending && ts.secondReadDiffers && (
                    <span className="mt-1 block text-[11px] text-danger">
                      Live second read differs. Re-verification required.
                    </span>
                  )}
                </td>
                <td className="table-cell text-xs">{t.grade ?? "Any"}</td>
                <td className="table-cell text-xs">{locLabel(t)}</td>
                <td className="table-cell whitespace-nowrap">
                  <span className="tabular font-mono text-xs font-medium">
                    {rate !== null ? `${formatINR(rate)}/h` : "Not a rate"}
                  </span>
                  {ts.editedRatePaise !== undefined && (
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
                    <TermStatusChip status={ts.status} />
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
                  {t.conflictId && !state.rulings[t.conflictId] && (
                    <span className="mt-1 block text-[11px] text-legal">
                      Linked to conflict {t.conflictId}
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

function ReviewPanel({ termId, onDone }: { termId: string; onDone: () => void }) {
  const { state, verifyTerm } = useDemo();
  const t = termById(termId)!;
  const ts = state.terms[termId]!;
  const doc = docById(t.docId)!;
  const [valueOk, setValueOk] = useState(false);
  const [governsOk, setGovernsOk] = useState(false);
  const [rateText, setRateText] = useState(
    t.ratePaise !== null ? String((ts.editedRatePaise ?? t.ratePaise) / 100) : "",
  );
  const [reason, setReason] = useState(
    "Quote matches the signed document; grade, location and effective date checked.",
  );
  const ruled = t.conflictId ? state.rulings[t.conflictId] : undefined;
  const conflictLocked = Boolean(t.conflictId) && !ruled && !ts.secondReadDiffers;
  const canVerify = ts.status !== "Ignored" && ts.status !== "Verified" && !conflictLocked;
  const editedPaise = t.ratePaise !== null ? parseRupees(rateText) : null;
  const rateInvalid = t.ratePaise !== null && editedPaise === null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="shrink-0 border-b p-5 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
          <TermStatusChip status={ts.status} />
          {ts.secondReadDiffers && <Chip tone="danger">Second read differs</Chip>}
          <SourceLabel live={false} />
        </div>
        <SheetTitle className="text-xl font-semibold tracking-tight">{t.title}</SheetTitle>
        <SheetDescription className="text-xs">
          {doc.title} ({doc.id}), {t.clauseId}. {doc.dateLine}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extracted information
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-md border bg-muted/30 p-4 text-sm">
            <div>
              <dt className="eyebrow">Grade</dt>
              <dd className="mt-1">{t.grade ?? "Any"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Applicability</dt>
              <dd className="mt-1">{locLabel(t)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Original AI-proposed rate</dt>
              <dd className="tabular mt-1 font-mono text-xs">
                {t.ratePaise !== null ? `${formatINR(t.ratePaise)}/h` : "Not a rate"}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Effective from</dt>
              <dd className="mt-1">
                {t.effectiveFrom ? formatDate(t.effectiveFrom) : "Not stated"}
              </dd>
            </div>
            {t.replaces && (
              <div className="col-span-2">
                <dt className="eyebrow">Supersedes</dt>
                <dd className="mt-1">
                  <TermCitation termId={t.replaces} />
                </dd>
              </div>
            )}
          </dl>
          {t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}
        </section>
        <section className="paper-sheet p-4">
          <h3 className="eyebrow mb-3">Supporting contract passage</h3>
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
        {ts.status === "Ignored" && (
          <p className="rounded-md border bg-muted p-3 text-sm">
            This term comes from an unsigned draft. Drafts never govern a price, so it cannot be
            verified.
          </p>
        )}
        {conflictLocked && (
          <p className="rounded-md border border-legal/30 bg-legal-soft p-3 text-sm">
            This term is part of open conflict {t.conflictId}. It can be resolved only by a Legal
            decision.
          </p>
        )}
        {ts.status === "Verified" && (
          <p className="rounded-md border border-success/30 bg-success-soft p-3 text-sm">
            {ruled
              ? `Resolved by Legal decision (Reading ${ruled.reading}).`
              : "Verified. This term can drive invoice results."}
          </p>
        )}
        {canVerify && (
          <section className="space-y-4 rounded-md border p-4">
            <div>
              <h3 className="text-sm font-semibold">Verification checklist</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Procurement must confirm both checks before this term can govern a price.
              </p>
            </div>
            {t.ratePaise !== null && (
              <label className="block text-sm">
                <span className="eyebrow">Reviewer value (₹ per hour)</span>
                <Input
                  value={rateText}
                  onChange={(e) => setRateText(e.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 font-mono"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Original AI value: {formatINR(t.ratePaise)}/h
                  {editedPaise !== null && editedPaise !== t.ratePaise
                    ? `. Reviewer change: ${formatINR(editedPaise)}/h.`
                    : "."}
                </span>
                {rateInvalid && (
                  <span className="mt-1 block text-xs text-danger">
                    Enter a rate such as 1050 or 1050.50.
                  </span>
                )}
              </label>
            )}
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={valueOk}
                onCheckedChange={(v) => setValueOk(v === true)}
                className="mt-0.5"
              />
              <span>The extracted value and supporting quote are correct</span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={governsOk}
                onCheckedChange={(v) => setGovernsOk(v === true)}
                className="mt-0.5"
              />
              <span>
                This term governs under its grade, location, effective date and supersession
                conditions
              </span>
            </label>
            <label className="block text-sm">
              <span className="eyebrow">Review note</span>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                className="mt-1.5"
              />
            </label>
          </section>
        )}
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
      </div>
      <div className="shrink-0 border-t bg-card p-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canVerify ? (
            <RoleGate role="procurement" action="Verifying a term">
              <Button
                disabled={!valueOk || !governsOk || rateInvalid}
                onClick={() => {
                  verifyTerm(termId, {
                    reason,
                    ...(editedPaise !== null ? { editedRatePaise: editedPaise } : {}),
                  });
                  toast.success(`${termId} verified`);
                  onDone();
                }}
              >
                Verify term
              </Button>
            </RoleGate>
          ) : (
            <Button variant="outline" onClick={onDone}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
