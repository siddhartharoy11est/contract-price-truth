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
