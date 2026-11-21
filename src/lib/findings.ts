import type { InvoiceLine, Location, Reading, RoleId } from "@/data/types";
import type { PriceResult } from "./pricing-engine";

export type FindingStatus = "Open" | "With Legal" | "Confirmed" | "Dismissed" | "Cleared";

export interface TimelineEntry {
  at: string;
  by: string;
  role: RoleId;
  text: string;
}

export interface Finding {
  id: string;
  createdAt: string;
  fixtureId: string | null;
  line: InvoiceLine;
  status: FindingStatus;
  raisedStatus: string;
  confirmedPaise?: number;
  factsSupplied?: boolean;
  escalated?: boolean;
  timeline: TimelineEntry[];
}

export interface Ruling {
  reading: Reading;
  reasoning: string;
  by: string;
  at: string;
}

export function statusAfterRecalc(result: PriceResult, escalated: boolean): FindingStatus {
  if (result.status === "Match" || result.status === "Billed below contract") return "Cleared";
  if (result.status === "Needs Legal" && escalated) return "With Legal";
  return "Open";
}

export function sameLine(a: InvoiceLine, b: InvoiceLine): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const isLocation = (v: string): v is Location => ["Bengaluru", "Pune", "Hyderabad"].includes(v);
