# About This Project: content for the in-app page

This is the page content for the About This Project screen. The Sirion brief asks for five items inside the prototype itself: why this stage, a stakeholder map, the problem, the working prototype, and success metrics. Section numbers below match that list. Square brackets mark things Sid must fill in or confirm before submission.

---

## Contract Price Truth

**Know the price you agreed to pay.**

Contract Price Truth turns signed supplier contracts, schedules and amendments into a verified, dated price book where every price links to the exact clause it came from. One invoice line can then be checked against that price. AI reads and proposes. Procurement verifies. Fixed rules, not AI, decide which rate applies. Legal is asked only when the contract genuinely contradicts itself.

All data in this prototype is synthetic. The people and the company (Brightwave Group, a buyer with about 3,000 employees and 2,500 suppliers) are simulated.

---

## 1. Why this stage

We chose the **intelligent repository** and built one job on top of it: knowing which price applies.

- **The brief names the outcome.** It lists "invoices that don't match agreed prices" as a result of contracts that are rarely looked at after signing. A repository is the only stage that can answer "what did we actually agree?" once the contract is signed.
- **A repository only matters if it changes a decision.** Searching a pile of PDFs is not enough. A verified price that Finance can test an invoice against is a decision the company makes every month.
- **It feeds the other two stages.** Intake and negotiation both start from what is already agreed. A trusted source of truth makes both better.
- **There is a public example of the payoff.** Sirion reports <https://www.sirion.ai/library/case-study/transforming-contract-governance/> that a global oil and gas company found $235M in hard savings by validating invoices and work orders against contract terms. This is company produced, so we treat it as a signal that the problem is worth solving, not as proof of our size of benefit.
- **Honest alternative.** One person we spoke to, a legal counsel, would have started with drafting, because drafting is her daily pain. We chose the repository because drafting does not help the contracts that are already signed.

## 2. Stakeholder map

| Who | What they want | Where it conflicts |
|---|---|---|
| **Procurement (Priya Nair), primary user** | A price book she can trust, with the amendment history, without reading every PDF | Wants to be fast, but any price she verifies becomes the basis for paying or disputing invoices |
| **Finance, Accounts Payable (Dev Mehta)** | A clear answer on one invoice line, and a clear owner when the answer is not yet available | Wants to pay on time, while Procurement still has terms to verify |
| **Legal (Anika Rao), escalation only** | To rule only on genuine interpretation conflicts | Does not want to become the default reviewer for every doubt |
| **Business owner who ordered the work** | The supplier to keep delivering | Resists a price dispute with a supplier they depend on |
| **The supplier (BrightHire Staffing)** | To be paid at the rate it believes applies, and to raise annual increases | A supplier notice can contradict a price lock. The notice is a claim, never an authority |
| **Leadership and audit** | Savings and control they can defend | Want numbers, but unverified numbers are worse than none |

Where interests clash, the product does not pick a side. It separates three different gaps and sends each to the right owner: missing invoice facts go to whoever knows them, unverified contract authority goes to Procurement, and a genuine clause conflict goes to Legal.

## 3. The problem

**Who it affects:** Procurement, Finance and Legal in any company that buys from many suppliers under contracts that change through amendments.

**Why it matters:** a purchase order and an invoice can agree with each other while both carry a price that a signed amendment has since changed. Standard invoice matching compares the invoice to the purchase order, not to the contract, so it cannot see that.

**How we know it is real, and what we do not know**

