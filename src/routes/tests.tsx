import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Chip, ResultStatusChip } from "@/components/app/chips";
import {
  JOURNEY_CASES,
  runAllJourneys,
  runAllTests,
  TEST_CASES,
  type JourneyRun,
  type TestRun,
} from "@/lib/test-cases";
import { formatINR } from "@/lib/money";

export const Route = createFileRoute("/tests")({
  head: () => ({
    meta: [
      { title: "Prototype Validation · Contract Price Truth" },
      {
        name: "description",
        content:
          "Every example invoice line run through the pricing engine, with expected and actual results.",
      },
      { property: "og:title", content: "Prototype Validation · Contract Price Truth" },
      {
        property: "og:description",
        content:
          "Every example invoice line run through the pricing engine, with expected and actual results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestsPage,
});

const money = (p: number | null | undefined) => (p === null || p === undefined ? "" : formatINR(p));

/** Signed difference in words. Negative is below contract, never an excess. */
function diffText(p: number | null | undefined): string {
  if (p === undefined) return "";
  if (p === null) return "provisional, no verdict";
  if (p > 0) return `excess ${formatINR(p)}`;
  if (p < 0) return `below contract by ${formatINR(-p)}`;
  return "Match";
}

function TestsPage() {
  const [runs, setRuns] = useState<TestRun[] | null>(null);
  const [journeys, setJourneys] = useState<JourneyRun[] | null>(null);
  const [ranAt, setRanAt] = useState<string>("");
  const run = () => {
    setRuns(runAllTests());
    setJourneys(runAllJourneys());
    setRanAt(new Date().toLocaleTimeString());
  };
  useEffect(run, []);
  const passed = runs?.filter((r) => r.pass).length ?? 0;
  const journeysPassed = journeys?.filter((r) => r.pass).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Developer area"
        title="Prototype Validation"
        actions={
          <Button variant="outline" size="sm" onClick={run}>
            Run validation
          </Button>
        }
      >
        Runs the shared test list ({TEST_CASES.length} cases, PRD 8.1 and 8.2) against the pricing
        engine. Each case names its fixture state: SEED, VR (rate terms and override links
        verified), CR (clauses reviewed, conflict with Legal), RULED-A or RULED-B. The same list
        drives the automated engine tests. It also walks {JOURNEY_CASES.length} journey cases
        (Journeys A to D) through the real workflow. Everything runs on an isolated in-memory copy
        of the seed with no network or model call. Your own session is not used or changed.
      </PageHeader>

      {runs && journeys && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <Chip tone={passed === runs.length ? "success" : "danger"}>
            Scenarios: {passed} of {runs.length} passing
          </Chip>
          <Chip tone={journeysPassed === journeys.length ? "success" : "danger"}>
            Journeys: {journeysPassed} of {journeys.length} passing
          </Chip>
          <span className="text-muted-foreground">Last run {ranAt}</span>
        </p>
      )}

      <h2 className="mb-2 text-base font-semibold">Scenario cases (PRD 8.1 and 8.2)</h2>

      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left">
              {["Case", "State", "Expected", "Actual", "Result"].map((h) => (
                <th key={h} className="eyebrow px-3 py-2.5 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {runs?.map((r) => {
              const e = r.testCase.expected;
              return (
                <tr key={r.testCase.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs font-medium">{r.testCase.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.testCase.description}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.testCase.state}</td>
                  <td className="px-3 py-2.5">
                    <ResultStatusChip status={e.status} />
                    <span className="mt-1 block font-mono text-xs">
                      {e.ratePaise !== undefined && `${money(e.ratePaise)}/h `}
                      {e.differencePaise !== undefined && diffText(e.differencePaise)}
                      {e.needKind && ` asks for ${e.needKind}`}
                      {e.needKinds &&
                        e.needKinds.length > 0 &&
                        ` asks for ${e.needKinds.join(", ")}`}
                      {e.noAmounts && "no amounts, no verdict"}
                      {e.outcomes?.map((o) => (
                        <span key={o.label} className="block">
                          {o.label}: {money(o.ratePaise)}/h, {diffText(o.differencePaise)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ResultStatusChip status={r.result.status} />
                    <span className="mt-1 block font-mono text-xs">
                      {r.result.applicableRatePaise !== null &&
                        `${money(r.result.applicableRatePaise)}/h `}
                      {r.result.differencePaise !== null && diffText(r.result.differencePaise)}
                      {r.result.needs &&
                        ` asks for ${r.result.needs.map((n) => n.kind).join(", ")}`}
                      {r.result.outcomes?.map((o) => (
                        <span key={o.label} className="block">
                          {o.label}: {money(o.ratePaise)}/h, {diffText(o.differencePaise)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.pass ? <Chip tone="success">Pass</Chip> : <Chip tone="danger">Fail</Chip>}
                    {r.mismatches.map((m) => (
                      <span key={m} className="mt-1 block text-xs text-danger">
                        {m}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-1 mt-8 text-base font-semibold">Journey cases (PRD 5.1 to 5.4)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Each case runs a sequence of actions through the workflow and engine. Journey D uses the two
        sample PDFs' page text and a fixed model output that still passes through the real quote
        checks, so no live call is made. Expected checkpoints are listed beside the computed ones.
      </p>
      <div className="space-y-3">
        {journeys?.map((r) => (
          <section key={r.testCase.id} className="surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium">{r.testCase.id}</span>
              <Chip>Journey {r.testCase.journey}</Chip>
              <span className="flex-1 text-sm">{r.testCase.description}</span>
              {r.pass ? <Chip tone="success">Pass</Chip> : <Chip tone="danger">Fail</Chip>}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="eyebrow mb-1">Expected</p>
                <ol className="space-y-1 font-mono text-xs">
                  {r.testCase.expected.map((x, i) => (
                    <li key={i}>
                      {i + 1}. {x}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="eyebrow mb-1">Actual</p>
                <ol className="space-y-1 font-mono text-xs">
                  {r.actual.map((x, i) => (
                    <li key={i} className={x === r.testCase.expected[i] ? "" : "text-danger"}>
                      {i + 1}. {x}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
