import type { ReactNode } from "react";

/**
 * The four charts on the About page, ported from docs/About_Preview_v2.html. Colours come
 * from --s1 (blue) and --s2 (orange), set on the article for light and dark themes.
 */

function Swatch({ kind }: { kind: "s1" | "s2" | "s1-box" | "s2-box" | "s2-dash" }) {
  if (kind === "s1-box" || kind === "s2-box") {
    const c = kind === "s1-box" ? "var(--s1)" : "var(--s2)";
    return (
      <i
        aria-hidden="true"
        className="inline-block h-3 w-4 shrink-0 rounded-sm border-2"
        style={{ borderColor: c }}
      />
    );
  }
  return (
    <svg aria-hidden="true" width="18" height="6" className="shrink-0">
      <line
        x1="1"
        x2="17"
        y1="3"
        y2="3"
        strokeWidth="3"
        strokeLinecap="round"
        stroke={kind === "s1" ? "var(--s1)" : "var(--s2)"}
        strokeDasharray={kind === "s2-dash" ? "4 3" : undefined}
      />
    </svg>
  );
}

function Legend({ items }: { items: { swatch: ReactNode; label: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          {it.swatch}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function Figure({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <figure
      className="my-5 min-w-0"
      aria-label={label}
      data-chart={name}
      data-testid={`chart-${name}`}
    >
      {children}
    </figure>
  );
}

/* ---------- problem-flow ---------- */

const FLOW_STEPS = [
  { title: "1. Amendment signed", note: "Hyderabad L2 drops to ₹1,100" },
  { title: "2. Price master not updated", note: "Still shows ₹1,200" },
  { title: "3. PO raised at old rate", note: "₹1,200 per hour" },
  { title: "4. Invoice at old rate", note: "160 h at ₹1,200 = ₹1,92,000" },
  { title: "5. PO match passes", note: "Invoice equals PO, so it is paid" },
];

export function ProblemFlow() {
  return (
    <Figure name="problem-flow" label="How a wrong price gets paid">
      <Legend
        items={[
          { swatch: <Swatch kind="s2-box" />, label: "Where the wrong price gets through" },
          { swatch: <Swatch kind="s1-box" />, label: "Where Contract Price Truth checks" },
        ]}
      />
      <ol className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-stretch">
        {FLOW_STEPS.map((s, i) => {
          const last = i === FLOW_STEPS.length - 1;
          return (
            <li key={s.title} className="flex flex-col gap-1.5 sm:flex-1 sm:basis-32 sm:flex-row">
              <div
                className="flex flex-1 flex-col gap-1 rounded-lg bg-muted p-3 text-[13.5px]"
                style={last ? { outline: "2px solid var(--s2)", outlineOffset: -2 } : undefined}
              >
                <b className="font-semibold">{s.title}</b>
                <span className="text-muted-foreground">{s.note}</span>
              </div>
              {!last && (
                <span
                  aria-hidden="true"
                  className="self-center text-muted-foreground max-sm:rotate-90"
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div
        className="mt-2.5 flex flex-col gap-0.5 rounded-lg border-2 px-3.5 py-3 text-sm"
        style={{ borderColor: "var(--s1)" }}
      >
        <b className="font-semibold">Contract Price Truth checks here</b>
        <span className="text-muted-foreground">
          The invoice line is compared with the verified, dated price from the amendment: ₹1,76,000
          owed, ₹16,000 over.
        </span>
      </div>
      <figcaption className="mt-2 text-[13px] text-muted-foreground">
        Illustrative numbers, not the seed data.
      </figcaption>
    </Figure>
  );
}

/* ---------- metric-tree ---------- */

function Node({ small, title, edge }: { small: string; title: string; edge?: "s1" | "s2" }) {
  return (
    <div
      className="flex flex-col rounded-lg bg-muted px-3.5 py-3"
      style={edge ? { borderLeft: `4px solid var(--${edge})` } : undefined}
    >
      <small className="eyebrow">{small}</small>
      <b className="font-semibold">{title}</b>
    </div>
  );
}

function Leaf({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border px-2.5 py-2 text-[13.5px] text-muted-foreground">
      {children}
    </div>
  );
}

export function MetricTree() {
  return (
    <Figure name="metric-tree" label="Metric tree">
      <Legend
        items={[
          { swatch: <Swatch kind="s1" />, label: "North Star" },
          { swatch: <Swatch kind="s2" />, label: "Outcome" },
        ]}
      />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-3.5">
          <Node small="North Star" title="Verified-price spend coverage" edge="s1" />
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-1.5">
              <Node small="Procurement side" title="Contract coverage" />
              <Leaf>AI terms accepted without edit</Leaf>
              <Leaf>Median time, upload to verified</Leaf>
            </div>
            <div aria-hidden="true" className="self-center text-[22px] text-muted-foreground">
              ×
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Node small="Finance side" title="Check rate" />
              <Leaf>Checks returning a definite answer</Leaf>
              <Leaf>Refusals reaching the right owner</Leaf>
            </div>
          </div>
          <Node
            small="Outcome, counted only after a person confirms it"
            title="Overbilling avoided or recovered (₹)"
            edge="s2"
          />
        </div>
        <div className="min-w-0 flex-[1_1_220px] rounded-lg border border-dashed border-muted-foreground/60 px-3.5 py-3">
          <b className="eyebrow">Guardrails</b>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px]">
            <li>False clears: 0</li>
            <li>Unverified term used: 0</li>
            <li>Result with no source: 0</li>
            <li>Wrong-accepts: under 2%</li>
            <li>Verifier effort: 30 min or less</li>
            <li>Legal load: 5 or fewer per 100 checks</li>
          </ul>
        </div>
      </div>
    </Figure>
  );
}

/* ---------- trajectory ---------- */

export const TRAJECTORY = [
  { month: 0, coverage: 0, accepted: null },
  { month: 1, coverage: 25, accepted: 55 },
  { month: 2, coverage: 45, accepted: 65 },
  { month: 3, coverage: 60, accepted: 70 },
  { month: 6, coverage: 70, accepted: 80 },
  { month: 9, coverage: 75, accepted: 83 },
  { month: 12, coverage: 80, accepted: 85 },
] as const;

const X0 = 56;
const X1 = 650;
const Y0 = 308;
const Y1 = 30;
const xAt = (m: number) => X0 + ((X1 - X0) * m) / 12;
const yAt = (p: number) => Y0 - ((Y0 - Y1) * p) / 100;

function Point({
  x,
  y,
  series,
  title,
}: {
  x: number;
  y: number;
  series: "s1" | "s2";
  title: string;
}) {
  return (
    <g tabIndex={0} className="group cursor-default outline-none" aria-label={title}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={12} fill="transparent" />
      <circle
        cx={x}
        cy={y}
        r={4.5}
        fill={`var(--${series})`}
        stroke="var(--color-card)"
        strokeWidth={2}
        className="group-hover:[r:6.5px] group-focus-visible:[r:6.5px]"
      />
      <circle
        cx={x}
        cy={y}
        r={10}
        fill="none"
        stroke="var(--color-ring)"
        strokeWidth={2}
        className="opacity-0 group-focus-visible:opacity-100"
      />
    </g>
  );
}

export function Trajectory() {
  const s1 = TRAJECTORY.map((d) => `${xAt(d.month)},${yAt(d.coverage)}`);
  const s2 = TRAJECTORY.filter((d) => d.accepted !== null).map(
    (d) => `${xAt(d.month)},${yAt(d.accepted ?? 0)}`,
  );
  const axis = "fill-muted-foreground text-[12px]";
  return (
    <Figure name="trajectory" label="Target path, not a forecast">
      <figcaption className="mb-2.5 text-sm font-semibold text-muted-foreground">
        Target path, not a forecast
      </figcaption>
      <Legend
        items={[
          { swatch: <Swatch kind="s1" />, label: "North Star: verified-price spend coverage" },
          { swatch: <Swatch kind="s2-dash" />, label: "AI terms accepted without edit" },
        ]}
      />
      <svg
        viewBox="0 0 820 360"
        role="img"
        aria-label="Target path for North Star coverage and AI acceptance over 12 months"
        className="h-auto w-full max-w-[820px]"
      >
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={X0} x2={X1} y1={yAt(p)} y2={yAt(p)} stroke="var(--color-border)" />
            <text x={48} y={yAt(p) + 4} textAnchor="end" className={axis}>
              {p}%
            </text>
          </g>
        ))}
        {TRAJECTORY.map((d) => (
          <text key={d.month} x={xAt(d.month)} y={328} textAnchor="middle" className={axis}>
            {d.month}
          </text>
        ))}
        <text x={xAt(6)} y={352} textAnchor="middle" className={axis}>
          Months from pilot start
        </text>
        {[
          { m: 3, label: "Pilot exit" },
          { m: 6, label: "Expand exit" },
        ].map((g) => (
          <g key={g.m}>
            <line
              x1={xAt(g.m)}
              x2={xAt(g.m)}
              y1={Y1}
              y2={Y0}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="3 4"
            />
            <text x={xAt(g.m) + 5} y={42} className={axis}>
              {g.label}
            </text>
          </g>
        ))}
        <path
          d={`M${s1.join(" L")}`}
          fill="none"
          stroke="var(--s1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${s2.join(" L")}`}
          fill="none"
          stroke="var(--s2)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {TRAJECTORY.map((d) => (
          <Point
            key={`c${d.month}`}
            x={xAt(d.month)}
            y={yAt(d.coverage)}
            series="s1"
            title={`Month ${d.month}: North Star coverage ${d.coverage}%`}
          />
        ))}
        {TRAJECTORY.filter((d) => d.accepted !== null).map((d) => (
          <Point
            key={`a${d.month}`}
            x={xAt(d.month)}
            y={yAt(d.accepted ?? 0)}
            series="s2"
            title={`Month ${d.month}: AI terms accepted without edit ${d.accepted}%`}
          />
        ))}
        <text x={660} y={yAt(85) + 4} className="fill-foreground text-[12.5px] font-semibold">
          AI accepted, 85%
        </text>
        <text x={660} y={yAt(80) + 16} className="fill-foreground text-[12.5px] font-semibold">
          Coverage, 80%
        </text>
      </svg>
      <details className="mt-2 text-[13.5px]">
        <summary className="cursor-pointer text-muted-foreground">Table view</summary>
        <div className="mt-2 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-heading">Month</th>
                <th className="table-heading">Coverage (%)</th>
                <th className="table-heading">AI accepted without edit (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {TRAJECTORY.map((d) => (
                <tr key={d.month}>
                  <td className="px-3 py-1.5">{d.month}</td>
                  <td className="px-3 py-1.5">{d.coverage}</td>
                  <td className="px-3 py-1.5">{d.accepted ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Figure>
  );
}

/* ---------- sensitivity ---------- */

export const GRID_STEPS = [2, 5, 10] as const;

const RAMP: Record<number, { bg: string; fg: string }> = {
  4: { bg: "#cde2fb", fg: "#0b0b0b" },
  10: { bg: "#86b6ef", fg: "#0b0b0b" },
  20: { bg: "#3987e5", fg: "#0b0b0b" },
  25: { bg: "#3987e5", fg: "#0b0b0b" },
  50: { bg: "#256abf", fg: "#ffffff" },
  100: { bg: "#0d366b", fg: "#ffffff" },
};

export function cellValue(exposure: number, gap: number): number {
  return (10000 * exposure * gap) / 10000;
}

export function SensitivityGrid({
  selected,
  onPick,
}: {
  selected?: { exposure: number; gap: number } | undefined;
  onPick?: ((exposure: number, gap: number) => void) | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Exposure \ Gap
            </th>
            {GRID_STEPS.map((g) => (
              <th
                key={g}
                scope="col"
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {g}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GRID_STEPS.map((e) => (
            <tr key={e}>
              <th scope="row" className="px-3 py-2 text-left font-semibold text-muted-foreground">
                {e}%
              </th>
              {GRID_STEPS.map((g) => {
                const v = cellValue(e, g);
                const c = RAMP[v] ?? { bg: "#3987e5", fg: "#0b0b0b" };
                const title = `Exposure ${e}%, gap ${g}%: ₹${v} lakh`;
                const isSel = selected?.exposure === e && selected?.gap === g;
                const style = { background: c.bg, color: c.fg };
                return (
                  <td key={g} className="border-2 border-card p-0 text-center">
                    {onPick ? (
                      <button
                        type="button"
                        title={title}
                        aria-label={title}
                        aria-pressed={isSel}
                        onClick={() => onPick(e, g)}
                        style={style}
                        className={`block w-full min-w-16 px-4 py-4 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                          isSel ? "outline-3 -outline-offset-4 outline-[var(--s2)] underline" : ""
                        }`}
                      >
                        {v}
                      </button>
                    ) : (
                      <span
                        title={title}
                        style={style}
                        className="block min-w-16 px-4 py-4 text-lg font-semibold"
                      >
                        {v}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sensitivity({ children }: { children?: ReactNode }) {
  return (
    <Figure name="sensitivity" label="Value at stake per year">
      <figcaption className="mb-2.5 text-sm font-semibold text-muted-foreground">
        Value at stake per year, ₹ lakh per ₹100 crore of in-scope spend
      </figcaption>
      <div className="mb-2 flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>Lower</span>
        <span
          aria-hidden="true"
          className="h-2.5 w-28 rounded-sm"
          style={{ background: "linear-gradient(90deg,#cde2fb,#86b6ef,#3987e5,#256abf,#0d366b)" }}
        />
        <span>Higher value at stake, number in each cell</span>
      </div>
      {children ?? <SensitivityGrid />}
      <p className="mt-2 text-[13px] text-muted-foreground">
        Rows: share of spend whose governing price an amendment changed. Columns: average
        billed-versus-contract gap on that spend.
      </p>
    </Figure>
  );
}
