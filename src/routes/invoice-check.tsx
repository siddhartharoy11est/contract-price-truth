import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { RoleGate } from "@/components/app/role-gate";
import { ResultCard } from "@/components/app/result-card";
import { VersionHistory } from "@/components/app/version-history";
import { InvestigationStatusChip, ResultStatusChip, Chip } from "@/components/app/chips";
import { FIXTURES, fixtureById } from "@/data/fixtures";
import type { RoleMapEntry } from "@/data/types";
import { OTHER_LOCATION, type InvoiceLine } from "@/data/types";
import { useDemo, useInvestigations } from "@/lib/demo-store";
import { formatINR, parseHours, parseRupees } from "@/lib/money";
import { formatTimestamp, isIsoDate } from "@/lib/dates";
import type { Assessment, InvestigationStatus } from "@/lib/workflow";
import type { ResultStatus } from "@/lib/pricing-engine";
import { roleById } from "@/data/roles";
import { DEFAULT_SUPPLIER_ID } from "@/lib/pricing-engine";

interface InvoiceCheckSearch {
  /** A fixture id the guided tour asks the form to load. Fills the form only. */
  example?: string;
}

export const Route = createFileRoute("/invoice-check")({
  validateSearch: (search: Record<string, unknown>): InvoiceCheckSearch =>
    typeof search["example"] === "string" ? { example: search["example"] } : {},
  head: () => ({
    meta: [
      { title: "Invoice Check · Contract Price Truth" },
      {
        name: "description",
        content: "Check one invoice line against the verified, effective-dated contract price.",
      },
      { property: "og:title", content: "Invoice Check · Contract Price Truth" },
      {
        property: "og:description",
        content: "Check one invoice line against the verified, effective-dated contract price.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvoiceCheckPage,
});

const OTHER = "__other__";

interface FormState {
  supplierId: string;
  start: string;
  end: string;
  /** A grade from the role map, OTHER for free text, or "" for not stated. */
  gradeChoice: string;
  gradeText: string;
  /** A delivery center, OTHER_LOCATION, or "" for not stated. */
  location: string;
  hours: string;
  billed: string;
  po: string;
}

const EMPTY: FormState = {
  supplierId: DEFAULT_SUPPLIER_ID,
  start: "",
  end: "",
  gradeChoice: "",
  gradeText: "",
  location: "",
  hours: "",
  billed: "",
  po: "",
};

const rupeeText = (p: number | null) => (p === null ? "" : String(p / 100));
function fromLine(line: InvoiceLine, roleMaps: Record<string, RoleMapEntry[]>): FormState {
  const supplierId = line.supplierId ?? DEFAULT_SUPPLIER_ID;
  const known = (roleMaps[supplierId] ?? []).some((r) => r.grade === line.grade);
  return {
    supplierId,
    start: line.serviceStart,
    end: line.serviceEnd,
    gradeChoice: known ? line.grade : line.grade.trim() ? OTHER : "",
    gradeText: known ? "" : line.grade,
    location: line.location,
    hours: String(line.hours),
    billed: rupeeText(line.billedRatePaise),
    po: rupeeText(line.poRatePaise),
  };
}

function toLine(f: FormState): { line: InvoiceLine | null; errors: string[] } {
  const errors: string[] = [];
  if (!isIsoDate(f.start)) errors.push("Service start date is required.");
  if (!isIsoDate(f.end)) errors.push("Service end date is required.");
  if (isIsoDate(f.start) && isIsoDate(f.end) && f.end < f.start)
    errors.push("Service end date is before the start date.");
  const grade = f.gradeChoice === OTHER ? f.gradeText.trim() : f.gradeChoice;
  if (f.gradeChoice === OTHER && !grade)
    errors.push("Type the role as written on the invoice, or choose Not stated.");
  const hours = parseHours(f.hours);
  if (hours === null || hours <= 0)
    errors.push("Hours must be a number above zero, for example 100 or 7.5.");
  const billed = parseRupees(f.billed);
  if (billed === null || billed <= 0)
    errors.push("Billed rate must be an amount in rupees, for example 1200.");
  const po = f.po.trim() ? parseRupees(f.po) : null;
  if (f.po.trim() && (po === null || po <= 0))
    errors.push("PO rate must be an amount in rupees, or left empty.");
  if (errors.length) return { line: null, errors };
  const line: InvoiceLine = {
    grade,
    location: f.location,
    serviceStart: f.start,
    serviceEnd: f.end,
    hours: hours!,
    billedRatePaise: billed!,
    poRatePaise: po,
  };
  if (f.supplierId !== DEFAULT_SUPPLIER_ID) line.supplierId = f.supplierId;
  return { line, errors };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <label className="block text-sm">
      <span className="eyebrow">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const selectClass = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

function InvoiceCheckPage() {
  const {
    evaluate,
    state,
    catalog,
    saveCheck,
    supplyFact,
    requestReview,
    raiseInvestigation,
    markProgress,
  } = useDemo();
  const rows = useInvestigations();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const assessment = openId ? state.assessments.find((a) => a.id === openId) : undefined;
  const latest = assessment?.versions[assessment.versions.length - 1];
  const result = latest ? evaluate(latest.inputs.line) : null;
  const investigation = rows.find((r) => r.assessment.id === openId);

  useEffect(() => {
    if (!assessment || !result || assessment.fixtureId !== "S01") return;
    if (result.status === "Awaiting verification") markProgress("s01Awaiting");
    if (result.status === "Potential discrepancy") markProgress("s01Excess");
  }, [assessment, result, markProgress]);

  const { example } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!example) return;
    loadExample(example);
    void navigate({ to: "/invoice-check", search: {}, replace: true });
  }, [example]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFixtureId(null);
  };

  const loadExample = (id: string) => {
    const fx = fixtureById(id);
    if (!fx) return;
    setForm(fromLine(fx.line, catalog.roleMaps));
    setFixtureId(fx.id);
    setErrors([]);
    setOpenId(null);
  };

  const check = () => {
    const { line, errors: errs } = toLine(form);
    setErrors(errs);
    if (!line) return;
    const id = saveCheck(line, fixtureId);
    if (id) setOpenId(id);
  };

  const openSaved = (a: Assessment) => {
    setOpenId(a.id);
    setForm(fromLine(a.versions[a.versions.length - 1]!.inputs.line, catalog.roleMaps));
    setFixtureId(a.fixtureId);
    setErrors([]);
  };

  const uploadedSupplier = state.uploads.suppliers.some((x) => x.id === form.supplierId);
  const supplierTerms = catalog.terms.filter(
    (t) =>
      t.kind === "rate" &&
      catalog.documents.find((d) => d.id === t.docId)?.supplierId === form.supplierId,
  );
  const verifiedRoles = new Set(
    supplierTerms
      .filter((t) => state.terms[t.id]?.status === "Verified")
      .map((t) => (state.terms[t.id]?.edits?.grade as string | undefined) ?? t.grade),
  );
  // Uploaded suppliers list only roles with a Verified term. Others can still be typed as written.
  const roleMap = (catalog.roleMaps[form.supplierId] ?? []).filter(
    (r) => !uploadedSupplier || verifiedRoles.has(r.grade),
  );
  const centers = catalog.deliveryCenters[form.supplierId] ?? [];
  const uploadedDocs = catalog.documents.filter(
    (d) => d.source === "Live" && d.supplierId === form.supplierId,
  );
  const st = result?.status;

  return (
    <div>
      <PageHeader title="Invoice Check">
        Compare one invoice line with the verified, effective-dated contract price. Every check is
        saved with versions. The result is advisory and never blocks payment.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <form
          className="surface h-fit space-y-4 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <Field
            label="Load example (demo data)"
            hint="Examples fill the form only. They never change verification state."
          >
            <select
              className={selectClass}
              value={fixtureId ?? ""}
              onChange={(e) => loadExample(e.target.value)}
            >
              <option value="">Choose an example line</option>
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}: {f.summary}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <select
              className={selectClass}
              value={form.supplierId}
              onChange={(e) =>
                update({ supplierId: e.target.value, gradeChoice: "", gradeText: "", location: "" })
              }
            >
              {catalog.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {catalog.documents.some((d) => d.supplierId === s.id && d.source === "Live")
                    ? " (uploaded documents)"
                    : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service start">
              <Input
                type="date"
                value={form.start}
                onChange={(e) => update({ start: e.target.value })}
              />
            </Field>
            <Field label="Service end">
              <Input
                type="date"
                value={form.end}
                onChange={(e) => update({ end: e.target.value })}
              />
            </Field>
          </div>
          <Field
            label="Role or grade"
            hint={
              uploadedSupplier
                ? roleMap.length
                  ? "Roles with a Verified term from the uploaded document."
                  : "No Verified roles yet. Verify a term in the Price Book first."
                : roleMap.length
                  ? uploadedDocs.length
                    ? `Includes uploaded ${uploadedDocs.map((d) => d.id).join(", ")}.`
                    : undefined
                  : "This supplier has no role map on file."
            }
          >
            <select
              className={selectClass}
              value={form.gradeChoice}
              onChange={(e) => update({ gradeChoice: e.target.value })}
            >
              <option value="">Not stated</option>
              {roleMap.map((r) => (
                <option key={r.grade} value={r.grade}>
                  {r.grade}, {r.role}
                </option>
              ))}
              <option value={OTHER}>Other or not listed</option>
            </select>
          </Field>
          {form.gradeChoice === OTHER && (
            <Field
              label="Role as written on invoice"
              hint="Matched only through the role map. Never guessed from the rate."
            >
              <Input
                value={form.gradeText}
                onChange={(e) => update({ gradeText: e.target.value })}
                maxLength={80}
              />
            </Field>
          )}
          <Field label="Delivery center">
            <select
              className={selectClass}
              value={form.location}
              onChange={(e) => update({ location: e.target.value })}
            >
              <option value="">Not stated</option>
              {centers.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value={OTHER_LOCATION}>{OTHER_LOCATION}</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Hours">
              <Input
                value={form.hours}
                onChange={(e) => update({ hours: e.target.value })}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label="Billed ₹/h">
              <Input
                value={form.billed}
                onChange={(e) => update({ billed: e.target.value })}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label="PO ₹/h">
              <Input
                value={form.po}
                onChange={(e) => update({ po: e.target.value })}
                inputMode="decimal"
                placeholder="Optional"
                className="font-mono"
              />
            </Field>
          </div>
          {errors.length > 0 && (
            <ul
              className="space-y-1 rounded-md border border-danger/30 bg-danger-soft p-3 text-xs text-danger"
              role="alert"
            >
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button type="submit" className="w-full">
            Check Against Contract
          </Button>
        </form>

        <div className="space-y-6">
          {!assessment || !result || !latest ? (
            <div className="surface flex min-h-60 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-base font-semibold">No line checked yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Load an example such as S01, or enter a line, then choose Check Against Contract. Or
                open a saved check below.
              </p>
            </div>
          ) : (
            <>
              <ResultCard
                result={result}
                line={latest.inputs.line}
                title={`${assessment.id}${assessment.fixtureId ? ` · ${assessment.fixtureId}` : ""}`}
                meta={
                  <p className="text-xs text-muted-foreground">
                    Saved check, version {latest.n} of {assessment.versions.length},{" "}
                    {formatTimestamp(latest.at)} by {latest.by}.
                  </p>
                }
                onSupplyLocation={(loc) =>
                  supplyFact(assessment.id, { kind: "location", value: loc })
                }
                actions={
                  <div className="space-y-3">
                    {investigation ? (
                      <HandoffConfirmation
                        id={investigation.investigation.id}
                        kind={investigation.kind}
                        status={investigation.status}
                      />
                    ) : (
                      st &&
                      NEXT_STEP[st] && (
                        <p className="text-sm font-medium" data-testid="next-step">
                          Next: {NEXT_STEP[st]}
                        </p>
                      )
                    )}
                    {!investigation && st && st !== "Match" && st !== "Invalid input" && (
                      <RoleGate
                        role="finance"
                        action="Requesting review or raising an investigation"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          {st === "Potential discrepancy" && (
                            <Button
                              onClick={() => {
                                const id = raiseInvestigation(assessment.id);
                                if (id) toast.success(`Investigation ${id} raised for Procurement`);
                              }}
                            >
                              Raise investigation
                            </Button>
                          )}
                          <Button
                            variant={st === "Potential discrepancy" ? "outline" : "default"}
                            onClick={() => {
                              const id = requestReview(assessment.id);
                              if (id) toast.success(`Review requested as ${id}`);
                            }}
                          >
                            Request review
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Goes to Procurement. Nothing is sent to the supplier.
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          This check is only saved. It becomes an investigation when you click
                          Request review or Raise investigation.
                        </p>
                      </RoleGate>
                    )}
                  </div>
                }
              />
              <VersionHistory assessment={assessment} />
            </>
          )}
          <SavedChecks openId={openId} onOpen={openSaved} />
        </div>
      </div>
    </div>
  );
}

/** What happens next for each result, shown under a saved check. */
const NEXT_STEP: Partial<Record<ResultStatus, string>> = {
  Match: "Nothing to do, the check is saved.",
  "Potential discrepancy": "Click Request review to send this to Procurement.",
  "Awaiting verification": "Click Request review to send this to Procurement.",
  "Needs Legal": "Click Request review to send this to Procurement.",
  "Needs information": "Click Request review to send this to Procurement.",
};

/** Shown once a check has become an investigation: who owns it now and how to get there. */
function HandoffConfirmation({
  id,
  kind,
  status,
}: {
  id: string;
  kind: string;
  status: InvestigationStatus;
}) {
  const { setRole } = useDemo();
  const navigate = useNavigate();
  const owner = roleById("procurement");
  return (
    <div
      className="rounded-md border border-success/30 bg-success-soft/60 p-3 text-sm"
      role="status"
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          Investigation <span className="font-mono">{id}</span> created.
        </span>
        <span className="text-muted-foreground">{kind}</span>
        <InvestigationStatusChip status={status} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Owner: {owner.short}, {owner.name}. Nothing was sent to the supplier and payment is not
        blocked.
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium">
        <Link to="/findings" hash={id} className="text-primary underline underline-offset-2">
          Open the investigation
        </Link>
        <button
          className="text-primary underline underline-offset-2"
          onClick={() => {
            setRole("procurement");
            void navigate({ to: "/findings", hash: id });
          }}
        >
          Switch to Priya to see it
        </button>
      </div>
    </div>
  );
}

function SavedChecks({
  openId,
  onOpen,
}: {
  openId: string | null;
  onOpen: (a: Assessment) => void;
}) {
  const { state } = useDemo();
  const rows = useInvestigations();
  const list = useMemo(() => state.assessments, [state.assessments]);
  return (
    <section className="surface overflow-x-auto">
      <h3 className="px-4 pt-4 text-sm font-semibold sm:px-5">Saved checks</h3>
      {list.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-sm text-muted-foreground sm:px-5">No saved checks yet.</p>
      ) : (
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left">
              {["Check", "Line", "Latest", "Versions", "Investigation"].map((h) => (
                <th key={h} className="eyebrow px-3 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((a) => {
              const v = a.versions[a.versions.length - 1]!;
              const inv = rows.find((r) => r.assessment.id === a.id);
              return (
                <tr
                  key={a.id}
                  className={openId === a.id ? "bg-accent/40" : "cursor-pointer hover:bg-muted/40"}
                  onClick={() => onOpen(a)}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {a.id}
                    {a.fixtureId && <Chip className="ml-1.5">{a.fixtureId}</Chip>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {v.inputs.line.grade || "No role"} · {v.inputs.line.location || "No location"} ·{" "}
                    {formatINR(v.inputs.line.billedRatePaise)}/h
                  </td>
                  <td className="px-3 py-2">
                    <ResultStatusChip status={v.result.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">v{v.n}</td>
                  <td className="px-3 py-2">
                    {inv ? (
                      <InvestigationStatusChip status={inv.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
