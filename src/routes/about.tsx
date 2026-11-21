import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

/**
 * Built from docs/About_This_Project_content.md: same headings, text and order. The file's
 * opening note to the author is not page content and is left out.
 */
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About This Project · Contract Price Truth" },
      {
        name: "description",
        content:
          "Why this stage, the stakeholder map, the problem, the working prototype and success metrics behind Contract Price Truth.",
      },
      { property: "og:title", content: "About This Project · Contract Price Truth" },
      {
        property: "og:description",
        content:
          "Why this stage, the stakeholder map, the problem, the working prototype and success metrics.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const SIRION_URL = "https://www.sirion.ai/library/case-study/transforming-contract-governance/";
const SAP_URL = "https://userapps.support.sap.com/sap/support/knowledge/en/3558118";
const MS_URL =
  "https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching";

function Ext({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
    >
      {href}
    </a>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b p-4 last:border-b-0 sm:p-6">
      <h2 className="text-base font-semibold leading-snug">{title}</h2>
      <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_ol>li]:list-decimal [&_ol]:space-y-2 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <>
      {/* Stacked cards on phones, a table from the small breakpoint up. */}
      <div className="space-y-2 sm:hidden">
        {rows.map((r, i) => (
          <dl key={i} className="rounded-md border p-3 text-sm">
            {r.map((cell, j) => (
              <div key={j} className={j ? "mt-2" : ""}>
                <dt className="eyebrow">{head[j]}</dt>
                <dd className="mt-0.5">{cell}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} className="table-heading">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className="table-cell align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AboutPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="About This Project"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/tests">
              <FlaskConical />
              Prototype Validation
            </Link>
          </Button>
        }
      />
      <div className="surface overflow-hidden">
        <Section title="Contract Price Truth">
          <p>
            <strong>Know the price you agreed to pay.</strong>
          </p>
          <p>
            Contract Price Truth turns signed supplier contracts, schedules and amendments into a
            verified, dated price book where every price links to the exact clause it came from. One
            invoice line can then be checked against that price. AI reads and proposes. Procurement
            verifies. Fixed rules, not AI, decide which rate applies. Legal is asked only when the
            contract genuinely contradicts itself.
          </p>
          <p>
            All data in this prototype is synthetic. The people and the company (Brightwave Group, a
            buyer with about 3,000 employees and 2,500 suppliers) are simulated.
          </p>
        </Section>

        <Section title="1. Why this stage">
          <p>
            We chose the <strong>intelligent repository</strong> and built one job on top of it:
            knowing which price applies.
          </p>
          <ul>
            <li>
              <strong>The brief names the outcome.</strong> It lists "invoices that don't match
              agreed prices" as a result of contracts that are rarely looked at after signing. A
              repository is the only stage that can answer "what did we actually agree?" once the
              contract is signed.
            </li>
            <li>
              <strong>A repository only matters if it changes a decision.</strong> Searching a pile
              of PDFs is not enough. A verified price that Finance can test an invoice against is a
              decision the company makes every month.
            </li>
            <li>
              <strong>It feeds the other two stages.</strong> Intake and negotiation both start from
              what is already agreed. A trusted source of truth makes both better.
            </li>
            <li>
              <strong>There is a public example of the payoff.</strong> Sirion reports{" "}
              <Ext href={SIRION_URL} /> that a global oil and gas company found $235M in hard
              savings by validating invoices and work orders against contract terms. This is company
              produced, so we treat it as a signal that the problem is worth solving, not as proof
              of our size of benefit.
            </li>
            <li>
              <strong>Honest alternative.</strong> One person we spoke to, a legal counsel, would
              have started with drafting, because drafting is her daily pain. We chose the
              repository because drafting does not help the contracts that are already signed.
            </li>
          </ul>
        </Section>

        <Section title="2. Stakeholder map">
          <Table
            head={["Who", "What they want", "Where it conflicts"]}
            rows={[
              [
                <strong key="w">Procurement (Priya Nair), primary user</strong>,
                "A price book she can trust, with the amendment history, without reading every PDF",
                "Wants to be fast, but any price she verifies becomes the basis for paying or disputing invoices",
              ],
              [
                <strong key="w">Finance, Accounts Payable (Dev Mehta)</strong>,
                "A clear answer on one invoice line, and a clear owner when the answer is not yet available",
                "Wants to pay on time, while Procurement still has terms to verify",
              ],
              [
                <strong key="w">Legal (Anika Rao), escalation only</strong>,
                "To rule only on genuine interpretation conflicts",
                "Does not want to become the default reviewer for every doubt",
              ],
              [
                <strong key="w">Business owner who ordered the work</strong>,
                "The supplier to keep delivering",
                "Resists a price dispute with a supplier they depend on",
              ],
              [
                <strong key="w">The supplier (BrightHire Staffing)</strong>,
                "To be paid at the rate it believes applies, and to raise annual increases",
                "A supplier notice can contradict a price lock. The notice is a claim, never an authority",
              ],
              [
                <strong key="w">Leadership and audit</strong>,
                "Savings and control they can defend",
                "Want numbers, but unverified numbers are worse than none",
              ],
            ]}
          />
          <p>
            Where interests clash, the product does not pick a side. It separates three different
            gaps and sends each to the right owner: missing invoice facts go to whoever knows them,
            unverified contract authority goes to Procurement, and a genuine clause conflict goes to
            Legal.
          </p>
        </Section>

        <Section title="3. The problem">
          <p>
            <strong>Who it affects:</strong> Procurement, Finance and Legal in any company that buys
            from many suppliers under contracts that change through amendments.
          </p>
          <p>
            <strong>Why it matters:</strong> a purchase order and an invoice can agree with each
            other while both carry a price that a signed amendment has since changed. Standard
            invoice matching compares the invoice to the purchase order, not to the contract, so it
            cannot see that.
          </p>
          <p>
            <strong>How we know it is real, and what we do not know</strong>
          </p>
          <ul>
            <li>
              <strong>The brief itself</strong> lists invoices that do not match agreed prices as a
              consequence of contracts left unreviewed after signing.
            </li>
            <li>
              <strong>The mechanism is documented.</strong> SAP's own knowledge base article 3558118
              says a purchase order price is not automatically updated after a price change in the
              purchase contract (<Ext href={SAP_URL} />
              ). Microsoft's Dynamics 365 documentation says two-way matching compares the invoice
              unit price to the purchase order unit price (<Ext href={MS_URL} />
              ). These show the gap exists. They do not show how often it costs money.
            </li>
            <li>
              <strong>Three informal interviews</strong>, all held on 18 November 2026, a small
              number and directional only: a legal counsel at a B2B software company across 12
              countries; a program manager on the provider side of outsourcing deals; a contract
              owner on the buyer side at a company where the CFO signs. They described contracts
              scattered across a CRM and shared drives, signed copies downloaded one by one, service
              level breaches found only in after-the-fact audits, and a firm view that AI output
              needs a human review.{" "}
              <strong>
                None of them independently confirmed how often amendment driven invoice price errors
                happen
              </strong>
              , and we do not use them for any frequency, size or savings claim.
            </li>
            <li>
              <strong>Unknowns we state:</strong> how often amendments change prices, whether buyers
              already compare purchase orders to contracts, and whether the pain is big enough to
              justify a separate product.
            </li>
          </ul>
        </Section>

        <Section title="4. The working prototype">
          <p>
            <strong>Try it in about three minutes.</strong> Choose a persona on the landing screen.
            The accounts are simulated, to show how roles connect. They are not real security.
          </p>
          <ol>
            <li>
              <strong>Journey A, existing contracts (Priya, then Dev).</strong> Open the price book,
              check the quote behind a rate, verify an amendment term, then check one invoice line
              as Dev. See the exact amount and the clause it relies on, or a refusal that names who
              can resolve it. Raise an investigation.
            </li>
            <li>
              <strong>Journey B, missing information.</strong> Check a line with no delivery
              location. The product asks for the missing fact instead of guessing. Priya supplies
              it, and the check recalculates as a new version.
            </li>
            <li>
              <strong>Journey C, a real contract conflict.</strong> One clause allows an annual
              increase, another says rates are fixed for the term, and a supplier notice asks for an
              increase. Priya escalates, Anika rules, and every affected line recalculates. The
              result does not depend on the rate billed.
            </li>
            <li>
              <strong>Journey D, upload a new contract.</strong> Upload a searchable PDF (two
              samples are provided). AI proposes rate terms with exact quotes. Nothing counts until
              Procurement verifies it.
            </li>
          </ol>
          <p>
            Every result shows the document, page, clause and quote. Results and versions are kept,
            so a later change never erases an earlier decision.
          </p>
        </Section>

        <Section title="5. Success metrics" id="metrics">
          <p>
            <strong>North star (in production):</strong> the share of annual supplier spend that is
            covered by a human-verified, dated price. If this rises, Finance can check more invoices
            against a trusted price.
          </p>
          <p>
            <strong>In this prototype</strong> we show a proxy: verified rate terms divided by all
            rate terms from signed documents (3 of 5, 60% in the seed data). It is labelled as a
            proxy.
          </p>
          <p>
            <strong>How we would know it works</strong> (starting targets, to be tested):
          </p>
          <ul>
            <li>Share of AI proposed terms that Procurement accepts without editing.</li>
            <li>Time from upload to a verified price book for one contract.</li>
            <li>
              <strong>False clears:</strong> invoice lines shown as Match that were later found
              wrong. The target is zero, because a wrong "all clear" is worse than a refusal.
            </li>
            <li>
              Share of checks that return a definite answer versus a clear refusal, and how often a
              refusal reaches the right owner.
            </li>
            <li>Share of Legal escalations that Legal agrees were genuine conflicts.</li>
          </ul>
          <p>
            <strong>What would make us rethink</strong>
          </p>
          <ul>
            <li>
              Amendments rarely change prices in real portfolios, so the problem is too small to
              deserve its own product.
            </li>
            <li>
              Procurement will not spend the time to verify terms, or verification takes longer than
              the checking it saves.
            </li>
            <li>Extraction needs heavy editing on real contracts.</li>
            <li>
              Buyers already catch contract price changes in their ERP, which would make the gap
              smaller than we assume.
            </li>
          </ul>
        </Section>

        <Section title="Assumptions">
          <ul>
            <li>
              Brightwave Group buys from about 2,500 suppliers and Procurement owns the price
              master.
            </li>
            <li>Contracts are searchable PDFs, one currency (INR), priced per hour.</li>
            <li>
              Signing status is declared by the person uploading. We do not verify signatures.
            </li>
            <li>A supplier's stated index figure in a notice is not independently verified.</li>
            <li>Roles are simulated. There is no integration with an ERP or e-signature tool.</li>
          </ul>
        </Section>

        <Section title="What AI does, and what people decide">
          <Table
            head={["AI does", "Fixed rules do", "People decide"]}
            rows={[
              [
                "Reads a document and proposes terms with exact quotes",
                "Pick the governing rate by date, role and location, calculate the amounts, and refuse when the contract cannot establish one price",
                "Verify terms, confirm which amendment replaces which, rule on genuine conflicts, decide investigations",
              ],
            ]}
          />
          <p>
            AI never calculates an amount, never chooses the governing rate, and never marks
            anything verified.
          </p>
        </Section>

        <Section title="What this prototype does not claim">
          <p>
            Real authentication, secure multi-tenant storage, signature verification, recovered
            money, independent verification of index figures, or any frequency or savings figure for
            the problem. Uploaded files and results stay in your browser, and extracted text is sent
            to an AI service, so use only synthetic or non confidential documents.
          </p>
        </Section>
      </div>
    </div>
  );
}
