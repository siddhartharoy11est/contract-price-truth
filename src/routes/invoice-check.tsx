import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { ResultCard } from "@/components/app/result-card";
import { RoleGate } from "@/components/app/role-gate";
import { FIXTURES, fixtureById } from "@/data/fixtures";
import { LOCATIONS } from "@/data/seed";
import type { InvoiceLine, Location } from "@/data/types";
import { useDemo } from "@/lib/demo-store";
import { sameLine, isLocation } from "@/lib/findings";
import { parseHours, parseRupees } from "@/lib/money";
import { isIsoDate } from "@/lib/dates";

export const Route = createFileRoute("/invoice-check")({
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

interface FormState {
  start: string;
  end: string;
  gradeChoice: "L4" | "L3" | "L2" | "other";
  gradeText: string;
  location: Location | "";
  hours: string;
  billed: string;
  po: string;
}

const EMPTY: FormState = {
  start: "",
  end: "",
  gradeChoice: "L4",
  gradeText: "",
  location: "",
  hours: "",
  billed: "",
  po: "",
};

const rupeeText = (p: number | null) => (p === null ? "" : String(p / 100));

function fromLine(line: InvoiceLine): FormState {
  const known = ["L4", "L3", "L2"].includes(line.grade);
  return {
    start: line.serviceStart,
    end: line.serviceEnd,
    gradeChoice: known ? (line.grade as "L4" | "L3" | "L2") : "other",
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
  const grade = f.gradeChoice === "other" ? f.gradeText.trim() : f.gradeChoice;
  if (!grade) errors.push("Enter the grade as written on the invoice.");
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
  return {
    line: {
      grade,
      location: f.location,
      serviceStart: f.start,
      serviceEnd: f.end,
      hours: hours!,
      billedRatePaise: billed!,
      poRatePaise: po,
    },
    errors,
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
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
  const { evaluate, state, raiseFinding, markProgress } = useDemo();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<{
    line: InvoiceLine;
    fixtureId: string | null;
  } | null>(null);

  const result = submitted ? evaluate(submitted.line) : null;

  useEffect(() => {
    if (!submitted || !result || submitted.fixtureId !== "S01") return;
    if (result.status === "Awaiting verification") markProgress("s01Awaiting");
    if (result.status === "Potential discrepancy") markProgress("s01Excess");
  }, [submitted, result, markProgress]);

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setFixtureId(null);
  };

  const loadExample = (id: string) => {
    const fx = fixtureById(id);
    if (!fx) return;
    setForm(fromLine(fx.line));
    setFixtureId(fx.id);
    setErrors([]);
    setSubmitted(null);
  };

  const check = () => {
    const { line, errors: errs } = toLine(form);
    setErrors(errs);
    setSubmitted(line ? { line, fixtureId } : null);
  };

  const supplyLocation = (loc: Location) => {
    if (!submitted) return;
    setForm((f) => ({ ...f, location: loc }));
    setSubmitted({ ...submitted, line: { ...submitted.line, location: loc } });
  };

  const existing = submitted
    ? state.findings.find((f) => f.status !== "Dismissed" && sameLine(f.line, submitted.line))
    : undefined;
  const canRaise =
    result && ["Potential discrepancy", "Needs information", "Needs Legal"].includes(result.status);

  return (
    <div>
      <PageHeader title="Invoice Check">
        Compare one invoice line with the verified, effective-dated contract price. The result is
        advisory and never blocks payment.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <form
          className="surface h-fit space-y-4 p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium">BrightHire Staffing</p>
            <p className="mt-1 text-muted-foreground">
              Master Services Agreement, Rate Schedule A and signed amendments
            </p>
            <Link
              to="/suppliers/$supplierId"
              params={{ supplierId: "brighthire" }}
              className="mt-2 inline-block font-medium text-primary hover:underline"
            >
              View supplier workspace
            </Link>
          </div>
          <Field label="Load example">
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
          <Field label="Grade">
            <select
              className={selectClass}
              value={form.gradeChoice}
              onChange={(e) => update({ gradeChoice: e.target.value as FormState["gradeChoice"] })}
            >
              <option value="L4">L4, Senior Software Engineer</option>
              <option value="L3">L3, Software Engineer</option>
              <option value="L2">L2, QA Analyst</option>
              <option value="other">Other, type as on invoice</option>
            </select>
          </Field>
          {form.gradeChoice === "other" && (
            <Field
              label="Grade as written on invoice"
              hint="Free text is matched exactly. It is never guessed from the rate."
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
              onChange={(e) =>
                update({ location: isLocation(e.target.value) ? e.target.value : "" })
              }
            >
              <option value="">Not stated</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
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

        <div>
          {!submitted || !result ? (
            <div className="surface flex min-h-60 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-base font-semibold">No line checked yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Load an example such as S01, or enter a line, then choose Check Against Contract.
              </p>
            </div>
          ) : (
            <ResultCard
              result={result}
              line={submitted.line}
              title={submitted.fixtureId ? `Result for ${submitted.fixtureId}` : "Result"}
              onSupplyLocation={supplyLocation}
              actions={
                canRaise ? (
                  existing ? (
                    <p className="text-sm">
                      Already raised as{" "}
                      <Link
                        to="/findings"
                        hash={existing.id}
                        className="font-mono text-primary underline"
                      >
                        {existing.id}
                      </Link>{" "}
                      ({existing.status}).
                    </p>
                  ) : (
                    <RoleGate role="finance" action="Raising an investigation">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => {
                            const id = raiseFinding(submitted.line, submitted.fixtureId);
                            toast.success(`Investigation ${id} raised for Procurement`);
                          }}
                        >
                          Raise investigation
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Sends it to Procurement. Nothing is sent to the supplier.
                        </span>
                      </div>
                    </RoleGate>
                  )
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