- **The brief itself** lists invoices that do not match agreed prices as a consequence of contracts left unreviewed after signing.
- **The mechanism is documented.** SAP's own knowledge base article 3558118 says a purchase order price is not automatically updated after a price change in the purchase contract (<https://userapps.support.sap.com/sap/support/knowledge/en/3558118>). Microsoft's Dynamics 365 documentation says two-way matching compares the invoice unit price to the purchase order unit price (<https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching>). These show the gap exists. They do not show how often it costs money.
- **Three informal interviews**, all held on 18 November 2026, a small number and directional only: a legal counsel at a B2B software company across 12 countries; a program manager on the provider side of outsourcing deals; a contract owner on the buyer side at a company where the CFO signs. They described contracts scattered across a CRM and shared drives, signed copies downloaded one by one, service level breaches found only in after-the-fact audits, and a firm view that AI output needs a human review. **None of them independently confirmed how often amendment driven invoice price errors happen**, and we do not use them for any frequency, size or savings claim.
- **Unknowns we state:** how often amendments change prices, whether buyers already compare purchase orders to contracts, and whether the pain is big enough to justify a separate product.

## 4. The working prototype

**Try it in about three minutes.** Choose a persona on the landing screen. The accounts are simulated, to show how roles connect. They are not real security.

1. **Journey A, existing contracts (Priya, then Dev).** Open the price book, check the quote behind a rate, verify an amendment term, then check one invoice line as Dev. See the exact amount and the clause it relies on, or a refusal that names who can resolve it. Raise an investigation.
2. **Journey B, missing information.** Check a line with no delivery location. The product asks for the missing fact instead of guessing. Priya supplies it, and the check recalculates as a new version.
3. **Journey C, a real contract conflict.** One clause allows an annual increase, another says rates are fixed for the term, and a supplier notice asks for an increase. Priya escalates, Anika rules, and every affected line recalculates. The result does not depend on the rate billed.
4. **Journey D, upload a new contract.** Upload a searchable PDF (two samples are provided). AI proposes rate terms with exact quotes. Nothing counts until Procurement verifies it.

Every result shows the document, page, clause and quote. Results and versions are kept, so a later change never erases an earlier decision.

## 5. Success metrics

**North star (in production):** the share of annual supplier spend that is covered by a human-verified, dated price. If this rises, Finance can check more invoices against a trusted price.

**In this prototype** we show a proxy: verified rate terms divided by all rate terms from signed documents (3 of 5, 60% in the seed data). It is labelled as a proxy.

**How we would know it works** (starting targets, to be tested):
- Share of AI proposed terms that Procurement accepts without editing.
- Time from upload to a verified price book for one contract.
- **False clears:** invoice lines shown as Match that were later found wrong. The target is zero, because a wrong "all clear" is worse than a refusal.
- Share of checks that return a definite answer versus a clear refusal, and how often a refusal reaches the right owner.
- Share of Legal escalations that Legal agrees were genuine conflicts.

**What would make us rethink**
- Amendments rarely change prices in real portfolios, so the problem is too small to deserve its own product.
- Procurement will not spend the time to verify terms, or verification takes longer than the checking it saves.
- Extraction needs heavy editing on real contracts.
- Buyers already catch contract price changes in their ERP, which would make the gap smaller than we assume.

## Assumptions

- Brightwave Group buys from about 2,500 suppliers and Procurement owns the price master.
- Contracts are searchable PDFs, one currency (INR), priced per hour.
- Signing status is declared by the person uploading. We do not verify signatures.
- A supplier's stated index figure in a notice is not independently verified.
- Roles are simulated. There is no integration with an ERP or e-signature tool.

## What AI does, and what people decide

| AI does | Fixed rules do | People decide |
|---|---|---|
| Reads a document and proposes terms with exact quotes | Pick the governing rate by date, role and location, calculate the amounts, and refuse when the contract cannot establish one price | Verify terms, confirm which amendment replaces which, rule on genuine conflicts, decide investigations |

AI never calculates an amount, never chooses the governing rate, and never marks anything verified.

## What this prototype does not claim

Real authentication, secure multi-tenant storage, signature verification, recovered money, independent verification of index figures, or any frequency or savings figure for the problem. Uploaded files and results stay in your browser, and extracted text is sent to an AI service, so use only synthetic or non confidential documents.
