import { Link, useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoleId } from "@/data/types";
import { useDemo, useInvestigations } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

type Path = "/price-book" | "/invoice-check" | "/findings" | "/legal";

export function GuidedDemo() {
  const { state, setRole, setGuideDismissed } = useDemo();
  const rows = useInvestigations();
  const navigate = useNavigate();
  const f = (fx: string) => rows.filter((x) => x.assessment.fixtureId === fx);
  const checked = (fx: string) => state.assessments.some((a) => a.fixtureId === fx);

  const steps: { text: string; hint?: string; done: boolean; role: RoleId; to: Path }[] = [
    {
      text: "Procurement: in the Price Book, verify T02 and T04 and confirm their override links.",
      done: ["T02", "T04"].every(
        (id) => state.terms[id]?.status === "Verified" && state.terms[id]?.override?.confirmed,
      ),
      role: "procurement",
      to: "/price-book",
    },
    {
      text: "Finance: load example S01 in Invoice Check and see the ₹15,000 potential excess.",
      hint: state.progress.s01Awaiting
        ? 'You saw "Awaiting verification" before T02 was verified.'
        : 'Try it before step 1 to see "Awaiting verification".',
      done: Boolean(state.progress.s01Excess),
      role: "finance",
      to: "/invoice-check",
    },
    {
      text: "Finance: raise an investigation.",
      done: f("S01").length > 0,
      role: "finance",
      to: "/invoice-check",
    },
    {
      text: "Procurement: confirm or dismiss it with a reason.",
      done: f("S01").some((x) => x.investigation.decisions.length > 0),
      role: "procurement",
      to: "/findings",
    },
    {
      text: 'Finance: check S07, see "Needs information" and Request review. Procurement supplies the delivery center and the same check gets a new version.',
      done: f("S07").some((x) => x.assessment.facts.length > 0),
      role: f("S07").length ? "procurement" : "finance",
      to: f("S07").length ? "/findings" : "/invoice-check",
    },
    {
      text: "Finance: check S09 and Request review. Procurement reviews clauses T06 to T09 and sends the conflict to Legal.",
      done: checked("S09") && state.conflictCases["C1"]?.status !== "Open",
      role: checked("S09") ? "procurement" : "finance",
      to: checked("S09") ? "/price-book" : "/invoice-check",
    },
    {
      text: "Legal: record a ruling and watch the check get a new version.",
      done: Boolean(state.rulings["C1"]),
      role: "legal",
      to: "/legal",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);

  if (state.guideDismissed) {
    return (
      <button
        onClick={() => setGuideDismissed(false)}
        className="text-sm text-primary underline underline-offset-2"
      >
        Show the "Try this path" checklist
      </button>
    );
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">
            Guided demo · {doneCount} of {steps.length} done
          </p>
          <h2 className="font-display text-xl">Try this path</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss checklist"
          onClick={() => setGuideDismissed(true)}
        >
          <X />
        </Button>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-2.5",
              s.done
                ? "border-success/25 bg-success-soft/50"
                : i === nextIndex
                  ? "border-primary/40 bg-accent/50"
                  : "border-transparent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                s.done
                  ? "border-success bg-success text-background"
                  : "border-muted-foreground/40 text-muted-foreground",
              )}
            >
              {s.done ? <Check className="size-3" /> : i + 1}
            </span>
            <div className="flex-1 text-sm">
              <p
                className={cn(
                  s.done && "text-muted-foreground line-through decoration-muted-foreground/40",
                )}
              >
                {s.text}
              </p>
              {s.hint && !s.done && (
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              )}
            </div>
            {!s.done && i === nextIndex && (
              <Button
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => {
                  setRole(s.role);
                  void navigate({ to: s.to });
                }}
              >
                Go
              </Button>
            )}
          </li>
        ))}
      </ol>
      {doneCount === steps.length && (
        <p className="mt-3 text-sm text-success">
          Path complete. See{" "}
          <Link to="/tests" className="underline">
            Prototype Validation
          </Link>{" "}
          for every rule checked at once.
        </p>
      )}
    </section>
  );
}
