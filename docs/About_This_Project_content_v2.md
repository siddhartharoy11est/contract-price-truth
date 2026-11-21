[[GREETING]]
Hi, I'm Sid. Thanks for taking the time to look at this. This page walks you through how I thought about the problem and what I built over the last few days. The prototype is made to be tried, so please click around. I'd love to talk it through with you.
[[/GREETING]]

# About This Project

**Prototype validation**

## Contract Price Truth
*Know the price you agreed to pay.*

Contract Price Truth turns signed supplier contracts, schedules and amendments into a verified, dated price book where every price links to the exact clause it came from. One invoice line can then be checked against that price. AI reads and proposes. Procurement verifies. Fixed rules, not AI, decide which rate applies. Legal is asked only when the contract genuinely contradicts itself.

All data in this prototype is synthetic. The people and the company (Brightwave Group, a buyer with about 3,000 employees and 2,500 suppliers) are simulated.

### In 60 seconds

| | |
|---|---|
| **Stage** | Intelligent repository, narrowed to one job: which price applies today |
| **The problem** | A purchase order and an invoice can agree with each other while both carry a price that a signed amendment has since changed. Standard matching compares the invoice to the PO, never to the contract |
| **Who uses it** | Procurement verifies. Finance checks one invoice line. Legal rules only on real contradictions |
| **What AI does** | Reads contracts and proposes rate terms with the exact quote. It never calculates, never picks the rate, never marks anything verified |
| **North Star** | Share of in-scope invoice spend that was checked against a human-verified, dated price |
| **Try it** | 3 minutes. Pick Priya, open the price book, then check one invoice line as Dev |

---

## 1. Why this stage

The brief asks for one stage of the contract lifecycle: intake, negotiation, or the intelligent repository. I started from the outcome the brief names and worked backwards.

