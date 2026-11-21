/**
 * Pure functions behind the three optional calculators on the About page. They illustrate
 * the reasoning on the page and are separate from the pricing engine, which owns real checks.
 * Amounts are whole rupees.
 */
import { groupIndian } from "./money";

/** Whole rupees with Indian digit grouping, for example ₹1,92,000. */
export function formatRupees(n: number): string {
  const r = Math.round(n);
  const body = `₹${groupIndian(String(Math.abs(r)))}`;
  return r < 0 ? `-${body}` : body;
}

/** Reads a whole, non negative number from a text field. Empty or invalid gives 0. */
export function readWhole(input: string, max: number): number {
  const n = Math.round(Number(input));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/* ---------- Worked example (section 3) ---------- */

export type WorkedInput = { hours: number; originalRate: number; amendedRate: number };

export const WORKED_DEFAULTS: WorkedInput = { hours: 160, originalRate: 1200, amendedRate: 1100 };

export type WorkedResult = {
  poRate: number;
  invoiceAmount: number;
  poAmount: number;
  contractAmount: number;
  difference: number;
  poCheckPasses: boolean;
  contractFlagged: boolean;
};

export function workedExample({ hours, originalRate, amendedRate }: WorkedInput): WorkedResult {
  // The purchase order was raised before the amendment, so it carries the original rate.
  const poRate = originalRate;
  const invoiceAmount = hours * originalRate;
  const poAmount = hours * poRate;
  const contractAmount = hours * amendedRate;
  const difference = invoiceAmount - contractAmount;
  return {
    poRate,
    invoiceAmount,
    poAmount,
    contractAmount,
    difference,
    poCheckPasses: invoiceAmount === poAmount,
    contractFlagged: difference > 0,
  };
}

/* ---------- Autonomy levels (section 4.1) ---------- */

export type AutonomyInput = {
  acceptedPct: number;
  termsReviewed: number;
  wrongPct: number;
  daysStable: number;
};

export const AUTONOMY_DEFAULTS: AutonomyInput = {
  acceptedPct: 70,
  termsReviewed: 60,
  wrongPct: 2,
  daysStable: 0,
};

export const LEVEL_NAMES = {
  1: "Level 1, Propose",
  2: "Level 2, Propose and pre-verify low-risk terms",
  3: "Level 3, Watch",
} as const;

export type AutonomyResult = {
  level: 1 | 2 | 3;
  level2Unlocked: boolean;
  level3Unlocked: boolean;
  level2Missing: string[];
  level3Missing: string[];
};

const pct = (n: number) => `${Number(n.toFixed(1))}%`;

export function autonomyLevel(i: AutonomyInput): AutonomyResult {
  const level2Missing: string[] = [];
  if (i.acceptedPct < 95)
    level2Missing.push(
      `Terms accepted without edit is ${pct(i.acceptedPct)}. It needs to be at least 95%.`,
    );
  if (i.termsReviewed < 200)
    level2Missing.push(`${i.termsReviewed} terms reviewed. It needs at least 200.`);
  if (i.wrongPct >= 1)
    level2Missing.push(`Wrong in the sample is ${pct(i.wrongPct)}. It needs to be under 1%.`);
  const level2Unlocked = level2Missing.length === 0;

  const level3Missing: string[] = [];
  if (!level2Unlocked) level3Missing.push("Level 2 has to be unlocked first.");
  else if (i.daysStable < 90)
    level3Missing.push(
      `Level 2 has been stable for ${i.daysStable} days with zero false clears. It needs 90.`,
    );
  const level3Unlocked = level3Missing.length === 0;

  return {
    level: level3Unlocked ? 3 : level2Unlocked ? 2 : 1,
    level2Unlocked,
    level3Unlocked,
    level2Missing,
    level3Missing,
  };
}
