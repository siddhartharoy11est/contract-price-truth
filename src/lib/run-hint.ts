/**
 * Remaining-runs hint for the upload dialog. A courtesy only: it counts this browser's runs and
 * is not a safeguard. The server function enforces the real per-client and global limits.
 */
import type { ExtractionRun } from "./catalog";
import { LIMITS } from "./extraction/guard";

export const PER_CLIENT_HINT = `live extraction allows about ${LIMITS.perClientPerDay} runs per connection per day, and pauses for everyone when the daily total is reached.`;

/** Live runs this browser recorded today that reached the model or its limits. */
export function liveRunsToday(runs: ExtractionRun[], now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  return runs.filter(
    (r) =>
      r.source === "Live" &&
      r.at.slice(0, 10) === day &&
      (r.status === "Completed" || r.code === "extraction_failed"),
  ).length;
}
