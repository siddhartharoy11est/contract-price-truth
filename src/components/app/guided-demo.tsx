import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Compass, List, Moon, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { roleById } from "@/data/roles";
import { useDemo } from "@/lib/demo-store";
import { toggleTheme } from "@/lib/theme";
import {
  BADGE_LABEL,
  PERSONA_CHIP,
  TOUR_STEPS,
  readTour,
  writeTour,
  type TourBadge,
  type TourLink,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

/** How long the soft pulse runs after load or after opening, in milliseconds. */
const PULSE_MS = 10_000;

interface TourCtx {
  open: boolean;
  step: number;
  /** Opens the tour at its first step. */
  openTour: () => void;
}

const TourContext = createContext<TourCtx | null>(null);

function usePulse(active: boolean, key: unknown): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) return setOn(false);
    setOn(true);
    const t = window.setTimeout(() => setOn(false), PULSE_MS);
    return () => window.clearTimeout(t);
  }, [active, key]);
  return on;
}

/**
 * The guided tour. One story across the three personas, eleven steps. It replaces the earlier
 * "Try this path" checklist and drives the same store actions and account switch.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { hydrated, state } = useDemo();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [opened, setOpened] = useState(0);
  const autoChecked = useRef(false);

  useEffect(() => {
    if (!hydrated || !state.accountSelected || autoChecked.current) return;
    autoChecked.current = true;
    if (readTour() === null) {
      setStep(0);
      setOpen(true);
      setOpened((n) => n + 1);
    }
  }, [hydrated, state.accountSelected]);

  const openTour = useCallback(() => {
    setStep(0);
    setOpen(true);
    setOpened((n) => n + 1);
  }, []);

  return (
    <TourContext.Provider value={{ open, step, openTour }}>
      {children}
      {open && (
        <TourPanel step={step} setStep={setStep} opened={opened} close={() => setOpen(false)} />
      )}
    </TourContext.Provider>
  );
}

function useTour(): TourCtx {
  const t = useContext(TourContext);
  if (!t) throw new Error("useTour must be used inside TourProvider");
  return t;
}

/** Header button. Visible on every page, reopens the tour at its first step. */
export function TourButton() {
  const { openTour } = useTour();
  const pulse = usePulse(true, 0);
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        "h-9 shrink-0 gap-1.5 border-warning px-2.5 text-xs text-warning hover:bg-warning-soft hover:text-warning",
        pulse && "tour-pulse",
      )}
      onClick={openTour}
      aria-label="Open the guided tour"
    >
      <Compass className="size-3.5" />
      <span className="hidden sm:inline">Tour</span>
    </Button>
  );
}

function Badge({ kind }: { kind: TourBadge }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px] font-medium",
        kind === "ai" && "border-info/30 bg-info-soft text-info",
        kind === "rules" && "border-success/30 bg-success-soft text-success",
        kind === "people" && "border-legal/30 bg-legal-soft text-legal",
      )}
    >
      {BADGE_LABEL[kind]}
    </span>
  );
}

