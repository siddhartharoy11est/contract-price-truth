import { describe, expect, it } from "vitest";
import { deriveEvidence, quoteOnPage } from "./live-read";

const pages = [
  "Services are charged per hour worked, as set out in section 4.\n4. Rates\nThe rates in the table on page 2 apply to all Brightwave locations.\nRates are in Indian rupees (INR) per hour and exclude taxes.",
  "Role Rate per hour (INR) Effective from Effective to\nFacilities Supervisor 640 1 December 2026 30 November 2027",
];
const quote = "Facilities Supervisor 640 1 December 2026 30 November 2027";

describe("extraction quote checks", () => {
  it("accepts a short numeric quote only inside the main quote and on the cited page", () => {
    expect(quoteOnPage("640", 2, pages, quote)).toEqual({ ok: true });
    expect(quoteOnPage("640", 2, pages).ok).toBe(false);
    expect(quoteOnPage("641", 2, pages, quote).ok).toBe(false);
    expect(quoteOnPage("Rates", 1, pages, "Rates").ok).toBe(false);
  });

  it("normalizes ligatures and whitespace per page", () => {
    expect(quoteOnPage("Facilities  Supervisor 640", 1, ["Facilities Supervisor 640"]).ok).toBe(true);
    expect(quoteOnPage("Faciﬂities Supervisor", 2, pages).ok).toBe(false);
    expect(quoteOnPage("eﬀective from", 1, ["effective from 1 Dec"]).ok).toBe(true);
  });

  it("derives evidence from the quote, the cited page and the scope page, and flags what it cannot locate", () => {
    const ev = deriveEvidence(
      {
        role: "Facilities Supervisor",
        location: "all",
        unit: "hour",
        amount: 640,
        currency: "INR",
        effective_from: "2026-12-01",
        effective_to: "2027-11-30",
        conditions: "Rates are in Indian rupees (INR) per hour and exclude taxes.",
        clause_reference: "4. Rates",
      },
      quote,
      2,
      pages,
      1,
    );
    const where = Object.fromEntries(ev.map((e) => [e.field, e.located]));
    expect(where).toEqual({
      role: "quote",
      location: "scope page",
      unit: "page",
      amount: "quote",
      currency: "page",
      effective_from: "quote",
      effective_to: "quote",
      conditions: "scope page",
      clause_reference: "scope page",
    });
    const missing = deriveEvidence({ location: "Chennai", amount: 999 }, quote, 2, pages, null);
    expect(missing.every((e) => e.located === null)).toBe(true);
  });

  it("matches Indian and international digit grouping for amounts", () => {
    const ev = deriveEvidence({ amount: 105000 }, "rate of INR 1,05,000 per month", 1, ["rate of INR 1,05,000 per month"]);
    expect(ev[0]?.located).toBe("quote");
    const ev2 = deriveEvidence({ amount: 1400 }, "USD 1,400.00 per day", 1, ["USD 1,400.00 per day"]);
    expect(ev2[0]?.located).toBe("quote");
    const ev3 = deriveEvidence({ amount: 140 }, "USD 1,400 per day", 1, ["USD 1,400 per day"]);
    expect(ev3[0]?.located).toBe(null);
  });
});