- **The brief names the consequence.** It lists "invoices that don't match agreed prices" as a result of contracts that are rarely looked at after signing. Only a repository can answer "what did the company actually agree?" once a contract is signed.
- **A repository only matters if it changes a decision.** Searching a pile of PDFs is not enough. Ours changes one that Finance makes every month: pay this invoice line, or hold it.
- **It feeds the other two stages.** Intake and negotiation both start from what is already agreed. A trusted source of truth makes both better.
- **There is a public signal for the payoff.** Sirion reports (https://www.sirion.ai/library/case-study/transforming-contract-governance/) that a global oil and gas company found $235M in hard savings by validating invoices and work orders against contract terms. That is company produced and from a $4.1 billion contract portfolio, far larger than Brightwave. I treat it as a signal that the problem is worth solving, not as proof of the size of benefit here.

### How I compared the three stages

My own judgment, scored 1 (weak) to 5 (strong). This is reasoning, not data.

| Criterion | Intake | Negotiation | Repository |
|---|:-:|:-:|:-:|
| Pain I heard in interviews | 4 | 3 | 3 |
| Changes a money decision every month | 3 | 3 | 4 |
| Has an objective right answer to test AI against | 2 | 2 | 5 |
| Works on documents that already exist, no live workflow needed | 2 | 2 | 5 |
| Feeds the other two stages | 2 | 3 | 4 |
| A reviewer can see it work in three minutes with synthetic data | 4 | 3 | 4 |
| **Total (out of 30)** | **17** | **16** | **25** |

**The honest part.** One person I spoke to, a legal counsel, would have started with drafting, because drafting is her daily pain. That is why the first row scores intake highest. I still chose the repository because drafting does not help the contracts that are already signed, and because a price is either supported by a clause or it is not. That gives a test an AI cannot talk its way past.

**The line I drew.** Checking invoices in bulk, with live ERP data, belongs closer to managing contracts after signature. The product checks one invoice line to prove the price book is usable, and stops there.

### What I looked at, and what I took from it

| Source | What it says | What I took | What I do not claim |
|---|---|---|---|
| The brief | Invoices that don't match agreed prices follow from contracts rarely reviewed after signing | The problem is in scope | Nothing beyond the brief |
| SAP knowledge article 3558118 and Microsoft Dynamics 365 documentation | A PO price is not updated automatically when the contract price changes. Two-way matching compares invoice price to PO price | The mechanism: a clean match can hide a wrong price | How often it costs money |
| Sirion oil and gas case study | $235M in hard savings from validating invoices and work orders against contract terms | Invoice versus contract is where savings were found | That Brightwave would see the same size. It is company produced |
| WorldCC and Ironclad, "Closing the Procurement Value Gap" | Companies lose about 11% of contract value after signature. Overpayment from untracked price adjustments is about 1 to 2%. Unrecorded changes and poor renewal planning are each about 2 to 3% | Where this slice sits in the bigger picture | A number for Brightwave. The report was co-published with a contract software vendor |
| Agiloft procurement survey, 2,005 leaders | 97% say they are confident they capture the full value they negotiated, even as the data shows leakage after signature | Buyers may not feel this pain, so the product has to show the gap on one invoice line, not argue it | Anything about adoption. It is a vendor survey |
| Three informal interviews (below) | Contracts scattered, signed copies downloaded one by one, a firm view that AI output needs human review | The human verification gate. Every price links back to its source | Frequency, size or savings |

**I chose a smaller slice on purpose.** By WorldCC's own ranking, untracked price adjustments are a smaller bucket than unrecorded changes or poor renewal planning. I picked it because it is the one slice with an objective right answer and a hard test: one invoice line, one clause, one amount. A smaller problem that can be proven beats a bigger one that can only be described. The amendment that never reached the price master also overlaps with the larger "unrecorded changes" bucket, so the same engine reaches further than this prototype shows.

---

## 2. Stakeholder map

Six groups touch a price. Two use the product, one is called in only when needed, and three are affected by what it says.

| Who | Role in the product | What they want | Where it conflicts | How the product responds |
|---|---|---|---|---|
| **Procurement (Priya Nair)** | Primary user. Verifies terms, owns the price book | A price book she can trust, with the amendment history, without reading every PDF | Wants to be fast, but any price she verifies becomes the basis for paying or disputing invoices | One decision per term with the quote beside it. Her name and the date are stored on every verified term |
| **Finance, Accounts Payable (Dev Mehta)** | Second user. Checks invoice lines | A clear answer on one line, and a clear owner when the answer is not yet available | Wants to pay on time, while Procurement still has terms to verify | Either an amount with its clause, or a refusal that names who can unblock it. Never a guess |
| **Legal (Anika Rao)** | Escalation only. Rules on genuine conflicts | To rule only on real interpretation conflicts | Does not want to become the default reviewer for every doubt | Only genuine clause conflicts reach her, with both clauses side by side. One ruling recalculates every affected line |
| **Business owner who ordered the work** | Affected, not a user | The supplier to keep delivering | Resists a price dispute with a supplier they depend on | A finding comes with clause proof, so the talk is about the contract, not opinion |
| **The supplier (BrightHire Staffing)** | External, not a user | To be paid at the rate it believes applies, and to raise annual increases | A supplier notice can contradict a price lock | A notice is stored as a claim, never as an authority |
| **Leadership and audit** | Consume the numbers | Savings and control they can defend | Want numbers, but unverified numbers are worse than none | Only verified terms count. Results and versions are kept, so any number can be traced and replayed |

### Where interests clash, the product does not pick a side

It separates three different gaps and sends each to the right owner.

| The gap | Example | Goes to | What the product does |
|---|---|---|---|
| Missing invoice fact | A line with no delivery location | Whoever knows it | Asks for the fact, then recalculates as a new version |
| Unverified contract authority | AI proposed a rate, nobody has verified it | Procurement | Refuses to use it until it is verified |
| Genuine clause conflict | One clause allows an annual increase, another says rates are fixed for the term | Legal | Escalates with both clauses. The ruling recalculates every affected line |

---

## 3. The problem

**Who it affects.** Procurement, Finance and Legal in any company that buys from many suppliers under contracts that change through amendments.

**Why it matters.** A purchase order and an invoice can agree with each other while both carry a price that a signed amendment has since changed. Standard invoice matching compares the invoice to the purchase order, not to the contract, so it cannot see that.

### How a wrong price gets paid

[[VISUAL: problem-flow]]

### A worked example (illustrative numbers, not the seed data)

| | |
|---|---|
| Original schedule | L2 Engineer, Hyderabad: ₹1,200 per hour |
| Amendment 3, effective 1 July | L2 Engineer, Hyderabad only: ₹1,100 per hour |
| Purchase order raised earlier | ₹1,200 per hour |
| Invoice | 160 hours at ₹1,200 = ₹1,92,000 |
| PO check | Passes. Invoice and PO agree |
| Contract check | 160 hours at ₹1,100 = ₹1,76,000. **₹16,000 over on one line** |

### How I know it is real, and what I do not know

**Documented**
- The brief itself lists invoices that do not match agreed prices as a consequence of contracts left unreviewed after signing.
- SAP's knowledge base article 3558118 says a purchase order price is not automatically updated after a price change in the purchase contract (https://userapps.support.sap.com/sap/support/knowledge/en/3558118).
- Microsoft's Dynamics 365 documentation says two-way matching compares the invoice unit price to the purchase order unit price (https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching).

These show the gap exists. They do not show how often it costs money.

**Heard.** Three informal interviews, all held on 18 November 2026, a small number and directional only: a legal counsel at a B2B software company across 12 countries; a program manager on the provider side of outsourcing deals; a contract owner on the buyer side at a company where the CFO signs. What they said, and what I built in response:

| What I heard | What it changed |
|---|---|
| Contracts sit across a CRM and shared drives, and signed copies are downloaded one by one | Every price links to its source document, page and clause |
| AI output needs a human review | No term counts until Procurement verifies it |
| Service level breaches are found only in after-the-fact audits | Noted, and kept out of scope |

None of them independently confirmed how often amendment driven invoice price errors happen, and I do not use them for any frequency, size or savings claim.

**Not known, and stated.** How often amendments change prices. Whether buyers already compare purchase orders to contracts. Whether the pain is big enough to justify a separate product. Section 5 turns each of these into a test with a stop condition.

---

## 4. The working prototype

Try it in about three minutes. Choose a persona on the landing screen. The accounts are simulated, to show how roles connect. They are not real security.

| Journey | Who | What you do | What you will see |
|---|---|---|---|
| **A. Existing contracts** | Priya, then Dev | Open the price book, check the quote behind a rate, verify an amendment term, then check one invoice line | The exact amount and the clause it relies on, or a refusal that names who can resolve it. You can raise an investigation |
| **B. Missing information** | Dev, then Priya | Check a line with no delivery location | The product asks for the missing fact instead of guessing. Priya supplies it and the check recalculates as a new version |
| **C. A real contract conflict** | Priya, then Anika | One clause allows an annual increase, another says rates are fixed for the term, and a supplier notice asks for an increase. Priya escalates, Anika rules | Every affected line recalculates. The result does not depend on the rate billed |
| **D. Upload a new contract** | Priya | Upload a searchable PDF (two samples are provided) | AI proposes rate terms with exact quotes. Nothing counts until Procurement verifies it |

Every result shows the document, page, clause and quote. Results and versions are kept, so a later change never erases an earlier decision.

### 4.1 Where the AI is, and where it is not

This is not a chatbot, and it is not an autonomous agent. It is a controlled workflow with an AI reader at the front of it. The AI does the part that rules cannot: reading contract language in a pile of PDFs and turning it into structured, quotable proposals. It is not allowed to decide. That line is the design.

| # | Step | Who acts | What happens | If it goes wrong | Status |
|---|---|---|---|---|---|
| 1 | **Read** | AI | Reads the document and finds each rate term: role, location, rate, unit, effective date, with the exact quote, page and clause | Every proposal carries its quote, so a wrong reading is visible in seconds | Live |
| 2 | **Propose** | AI | Puts each term in a review queue. Nothing in the queue is active | Unverified terms are never used in an amount | Live |
| 3 | **Verify** | Procurement | Accepts, edits or rejects each term. Confirms which amendment replaces which | Name and date stored with the decision | Live |
| 4 | **Resolve** | Fixed rules | Pick the governing rate by date, role and location, and calculate the amount. Refuse when the contract cannot establish one price | The refusal names the owner who can fix it | Live |
| 5 | **Check** | Fixed rules, for Finance | One invoice line against the governing rate: an exact amount and clause, or a refusal | A missing fact is asked for, not guessed | Live |
| 6 | **Rule** | Legal | Decides genuine clause conflicts. One ruling recalculates every affected line | Both clauses shown side by side | Live |
| 7 | **React to change** | AI, then rules | A new amendment arrives. AI proposes the changes to the price book, and after Procurement verifies, every affected check recalculates | Old results and versions are kept | Partly live (upload and rulings recalculate) |
| 8 | **Flag and route** | AI | Spots clauses that look contradictory, reads supplier notices, and drafts the escalation note for Legal | Flags only. Legal still rules | Next |

### Who decides what

| Decision | AI | Fixed rules | People |
|---|---|---|---|
| What a document says about rates | **Proposes** | | Procurement verifies |
| Which amendment replaces which | May suggest | | **Procurement confirms** |
| Whether a term is verified | Never | Never | **Procurement only** |
| Which rate governs a line | Never | **Decides** | |
| How much is owed | Never | **Calculates** | |
| Whether two clauses genuinely conflict | May flag | | **Legal rules** |
| Whether to raise an investigation | Never | | **Procurement and Finance** |

### How much freedom the AI earns

Autonomy is not assumed. It is unlocked by the acceptance rate measured in section 5. Thresholds below are starting proposals to test.

| Level | What AI may do | Human role | Unlock condition | Status |
|---|---|---|---|---|
| **1. Propose** | Proposes every term with its quote | Verifies every term | None | **Today** |
| **2. Propose and pre-verify low-risk terms** | Marks a term "ready" when the quote matches exactly, no clause conflicts and the rate is unchanged | Reviews a 10% sample, verifies the rest in bulk | At least 95% of terms accepted without edit over at least 200 terms, and under 1% wrong in the sample | Next |
| **3. Watch** | Monitors new documents and notices, proposes price book updates, alerts the owner | Verifies updates | Level 2 stable for 90 days with zero false clears | Later |
| **Never** | Decide a conflict, calculate an amount, pick the governing rate, mark a term verified without a person, pay or dispute an invoice | | | |

### Why the work is split this way

- **Rules decide the money.** The same inputs give the same answer every time, and each answer can be explained clause by clause. An AI estimate of an amount cannot be audited.
- **People own the trust.** The people I interviewed were firm that AI output needs a human review, and a verified price becomes the basis for paying or disputing.
- **AI goes where rules fail.** Reading free text across contract PDFs and their amendments is the one step that is slow for people and impossible for fixed rules. That is the only place the AI is trusted to act on its own.

**What the automation buys, and what I have not measured.** The target is that a person reviews a queue of quoted proposals in about 30 minutes per contract instead of reading every page and amendment. I have not measured the manual baseline. The first task in a pilot is to time five contracts by hand, so the saving is a measured number and not a claim.

---

## 5. Success metrics

### North Star

**Verified-price spend coverage:** the share of in-scope monthly supplier invoice value that was checked against a human-verified, dated price.

It breaks into two things that must both be true:

> **North Star ≈ Contract coverage × Check rate**
>
> **Contract coverage:** share of in-scope spend under contracts that have a verified price book (Procurement's side).
>
> **Check rate:** share of in-scope invoice lines that Finance actually runs through the check (Finance's side).

**Why this one.** It only rises when Procurement has verified a price and Finance has used it, so it cannot be inflated by verifying terms nobody checks against. It counts spend, not terms, so a verified price on a large supplier matters more than on a small one. And it sits at the front of the value chain: no check, no catch.

**This prototype** shows a proxy: verified rate terms divided by all rate terms from signed documents (3 of 5, 60% in the seed data). It is labelled as a proxy. It counts terms, not spend or checks, and exists only to show the metric can be computed.

### What moves it

[[VISUAL: metric-tree]]

| Lever | Metric | Why it matters |
|---|---|---|
| Coverage | Share of in-scope spend with a verified price book | The supply of trusted prices |
| Speed | Median minutes from upload to verified price book, per contract | If this is slow, Procurement will not do it |
| AI quality | Share of AI-proposed terms accepted without editing, plus share edited and share rejected | The measure of how much work the AI really removes. Also decides how much freedom it earns |
| Usage | Share of eligible invoice lines checked | Prices that nobody checks against protect nothing |
| Answer quality | Share of checks that return a definite answer, and share of refusals that reach the right owner | A refusal is fine if it is clear and correctly routed |
| Outcome | Confirmed overbilling found, and how much was avoided or recovered (₹), days to resolve a finding | The result Finance cares about, counted only after a person confirms it |

### Guardrails

The North Star is never allowed to rise at the cost of any of these.

| Guardrail | Limit | Why | If breached |
|---|---|---|---|
| False clears: lines shown as Match that were later found wrong | **0** | A wrong "all clear" is worse than a refusal | Stop definite answers for that rule until the cause is fixed |
| Unverified terms used in an amount | **0** | System rule, enforced by the rules engine and tested | Release blocker |
| Results with no document, page, clause and quote | **0** | Audit and trust | Release blocker |
| Verified terms later found wrong (wrong-accepts) | Under 2%, measured by sampling | Verification must not turn into rubber stamping | Add review friction and hold the autonomy level |
| Verifier effort | Median 30 minutes or less per contract | If verifying takes longer than reading the PDF, the product has failed | Fix extraction or reduce scope |
| Legal load | 5 escalations or fewer per 100 checks, and at least 80% judged genuine | Legal is not the default reviewer | Tighten conflict detection |
| Refusals with no named owner | **0**, and at least 90% of held lines resolved within 5 working days | Finance must always know who can unblock a line | Release blocker for the first, process review for the second |
| Findings reversed after a supplier challenge | 10% or less | Protects the supplier and business owner relationship | Review how the evidence is presented |

### Targets

Starting targets, to be tested. They are not measured results.

| Metric | Prototype today | Pilot, 3 months | 12 months |
|---|---|---|---|
| North Star: verified-price spend coverage | 60% of terms (proxy) | 60% of in-scope pilot spend | 80% of in-scope spend |
| Check rate | Not measured | 50% of eligible lines | 80% |
| AI terms accepted without edit | Not measured | 70% | 85% |
| Median time, upload to verified price book | Not measured | 30 minutes | 15 minutes |
| Checks returning a definite answer | Not measured | 70% | 85% |
| Refusals that reach the right owner | Not measured | 90% | 95% |
| Escalations Legal judges genuine | Not measured | 80% | 90% |
| False clears | 0 in my scripted tests | 0 | 0 |

[[VISUAL: trajectory]]

### How it would roll out, with a decision at each gate

| Gate | Scope | Must be true to continue | If it is missed |
|---|---|---|---|
| **Before the pilot** | Time five contracts by hand. Count how many of the 20 pilot contracts have an amendment that changed a price | At least 2 of 20 have a price-changing amendment | Stop. The problem is too small for its own product |
| **Pilot exit, month 3** | One category (hourly staffing), about 20 contracts, one Finance user | 70% accepted without edit, median 30 minutes or less, zero false clears, check rate 50% or more, at least one finding that Finance confirms as real | Under 50% accepted: rework extraction. Low check rate: fix the workflow before adding contracts |
| **Expand exit, month 6** | Three categories, about 100 contracts, read-only export of the price master | Coverage 70%, 80% accepted without edit, all guardrails green for 60 days | Hold at pilot scope until guardrails recover |
| **Scale, months 6 to 12** | Level 2 autonomy for low-risk terms | Coverage 80%, zero false clears | Stay at Level 1 |

### What would make me rethink

- Fewer than 2 in 20 pilot contracts have an amendment that changed a price. The problem is too small to deserve its own product.
- Median verification time is above 45 minutes, or under 50% of terms are accepted without edit, after 8 weeks. Verification takes longer than the checking it saves, or extraction needs heavy editing on real contracts.
- Finance runs under 30% of eligible lines through the check after 8 weeks. This is an adoption problem, not an accuracy problem.
- Buyers already catch contract price changes in their ERP for most of the gaps the product finds. The gap is smaller than I assume.

### The business case: what must be true

I do not know how large the exposure is, and I do not claim a figure. What I can show is what has to be true for this to pay back. The grid below shows value at stake per year for every ₹100 crore of in-scope spend, as a function of two numbers a pilot will measure.

[[VISUAL: sensitivity]]

- **Exposure** is the share of spend whose governing price was changed by an amendment.
- **Gap** is the average difference between what was billed and what the contract says, on that exposed spend.
- **Value at stake** is exposure times gap. What is realised is that figure times the share caught and acted on. The pilot measures it.
- **Reference point.** WorldCC puts overpayment from untracked price adjustments at about 1 to 2% of contract value. The bottom-right cell is 1%, so the grid sits at or below that published range.
- **Cost side.** Assume 30 minutes of verification at ₹1,500 an hour, so about ₹750 per contract. On a contract worth ₹50 lakh a year, verification time alone is repaid if value at stake is 0.015% of contract value. The smallest cell is 0.04%. So cost is not the constraint. **The real risk is whether Procurement spends the time to verify.** That is why verifier effort is a guardrail and adoption is a stop condition.

---

## 6. Assumptions

| Assumption | If it is wrong | How to test it |
|---|---|---|
| Brightwave Group buys from about 2,500 suppliers and Procurement owns the price master | If another team holds its own price lists, the price book is not the authority | Pilot: ask who updates prices in the ordering system |
| Contracts are searchable PDFs, priced per hour, in one currency (INR) | Scans, fixed fees, volume tiers and index-linked prices need more work | Start with hourly staffing and add pricing models one at a time |
| Signing status is declared by the person uploading. Signatures are not verified | A draft treated as signed gives a wrong price | Declared status is stored and shown. Signature checks are production work |
| The set of documents is complete | A missing amendment makes the price book wrong and nobody knows | Every price shows "verified through Amendment N". Procurement confirms completeness. Amendments found late are tracked |
| Effective dates, roles and locations are stated in the text | Ambiguity leads to a refusal, and a person decides | Measure refusals by cause |
| A supplier's stated index figure in a notice is not independently verified | A claim could be mistaken for a fact | A notice is always stored as a claim |
| Procurement will spend time verifying | The price book stays thin and the North Star stalls | Verifier effort guardrail and the rethink conditions above |
| Finance will route invoice lines through the check | Prices exist but nobody uses them | Check rate is a lever and a stop condition |

## 7. What this prototype does not claim

Real authentication, secure multi-tenant storage, signature verification, recovered money, independent verification of index figures, ERP or e-signature integration, or any frequency or savings figure for the problem. Roles are simulated. Uploaded files and results stay in your browser, and extracted text is sent to an AI service, so use only synthetic or non confidential documents.

## Sources

- Sirion case study: https://www.sirion.ai/library/case-study/transforming-contract-governance/
- SAP knowledge base article 3558118: https://userapps.support.sap.com/sap/support/knowledge/en/3558118
- Microsoft Dynamics 365, invoice matching: https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching
- WorldCC and Ironclad, Closing the Procurement Value Gap: https://info.worldcc.com/closing-the-procurement-value-gap
- WorldCC breakdown of leakage categories: https://procurementandsupply.com/procurement-contracts-leaking-11-percent-of-value-due-to-enterprise-wide-failures/
- Agiloft procurement research (2,005 respondents): https://www.cfo.com/news/one-in-10-chief-procurement-officers-have-no-shared-metrics-with-cfos-agiloft/830524/

---

## Notes for the build (not shown on the page)

Replace each `[[VISUAL: name]]` line with a chart. Replace the `[[GREETING]]` block with the note card and avatar (`assets/sid-avatar.svg`). Data for each chart is below. Interaction behaviour is specified in the build prompt, not here.

**problem-flow.** Five boxes in a row: Amendment signed, Price master not updated, PO raised at old rate, Invoice at old rate, PO match passes and invoice is paid. Mark the last box with the point where Contract Price Truth checks against the contract instead.

**metric-tree.** Top box: North Star. Two children: Contract coverage and Check rate. Under Contract coverage: AI terms accepted without edit, time to verify. Under Check rate: definite-answer rate, refusals reaching the right owner. A separate strip beside it, "Guardrails", listing false clears 0, unverified use 0, wrong-accepts under 2%. Outcome box at the bottom: confirmed overbilling avoided or recovered.

**trajectory.** Line chart, x is months, y is percent. Two series, same axis.

| Month | North Star coverage (%) | AI terms accepted without edit (%) |
|---|---|---|
| 0 | 0 | |
| 1 | 25 | 55 |
| 2 | 45 | 65 |
| 3 | 60 | 70 |
| 6 | 70 | 80 |
| 9 | 75 | 83 |
| 12 | 80 | 85 |

Vertical markers at month 3 (pilot exit) and month 6 (expand exit). Label it "Target path, not a forecast".

**sensitivity.** Heatmap table, one blue ramp. Rows are exposure (2%, 5%, 10%). Columns are gap (2%, 5%, 10%). Values are ₹ lakh of value at stake per year per ₹100 crore of in-scope spend.

| Exposure \ Gap | 2% | 5% | 10% |
|---|---|---|---|
| 2% | 4 | 10 | 20 |
| 5% | 10 | 25 | 50 |
| 10% | 20 | 50 | 100 |

Arithmetic: ₹100 crore is 10,000 lakh. Value at stake = 10,000 lakh × exposure × gap. Example: 10,000 × 5% × 5% = 25 lakh.
