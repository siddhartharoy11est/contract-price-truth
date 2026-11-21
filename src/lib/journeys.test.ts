/**
 * Journeys A to D walked on the real engine and workflow, with no UI, network or model call.
 * The checkpoints come from the shared list in test-cases.ts, which the Prototype Validation
 * page also runs.
 */
import { describe, expect, it } from "vitest";
import { JOURNEY_CASES, runJourneyCase } from "./test-cases";
import { seedWorkflow } from "./workflow";

describe("journey cases", () => {
  for (const tc of JOURNEY_CASES)
    it(`${tc.id}: ${tc.description}`, () => {
      const r = runJourneyCase(tc);
      expect(r.actual).toEqual(tc.expected);
    });

  it("cover Journeys A, B, C and D", () => {
    expect(new Set(JOURNEY_CASES.map((c) => c.journey))).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("run on an isolated seed copy: running them twice gives the same result", () => {
    const first = JOURNEY_CASES.map((c) => runJourneyCase(c).actual);
    const second = JOURNEY_CASES.map((c) => runJourneyCase(c).actual);
    expect(second).toEqual(first);
    expect(seedWorkflow().uploads.documents).toEqual([]);
  });
});
