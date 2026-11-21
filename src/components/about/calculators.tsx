import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { formatRupees, readWhole, WORKED_DEFAULTS, workedExample } from "@/lib/about-calculators";
import { groupIndian } from "@/lib/money";

/** Optional calculators on the About page. The page reads fully without touching them. */

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[13px] font-medium text-muted-foreground">{children}</p>;
}

function NumberField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      />
    </div>
  );
}

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <span className="inline-flex items-start gap-1.5">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        style={{ color: ok ? "var(--s1)" : "var(--s2)" }}
      />
      <span>{children}</span>
    </span>
  );
}

/** Section 3: the worked example table, live. Row labels come from the content file. */
export function WorkedExample({ labels }: { labels: string[] }) {
  const [hours, setHours] = useState(String(WORKED_DEFAULTS.hours));
  const [orig, setOrig] = useState(String(WORKED_DEFAULTS.originalRate));
  const [amended, setAmended] = useState(String(WORKED_DEFAULTS.amendedRate));

  const h = readWhole(hours, 10000);
  const o = readWhole(orig, 100000);
  const a = readWhole(amended, 100000);
  const r = workedExample({ hours: h, originalRate: o, amendedRate: a });
  const hrs = groupIndian(String(h));

  const values: ReactNode[] = [
    <>L2 Engineer, Hyderabad: {formatRupees(o)} per hour</>,
    <>L2 Engineer, Hyderabad only: {formatRupees(a)} per hour</>,
    <>{formatRupees(r.poRate)} per hour</>,
    <>
      {hrs} hours at {formatRupees(o)} = {formatRupees(r.invoiceAmount)}
    </>,
    <Status ok={r.poCheckPasses}>
      {r.poCheckPasses ? "Passes. Invoice and PO agree" : "Does not pass. Invoice and PO differ"}
    </Status>,
    <Status ok={!r.contractFlagged}>
      {hrs} hours at {formatRupees(a)} = {formatRupees(r.contractAmount)}.{" "}
      {r.contractFlagged ? (
        <strong className="font-semibold">{formatRupees(r.difference)} over on one line</strong>
      ) : (
        "No overcharge on this line"
      )}
    </Status>,
  ];

  return (
    <div className="my-4" data-testid="calc-worked-example">
      <Hint>Change the numbers</Hint>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField label="Hours" value={hours} onChange={setHours} max={10000} />
        <NumberField
          label="Original rate (₹ per hour)"
          value={orig}
          onChange={setOrig}
          max={100000}
        />
        <NumberField
          label="Amended rate (₹ per hour)"
          value={amended}
          onChange={setAmended}
          max={100000}
        />
      </div>
      <div className="max-w-full overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {values.map((v, i) => (
              <tr key={i}>
                <td className="w-40 px-3.5 py-2.5 align-top leading-relaxed text-muted-foreground">
                  {labels[i] ?? ""}
                </td>
                <td className="px-3.5 py-2.5 align-top leading-relaxed tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm" aria-live="polite">
        {[
          ["Invoice amount", formatRupees(r.invoiceAmount)],
          ["Contract amount", formatRupees(r.contractAmount)],
          ["Difference", formatRupees(r.difference)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted px-3 py-2">
            <dt className="eyebrow">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
