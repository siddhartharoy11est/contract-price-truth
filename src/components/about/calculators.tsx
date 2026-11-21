import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  AUTONOMY_DEFAULTS,
  autonomyLevel,
  formatRupees,
  LEVEL_NAMES,
  readWhole,
  WORKED_DEFAULTS,
  workedExample,
} from "@/lib/about-calculators";
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

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-semibold tabular-nums">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-[var(--s1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
    </div>
  );
}

function LevelRow({ title, open, missing }: { title: string; open: boolean; missing: string[] }) {
  const Icon = open ? CheckCircle2 : Lock;
  return (
    <li className="rounded-md border px-3 py-2.5">
      <div className="flex items-center gap-2 font-medium">
        <Icon
          aria-hidden="true"
          className="size-4 shrink-0"
          style={{ color: open ? "var(--s1)" : "var(--color-muted-foreground)" }}
        />
        <span>{title}</span>
        <span className="ml-auto text-[13px] font-normal text-muted-foreground">
          {open ? "Unlocked" : "Locked"}
        </span>
      </div>
      {!open && missing.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[13px] text-muted-foreground">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Section 4.1: which autonomy level the measured numbers would unlock. */
export function AutonomyCalculator() {
  const [v, setV] = useState(AUTONOMY_DEFAULTS);
  const r = autonomyLevel(v);
  const set = (k: keyof typeof v) => (n: number) => setV((prev) => ({ ...prev, [k]: n }));

  return (
    <div className="my-4 rounded-lg border p-4" data-testid="calc-autonomy">
      <Hint>Drag to see what unlocks</Hint>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RangeField
          label="AI terms accepted without edit"
          value={v.acceptedPct}
          min={0}
          max={100}
          step={1}
          onChange={set("acceptedPct")}
          display={`${v.acceptedPct}%`}
        />
        <RangeField
          label="Terms reviewed"
          value={v.termsReviewed}
          min={0}
          max={400}
          step={1}
          onChange={set("termsReviewed")}
          display={String(v.termsReviewed)}
        />
        <RangeField
          label="Wrong in the sample"
          value={v.wrongPct}
          min={0}
          max={5}
          step={0.1}
          onChange={set("wrongPct")}
          display={`${v.wrongPct.toFixed(1)}%`}
        />
      </div>
      {r.level2Unlocked && (
        <div className="mt-4 sm:max-w-sm">
          <RangeField
            label="Days stable with zero false clears"
            value={v.daysStable}
            min={0}
            max={120}
            step={1}
            onChange={set("daysStable")}
            display={`${v.daysStable} days`}
          />
        </div>
      )}
      <ul className="mt-4 space-y-2 text-sm">
        <LevelRow title={LEVEL_NAMES[1]} open missing={[]} />
        <LevelRow title={LEVEL_NAMES[2]} open={r.level2Unlocked} missing={r.level2Missing} />
        <LevelRow title={LEVEL_NAMES[3]} open={r.level3Unlocked} missing={r.level3Missing} />
      </ul>
      <p className="mt-3 text-sm font-medium" aria-live="polite">
        Current level: {LEVEL_NAMES[r.level]}
      </p>
    </div>
  );
}
