import type { Conflict, ContractDocument, Location, RoleMapEntry, SeedTerm, Supplier } from "./types";

/** All data below is synthetic. Brightwave Group and BrightHire Staffing are fictional. */

export const BUYER = "Brightwave Group";
export const DEMO_SUPPLIER_ID = "brighthire";
export const LOCATIONS: Location[] = ["Bengaluru", "Pune", "Hyderabad"];

/** Supplier-specific role maps. A role is matched only through this map, never inferred from a rate. */
export const ROLE_MAPS: Record<string, RoleMapEntry[]> = {
  brighthire: [
    { grade: "L4", role: "Senior Software Engineer" },
    { grade: "L3", role: "Software Engineer" },
    { grade: "L2", role: "QA Analyst" },
  ],
};

export const SUPPLIERS: Supplier[] = [
  { id: "brighthire", name: "BrightHire Staffing", category: "IT staffing", deliveryCenters: LOCATIONS },
  {
    id: "swiftfreight",
    name: "SwiftFreight Logistics",
    category: "Freight and logistics",
    stubDocuments: ["Freight Services Agreement 2024", "Fuel Surcharge Schedule 2025"],
  },
  {
    id: "kestrel",
    name: "Kestrel Facilities",
    category: "Facilities management",
    stubDocuments: ["Facilities Management Agreement 2025"],
  },
  {
    id: "datavault",
    name: "DataVault Security",
    category: "Cyber security services",
    stubDocuments: ["Managed Security Services Agreement", "Service Level Schedule"],
  },
];

export const DOCUMENTS: ContractDocument[] = [
  {
    id: "BH-MSA-2025",
    supplierId: "brighthire",
    title: "Master Services Agreement",
    kind: "Agreement",
    status: "Signed",
    signed: true,
    dateLine: "Signed 14 Mar 2025. Effective 1 Apr 2025.",
    effectiveFrom: "2025-04-01",
    clauses: [
      {
        id: "1",
        label: "1",
        text: "Agreement between Brightwave Group and BrightHire Staffing, effective 1 April 2025 (the Effective Date).",
      },
      {
        id: "4.1",
        label: "4.1 Fees",
        text: "Customer shall pay the hourly rates in Schedule A for each resource supplied. All amounts are in Indian Rupees and exclude GST.",
      },
      {
        id: "4.2",
        label: "4.2 Invoicing",
        text: "Supplier shall invoice monthly in arrears. Each invoice line must state the role, grade, delivery center and hours worked.",
      },
      {
        id: "4.3",
        label: "4.3 Annual adjustment",
        text: "On each anniversary of the Effective Date, Supplier may increase any rate in a Schedule by up to the lesser of 3% or the annual percentage change in the Consumer Price Index for the preceding calendar year, by giving Buyer at least 60 days' written notice.",
      },
      {
        id: "9.1",
        label: "9.1 Term",
        text: "The initial term is 24 months from the Effective Date (the Initial Term). After that the Agreement renews for successive 12-month periods unless either party gives 90 days' written notice.",
      },
      {
        id: "11.2",
        label: "11.2 Interpretation",
        text: "The body of this Agreement and the Schedules form one agreement and are to be read together. Where they are inconsistent, the parties will give effect to the intention of the Agreement as a whole.",
      },
    ],
  },
  {
    id: "BH-SCH-A-2025",
    supplierId: "brighthire",
    title: "Rate Schedule A",
    kind: "Schedule",
    status: "Signed",
    signed: true,
    dateLine: "Signed 14 Mar 2025. Effective 1 Apr 2025.",
    effectiveFrom: "2025-04-01",
    clauses: [
      { id: "Row 1", label: "Row 1", text: "Senior Software Engineer (Grade L4): ₹1,200 per hour." },
      { id: "Row 2", label: "Row 2", text: "Software Engineer (Grade L3): ₹850 per hour." },
      { id: "Row 3", label: "Row 3", text: "QA Analyst (Grade L2): ₹520 per hour." },
      {
        id: "Note 1",
        label: "Note 1",
        text: "Rates apply to resources delivered from any Supplier delivery center unless this Schedule states otherwise.",
      },
      {
        id: "Note 2",
        label: "Note 2",
        text: "Rates are fixed for the Initial Term of this Agreement (1 April 2025 to 31 March 2027).",
      },
    ],
  },
  {
    id: "BH-AMD-01-2026",
    supplierId: "brighthire",
    title: "Amendment 1",
    kind: "Amendment",
    status: "Signed",
    signed: true,
    dateLine: "Signed 20 Jul 2026. Effective 1 Aug 2026.",
    effectiveFrom: "2026-08-01",
    clauses: [
      {
        id: "2.1",
        label: "2.1",
        text: "With effect from 1 August 2026, the hourly rate for Senior Software Engineer (Grade L4) resources delivered from the Bengaluru Delivery Center is reduced from ₹1,200 to ₹1,050.",
      },
      {
        id: "2.2",
        label: "2.2",
        text: "With effect from 1 August 2026, the hourly rate for Software Engineer (Grade L3) is reduced from ₹850 to ₹800 for all delivery centers.",
      },
      { id: "2.3", label: "2.3", text: "All other rates in Schedule A remain unchanged." },
      { id: "3", label: "3", text: "This Amendment applies to services performed on or after 1 August 2026." },
    ],
  },
  {
    id: "BH-AMD-02-DRAFT",
    supplierId: "brighthire",
    title: "Amendment 2 (draft)",
    kind: "Amendment",
    status: "Draft, unsigned",
    signed: false,
    dateLine: "DRAFT, UNSIGNED. Dated 1 Sep 2026.",
    effectiveFrom: null,
    clauses: [
      {
        id: "2.1",
        label: "2.1",
        text: "Proposed: the hourly rate for Senior Software Engineer (Grade L4) resources delivered from the Pune Delivery Center is reduced to ₹990 with effect from 1 October 2026.",
      },
      { id: "9", label: "9", text: "This draft has not been signed by either party." },
    ],
    note: "A draft is visible for reference but never governs any price.",
  },
  {
    id: "BH-NOTICE-2026",
    supplierId: "brighthire",
    title: "Supplier letter: annual adjustment notice",
    kind: "Supplier letter",
    status: "Received notice",
    signed: true,
    dateLine: "Letter dated 15 Jan 2026.",
    effectiveFrom: "2026-04-01",
    clauses: [
      {
        id: "Letter",
        label: "Letter",
        text: "Under clause 4.3 of the Master Services Agreement we give notice of a 2.5% increase to the QA Analyst (Grade L2) rate with effect from 1 April 2026, to ₹533 per hour. This reflects the annual CPI change of 2.5%.",
      },
    ],
    note: "The CPI figure is stated by the supplier and is not independently verified.",
  },
];

