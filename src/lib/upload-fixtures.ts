/**
 * Page text of the two synthetic sample PDFs in public/samples, as pdf.js reads it, and the
 * model output a correct live run would return. Used by tests and Prototype Validation to run
 * Journey D offline. These are inputs, not expected answers: every outcome is computed.
 */
import { checkTerm, type ExtractedTerm } from "./extraction/core";
import type { ExtractResponse } from "./extraction/guard";

/** A server response built from model output, with the real client side quote checks applied. */
export function mockResponse(terms: ExtractedTerm[], pages: string[]): ExtractResponse {
  const checked = terms.map((t) => checkTerm(t, pages));
  const accepted = checked.filter((c) => c.accepted).length;
  return { ok: true, pages: pages.length, chunks: 1, terms: checked, accepted, rejected: checked.length - accepted };
}

export const ORBIS_PAGES = [
  `Order Form: Orbis Facilities Services
Order Form reference OFS-2026-014
1. Parties
Buyer: Brightwave Group (Brightwave).
Supplier: Orbis Facilities Services Private Limited (Orbis).
2. Services
Orbis will provide on-site facilities staff to Brightwave offices.
Services are charged per hour worked, as set out in section 4.
3. Term
This Order Form starts on 1 December 2026 and ends on 30 November 2027.
Either party may end it earlier on 60 days written notice.
4. Rates
The rates in the table on page 2 apply to all Brightwave locations.
Rates are in Indian rupees (INR) per hour and exclude taxes.
Synthetic sample document for prototype use only Page 1 of 2`,
  `Order Form: Orbis Facilities Services (rates and signatures)
Rate table
Role: Facilities Supervisor. Rate: INR 640 per hour. Effective from 1 December 2026 to 30 November 2027.
Role: Maintenance Technician. Rate: INR 480 per hour. Effective from 1 December 2026 to 30 November 2027.
Role: Housekeeping Attendant. Rate: INR 310 per hour. Effective from 1 December 2026 to 30 November 2027.
5. Invoicing
Orbis will invoice monthly in arrears. Each invoice line shows the role, hours and hourly rate.
6. Signatures
Signed for Brightwave Group by A. Verma, Head of Procurement, on 18 November 2026.
Signed for Orbis Facilities Services Private Limited by R. Kulkarni, Director, on 18 November 2026.
This is a synthetic sample document created for a prototype. It describes no real company.
Synthetic sample document for prototype use only Page 2 of 2`,
];

export const AMENDMENT_3_PAGES = [
  `Amendment 3 to the Master Services Agreement
Parties: Brightwave Group (Buyer) and BrightHire Staffing Private Limited (Supplier).
Master Services Agreement dated 1 April 2025 (the MSA).
This Amendment 3 is effective from 1 November 2026.
1. Revised rate
The hourly rate for Grade L2 for services delivered at the Hyderabad Delivery Center
is revised to INR 500 per hour with effect from 1 November 2026.
2. Scope of this amendment
This amendment applies only to services delivered at the Hyderabad Delivery Center.
It does not change the rate for any other Delivery Center, and it does not change the
rate for any other Grade. Rates for all other locations and Grades are unchanged.
3. Other terms
Except as stated in this Amendment 3, the MSA and its schedules remain in force.
4. Signatures
Signed for Brightwave Group by A. Verma, Head of Procurement, on 28 October 2026.
Signed for BrightHire Staffing Private Limited by S. Menon, Director, on 28 October 2026.
This is a synthetic sample document created for a prototype. It describes no real company.
Synthetic sample document for prototype use only Page 1 of 1`,
];

const orbisRow = (role: string, amount: number): ExtractedTerm => ({
  role,
  location: "all",
  unit: "hour",
  amount,
  currency: "INR",
  effective_from: "2026-12-01",
  effective_to: "2027-11-30",
  conditions: null,
  page: 2,
  clause_reference: "Rate table",
  quote: `Role: ${role}. Rate: INR ${amount} per hour.`,
  scope_page: 1,
});

export const orbisTerms = (): ExtractedTerm[] => [
  orbisRow("Facilities Supervisor", 640),
  orbisRow("Maintenance Technician", 480),
  orbisRow("Housekeeping Attendant", 310),
];

export const amendment3Terms = (): ExtractedTerm[] => [
  {
    role: "Grade L2",
    location: "Hyderabad Delivery Center",
    unit: "hour",
    amount: 500,
    currency: "INR",
    effective_from: "2026-11-01",
    effective_to: null,
    conditions: "This amendment applies only to services delivered at the Hyderabad Delivery Center.",
    page: 1,
    clause_reference: "1",
    quote: "is revised to INR 500 per hour with effect from 1 November 2026.",
    scope_page: null,
  },
];
