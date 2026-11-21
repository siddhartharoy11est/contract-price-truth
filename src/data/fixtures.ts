import type { InvoiceLine } from "./types";

export interface InvoiceFixture {
  id: string;
  summary: string;
  line: InvoiceLine;
}

const base = { poRatePaise: null } as const;

export const FIXTURES: InvoiceFixture[] = [
  {
    id: "S01",
    summary: "Sep 2026, L4, Bengaluru, billed ₹1,200, PO ₹1,200",
    line: { grade: "L4", location: "Bengaluru", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 100, billedRatePaise: 120000, poRatePaise: 120000 },
  },
  {
    id: "S02",
    summary: "Sep 2026, L4, Bengaluru, billed ₹1,050",
    line: { ...base, grade: "L4", location: "Bengaluru", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 100, billedRatePaise: 105000 },
  },
  {
    id: "S03",
    summary: "Sep 2026, L4, Pune, billed ₹1,200",
    line: { ...base, grade: "L4", location: "Pune", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 100, billedRatePaise: 120000 },
  },
  {
    id: "S04",
    summary: "31 Jul 2026 only, L4, Bengaluru, billed ₹1,200",
    line: { ...base, grade: "L4", location: "Bengaluru", serviceStart: "2026-07-31", serviceEnd: "2026-07-31", hours: 100, billedRatePaise: 120000 },
  },
  {
    id: "S05",
    summary: "1 Aug 2026 only, L4, Bengaluru, billed ₹1,200",
    line: { ...base, grade: "L4", location: "Bengaluru", serviceStart: "2026-08-01", serviceEnd: "2026-08-01", hours: 100, billedRatePaise: 120000 },
  },
  {
    id: "S06",
    summary: "Oct 2026, L4, Pune, billed ₹1,200 (draft proposes ₹990)",
    line: { ...base, grade: "L4", location: "Pune", serviceStart: "2026-10-01", serviceEnd: "2026-10-31", hours: 100, billedRatePaise: 120000 },
  },
  {
    id: "S07",
    summary: "Sep 2026, L4, location not stated, billed ₹1,200",
    line: { ...base, grade: "L4", location: "", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 100, billedRatePaise: 120000 },
  },
  {
    id: "S08",
    summary: "Sep 2026, L3, Hyderabad, 80h, billed ₹850",
    line: { ...base, grade: "L3", location: "Hyderabad", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 80, billedRatePaise: 85000 },
  },
  {
    id: "S09",
    summary: "Nov 2026, L2, Pune, billed ₹533",
    line: { ...base, grade: "L2", location: "Pune", serviceStart: "2026-11-01", serviceEnd: "2026-11-30", hours: 100, billedRatePaise: 53300 },
  },
  {
    id: "S10",
    summary: 'Sep 2026, grade "Analyst", Hyderabad, 60h, billed ₹800',
    line: { ...base, grade: "Analyst", location: "Hyderabad", serviceStart: "2026-09-01", serviceEnd: "2026-09-30", hours: 60, billedRatePaise: 80000 },
  },
  {
    id: "S11",
    summary: "25 Jul to 8 Aug 2026, L4, Bengaluru, billed ₹1,200",
    line: { ...base, grade: "L4", location: "Bengaluru", serviceStart: "2026-07-25", serviceEnd: "2026-08-08", hours: 100, billedRatePaise: 120000 },
  },
];

export const fixtureById = (id: string) => FIXTURES.find((f) => f.id === id);