function TourPanel({
  step,
  setStep,
  opened,
  close,
}: {
  step: number;
  setStep: (n: number) => void;
  opened: number;
  close: () => void;
}) {
  const { state, reset, selectAccount, setRole, tourAction } = useDemo();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const pulse = usePulse(true, opened);
  const s = TOUR_STEPS[step]!;
  const last = step === TOUR_STEPS.length - 1;
  const titleId = "tour-title";

  const dismiss = useCallback(
    (memory: "skipped" | "completed") => {
      writeTour(memory);
      close();
    },
    [close],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("skipped");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const goTo = (n: number) => {
    setStep(n);
    setDone(null);
    setShowAll(false);
  };

  const follow = (link: TourLink, role = link.role) => {
    if (role && state.role !== role) setRole(role);
    void navigate({
      to: link.to,
      ...(link.search ? { search: link.search } : {}),
      ...(link.hash ? { hash: link.hash } : {}),
    } as unknown as Parameters<typeof navigate>[0]);
  };

  const start = () => {
    reset();
    selectAccount("procurement");
    writeTour("started");
    setResetNotice(true);
    goTo(1);
    void navigate({ to: "/" });
  };

  const actionDone =
    s.doForMe === "verify-T02"
      ? state.terms["T02"]?.status === "Verified" && state.terms["T02"]?.override?.confirmed
      : s.doForMe === "dispute-T06"
        ? state.terms["T06"]?.interpretation?.choice === "Disputed" &&
          ["T07", "T08", "T09"].every((id) => state.terms[id]?.interpretation)
        : false;

  const doForMe = () => {
    if (!s.doForMe || !s.persona) return;
    if (tourAction(s.doForMe, s.persona)) {
      setDone(
        s.doForMe === "verify-T02"
          ? "Done: T02 is Verified and its override link is confirmed, recorded as Priya Nair."
          : "Done: T06 is Disputed and the question is with Legal. T07, T08 and T09 are reviewed as Clear. Recorded as Priya Nair.",
      );
      if (s.go) follow(s.go, s.persona);
    }
  };

  const persona = s.persona ? roleById(s.persona) : null;
  const needsSwitch = persona && state.role !== persona.id;
  const mainClass = cn("bg-warning text-background hover:bg-warning/90", pulse && "tour-pulse");

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[65vh] flex-col rounded-t-xl border-t-4 border-warning bg-card shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[min(36rem,calc(100vh-6rem))] sm:w-[24rem] sm:rounded-xl sm:border sm:border-l-4 sm:border-warning"
    >
      <div className="flex items-start gap-2 border-b px-4 pb-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-warning">
              Step {step + 1} of {TOUR_STEPS.length}
            </span>
            {s.persona && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {PERSONA_CHIP[s.persona]}
              </span>
            )}
          </div>
          <h2 id={titleId} className="mt-1 text-base font-semibold leading-snug">
            {s.title}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setShowAll((v) => !v)}
          aria-label="All steps"
          aria-expanded={showAll}
          title="All steps"
        >
          <List className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => dismiss(last ? "completed" : "skipped")}
          aria-label="Close the tour"
          title="Close (Escape)"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        {showAll ? (
          <ol className="space-y-0.5" aria-label="All steps">
            {TOUR_STEPS.map((x, i) => (
              <li key={x.title}>
                <button
                  onClick={() => goTo(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted",
                    i === step && "bg-warning-soft font-medium",
                  )}
                >
                  <span className="w-5 shrink-0 font-mono text-muted-foreground">{i + 1}</span>
                  <span className="flex-1">{x.title}</span>
                  {x.persona && (
                    <span className="text-[10px] text-muted-foreground">
                      {roleById(x.persona).name.split(" ")[0]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <>
            {resetNotice && step === 1 && (
              <p className="mb-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                Demo data was reset to the seed, so every step works from a known state.
              </p>
            )}
            {s.badges && (
              <div className="mb-2 flex flex-wrap gap-1">
                {s.badges.map((b) => (
                  <Badge key={b} kind={b} />
                ))}
              </div>
            )}
            <div className="space-y-2 leading-relaxed">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {s.notes?.map((n) => (
              <p key={n} className="mt-2 text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            {s.themeTip && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 gap-1.5 px-2 text-xs"
                onClick={() => toggleTheme()}
              >
                <Moon className="size-3.5" />
                Try dark theme
              </Button>
            )}
            {s.why && (
              <p className="mt-3 border-l-2 border-warning/60 pl-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters: </span>
                {s.why}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {needsSwitch && (s.go ?? s.links?.[0]) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => follow((s.go ?? s.links![0])!, persona.id)}
                >
                  Switch to {persona.name.split(" ")[0]}
                </Button>
              )}
              {s.go && !needsSwitch && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => follow(s.go!)}
                >
                  {s.go.label}
                </Button>
              )}
              {s.links?.map((l) => (
                <Button
                  key={l.label}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => follow(l)}
                >
                  {l.label}
                </Button>
              ))}
              {s.doForMe && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-warning/60 text-xs"
                  disabled={Boolean(actionDone)}
                  onClick={doForMe}
                >
                  {actionDone ? (
                    <>
                      <Check className="size-3.5" /> Already done
                    </>
                  ) : (
                    "Do this step for me"
                  )}
                </Button>
              )}
            </div>
            {done && <p className="mt-2 text-xs text-success">{done}</p>}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        {step === 0 ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => dismiss("skipped")}>
              Skip
            </Button>
            <Button size="sm" className={cn("ml-auto", mainClass)} onClick={start}>
              Start tour
              <ArrowRight className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => goTo(step - 1)}>
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss(last ? "completed" : "skipped")}
            >
              Close
            </Button>
            {last ? (
              <Button
                size="sm"
                className={cn("ml-auto", mainClass)}
                onClick={() => dismiss("completed")}
              >
                Finish
                <Check className="size-3.5" />
              </Button>
            ) : (
              <Button size="sm" className={cn("ml-auto", mainClass)} onClick={() => goTo(step + 1)}>
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
