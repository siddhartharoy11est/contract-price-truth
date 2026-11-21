import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { useDerived } from "@/lib/demo-store";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About This Project · Contract Price Truth" },
      {
        name: "description",
        content:
          "The product rationale, stakeholder needs, AI responsibilities, assumptions and success measures behind Contract Price Truth.",
      },
      { property: "og:title", content: "About This Project · Contract Price Truth" },
      {
        property: "og:description",
        content:
          "The product rationale, responsibilities, assumptions and success measures behind the prototype.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function Section({
  n,
  title,
  id,
  children,
}: {
  n: number;
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b p-5 last:border-b-0 sm:p-6">
      <div className="grid gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">{String(n).padStart(2, "0")}</p>
          <h2 className="mt-1 text-base font-semibold leading-snug">{title}</h2>
        </div>
        <div className="space-y-3 text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </div>
    </section>
  );
}

function AboutPage() {
  const d = useDerived();
  return (
    <div className="max-w-6xl">
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
      >
        The product decisions, evidence and boundaries behind this functional contract-pricing
        prototype.
      </PageHeader>
      <div className="surface overflow-hidden">
        <Section n={1} title="Why Intelligent Repository was chosen">
          <p>
            The symptoms occur after signature: unreviewed autorenewals, missed SLAs and invoices
            that do not match agreed prices. With no contract system in place, a reliable repository
            comes first.
          </p>
          <p>
            Within that repository, this prototype focuses on one narrow job: knowing which price
            applies.
          </p>
        </Section>
        <Section n={2} title="Stakeholders and conflicting interests">
          <ul>
            <li>
              <strong>Procurement</strong> owns commercial terms.
            </li>
            <li>
              <strong>AP (Finance)</strong> wants a fast answer.
            </li>
            <li>
              <strong>Legal</strong> will not approve unsupported interpretations.
            </li>
            <li>
              <strong>The business owner</strong> wants no supplier disruption.
            </li>
            <li>
              <strong>The supplier</strong> wants payment at the rate it believes applies.
            </li>
          </ul>
          <p className="font-medium">How the design handles the tensions</p>
          <ul>
            <li>
              AP speed versus Procurement verification: checks are advisory and never block payment.
            </li>
            <li>Procurement versus the business owner: the owner is informed, not an approver.</li>
            <li>
              Legal capacity: only true clause conflicts reach Legal. Missing facts are settled by
              Procurement.
            </li>
          </ul>
        </Section>
        <Section n={3} title="Problem evidence and research limits">
          <ul>
            <li>
              Purchase orders do not update automatically when a contract price changes (SAP
              knowledge base article 3558118).
            </li>
            <li>
              Standard invoice matching compares the invoice to the PO, not to the contract
              (Microsoft Dynamics 365 documentation).
            </li>
            <li>Two informal interviews support this direction. They are directional only.</li>
          </ul>
          <p>
            <strong>What remains unknown:</strong> how often amendments change prices, and whether
            buyer-side teams already compare POs with contracts.
          </p>
        </Section>
        <Section n={4} title="AI and human responsibilities">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="font-medium">AI reads and proposes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Terms are labelled Stored extraction or Live result.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="font-medium">Code calculates</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Rate selection and money arithmetic remain deterministic.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="font-medium">People decide</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Procurement verifies and Legal interprets conflicts.
              </p>
            </div>
          </div>
          <p>The product never signs, sends, short-pays or declares a breach.</p>
        </Section>
        <Section n={5} title="Assumptions">
          <ul>
            <li>All data is synthetic.</li>
            <li>Currency is INR only.</li>
            <li>BrightHire Staffing is the single supplier modelled in depth.</li>
            <li>Accounts and roles are simulated, not real access control.</li>
            <li>Signing status is declared, not cryptographically checked.</li>
          </ul>
        </Section>
        <Section n={6} title="North-star metric and success measures" id="metrics">
          <p>
            <strong>Production north star:</strong> share of annual supplier spend covered by a
            human-verified, effective-dated price.
          </p>
          <div className="rounded-md border bg-accent/50 p-4">
            <p className="eyebrow">Prototype proxy, current session</p>
            <p className="mt-1">
              <span className="tabular text-2xl font-semibold">
                {d.verified} of {d.totalTerms}
              </span>{" "}
              BrightHire terms verified. The unsigned draft is excluded.
            </p>
          </div>
          <p className="font-medium">Success measures</p>
          <ul>
            <li>Extraction accuracy against a gold set.</li>
            <li>Time to verify a term.</li>
            <li>Reviewer override rate.</li>
            <li>Share of investigations Procurement confirms.</li>
          </ul>
          <p className="font-medium">Guardrails</p>
          <ul>
            <li>No incorrectly cleared invoice line.</li>
            <li>No use of unsigned drafts.</li>
            <li>No unsupported cited price.</li>
          </ul>
          <p className="font-medium">Reconsider the approach if</p>
          <ul>
            <li>Buyer-side teams already update POs from contracts.</li>
            <li>Amendments rarely change prices.</li>
            <li>Reviewers override more than about 30% of AI proposals.</li>
            <li>Fewer than half of investigations are confirmed.</li>
          </ul>
        </Section>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        This is a functional prototype with simulated accounts and browser-local workflow state. No
        real authentication or enterprise infrastructure is included.
      </p>
    </div>
  );
}