export const TERMS: SeedTerm[] = [
  {
    id: "T01",
    kind: "rate",
    title: "Senior Software Engineer (L4) hourly rate",
    docId: "BH-SCH-A-2025",
    clauseId: "Row 1",
    quote: "Senior Software Engineer (Grade L4): ₹1,200 per hour.",
    grade: "L4",
    location: "all",
    ratePaise: 120000,
    effectiveFrom: "2025-04-01",
    initialStatus: "Verified",
  },
  {
    id: "T02",
    kind: "rate",
    title: "L4 Bengaluru reduced rate",
    docId: "BH-AMD-01-2026",
    clauseId: "2.1",
    quote:
      "the hourly rate for Senior Software Engineer (Grade L4) resources delivered from the Bengaluru Delivery Center is reduced from ₹1,200 to ₹1,050",
    grade: "L4",
    location: "Bengaluru",
    ratePaise: 105000,
    effectiveFrom: "2026-08-01",
    replaces: "T01",
    initialStatus: "Proposed",
  },
  {
    id: "T03",
    kind: "rate",
    title: "Software Engineer (L3) hourly rate",
    docId: "BH-SCH-A-2025",
    clauseId: "Row 2",
    quote: "Software Engineer (Grade L3): ₹850 per hour.",
    grade: "L3",
    location: "all",
    ratePaise: 85000,
    effectiveFrom: "2025-04-01",
    initialStatus: "Verified",
  },
  {
    id: "T04",
    kind: "rate",
    title: "L3 reduced rate, all centers",
    docId: "BH-AMD-01-2026",
    clauseId: "2.2",
    quote:
      "the hourly rate for Software Engineer (Grade L3) is reduced from ₹850 to ₹800 for all delivery centers",
    grade: "L3",
    location: "all",
    ratePaise: 80000,
    effectiveFrom: "2026-08-01",
    replaces: "T03",
    initialStatus: "Proposed",
  },
  {
    id: "T05",
    kind: "rate",
    title: "QA Analyst (L2) hourly rate",
    docId: "BH-SCH-A-2025",
    clauseId: "Row 3",
    quote: "QA Analyst (Grade L2): ₹520 per hour.",
    grade: "L2",
    location: "all",
    ratePaise: 52000,
    effectiveFrom: "2025-04-01",
    initialStatus: "Verified",
  },
  {
    id: "T06",
    kind: "clause",
    title: "Fixed-rate note (Schedule A Note 2)",
    docId: "BH-SCH-A-2025",
    clauseId: "Note 2",
    quote: "Rates are fixed for the Initial Term of this Agreement (1 April 2025 to 31 March 2027).",
    grade: null,
    location: null,
    ratePaise: null,
    effectiveFrom: null,
    initialStatus: "Needs review",
    conflictId: "C1",
  },
  {
    id: "T07",
    kind: "clause",
    title: "Annual adjustment clause",
    docId: "BH-MSA-2025",
    clauseId: "4.3",
    quote:
      "Supplier may increase any rate in a Schedule by up to the lesser of 3% or the annual percentage change in the Consumer Price Index for the preceding calendar year, by giving Buyer at least 60 days' written notice",
    grade: null,
    location: null,
    ratePaise: null,
    effectiveFrom: null,
    capPct: 3,
    noticeDaysRequired: 60,
    initialStatus: "Needs review",
    conflictId: "C1",
  },
  {
    id: "T08",
    kind: "clause",
    title: "Interpretation clause",
    docId: "BH-MSA-2025",
    clauseId: "11.2",
    quote:
      "The body of this Agreement and the Schedules form one agreement and are to be read together. Where they are inconsistent, the parties will give effect to the intention of the Agreement as a whole.",
    grade: null,
    location: null,
    ratePaise: null,
    effectiveFrom: null,
    initialStatus: "Needs review",
    conflictId: "C1",
  },
  {
    id: "T09",
    kind: "notice",
    title: "Supplier notice: L2 increase",
    docId: "BH-NOTICE-2026",
    clauseId: "Letter",
    quote:
      "a 2.5% increase to the QA Analyst (Grade L2) rate with effect from 1 April 2026, to ₹533 per hour",
    grade: "L2",
    location: "all",
    ratePaise: 53300,
    effectiveFrom: "2026-04-01",
    noticeDate: "2026-01-15",
    statedCpiPct: 2.5,
    initialStatus: "Needs review",
    conflictId: "C1",
    note: "CPI of 2.5% is stated by the supplier and is not independently verified.",
  },
  {
    id: "T10",
    kind: "draft",
    title: "Draft proposal: L4 Pune rate",
    docId: "BH-AMD-02-DRAFT",
    clauseId: "2.1",
    quote:
      "the hourly rate for Senior Software Engineer (Grade L4) resources delivered from the Pune Delivery Center is reduced to ₹990 with effect from 1 October 2026",
    grade: "L4",
    location: "Pune",
    ratePaise: 99000,
    effectiveFrom: "2026-10-01",
    initialStatus: "Ignored",
    note: "Unsigned draft. Never governs a price.",
  },
];

export const CONFLICTS: Conflict[] = [
  {
    id: "C1",
    question:
      "Are rates fixed for the Initial Term, or may the supplier apply the annual adjustment?",
    termIds: ["T06", "T07", "T08", "T09"],
    readings: [
      {
        reading: "A",
        summary: "Rates are fixed for the Initial Term. No increase applies.",
        detail:
          "Schedule A Note 2 is the specific commercial term for the Initial Term (1 Apr 2025 to 31 Mar 2027). MSA 4.3 first operates on the anniversary after the Initial Term ends. L2 governs at ₹520 and the notice has no effect.",
        termIds: ["T06", "T08"],
      },
      {
        reading: "B",
        summary: "The adjustment right operates during the Initial Term.",
        detail:
          "MSA 4.3 is the agreed mechanism by which fixed rates may move, and Note 2 means no change outside that mechanism. The notice of 15 Jan 2026 satisfies 4.3, so L2 governs at ₹533 from 1 Apr 2026.",
        termIds: ["T07", "T09"],
      },
    ],
  },
];

export const docById = (id: string) => DOCUMENTS.find((d) => d.id === id);
export const termById = (id: string) => TERMS.find((t) => t.id === id);
export const supplierById = (id: string) => SUPPLIERS.find((s) => s.id === id);

/** Plain text of a document, used for the live AI read and the quote check. */
export function documentPlainText(docId: string): string {
  const doc = docById(docId);
  if (!doc) return "";
  const lines = [`${doc.id}: ${doc.title}`, `Status: ${doc.status}. ${doc.dateLine}`, ""];
  for (const c of doc.clauses) lines.push(`Clause ${c.label}: ${c.text}`);
  return lines.join("\n");
}
