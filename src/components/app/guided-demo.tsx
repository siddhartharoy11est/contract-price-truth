import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Compass, List, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { roleById } from "@/data/roles";
import { useDemo } from "@/lib/demo-store";
import {
  BADGE_LABEL,
  PERSONA_CHIP,
  TOUR_STEPS,
  readTour,
  writeTour,
  type TourRoute,
} from "@/lib/tour";
import { cn } from "@/lib/utils";

/** How long the launcher pulses after the page loads, in milliseconds. */
const PULSE_MS = 10_000;
/** Pause before an action so the visitor sees the page, and after so they see the result. */
const BEFORE_MS = 600;
const AFTER_MS = 400;

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion() ? 0 : ms));

/** Lets React commit and the browser paint the page the tour just opened. */
const settle = () => new Promise<void>((resolve) => window.setTimeout(resolve, 60));

const HIGHLIGHT_MS = 3_000;

/** Scrolls the element a step talks about into view and rings it softly. Missing: nothing. */
function highlight(name: string | undefined) {
  if (!name) return;
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  el.classList.remove("tour-highlight");
  void el.offsetWidth;
  el.classList.add("tour-highlight");
  window.setTimeout(() => el.classList.remove("tour-highlight"), HIGHLIGHT_MS);
}

/**
 * The guided tour: a floating launcher and a compact docked panel. Next, Back and All steps
 * switch the demo account, open the page and play the step's real workflow action.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { hydrated, state, reset, selectAccount, setRole, tourRun } = useDemo();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pulse, setPulse] = useState(false);
  const autoChecked = useRef(false);
  const runId = useRef(0);
  const roleRef = useRef(state.role);
  roleRef.current = state.role;

  useEffect(() => {
    if (!hydrated || !state.accountSelected || autoChecked.current) return;
    autoChecked.current = true;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), PULSE_MS);
    if (readTour() === null) setOpen(true);
    return () => window.clearTimeout(t);
  }, [hydrated, state.accountSelected]);

  const go = useCallback(
    (r: TourRoute, replace = false) =>
      navigate({
        to: r.to,
        ...(r.search ? { search: r.search } : { search: {} }),
        ...(r.hash ? { hash: r.hash } : {}),
        replace,
      } as unknown as Parameters<typeof navigate>[0]),
    [navigate],
  );

  /** Shows step n and makes the app match it. A newer call cancels an older one. */
  const play = useCallback(
    async (n: number) => {
      const id = ++runId.current;
      const alive = () => runId.current === id;
      const s = TOUR_STEPS[n]!;
      setStep(n);
      setShowAll(false);
      setResult(null);
      setBusy(Boolean(s.route));
      try {
        if (s.persona && roleRef.current !== s.persona) setRole(s.persona);
        if (s.route) await go(s.route);
        await settle();
        let last: string | null = null;
        for (const a of s.actions ?? []) {
          await wait(BEFORE_MS);
          if (!alive()) return;
          const out = tourRun(a);
          if (out.nav) await go(out.nav, true);
          if (out.done) last = out.done;
          await wait(AFTER_MS);
          if (!alive()) return;
        }
        if (!alive()) return;
        setResult(last);
        highlight(s.highlight);
      } catch {
        // Navigation interrupted. The step still shows.
      } finally {
        if (alive()) setBusy(false);
      }
    },
    [go, setRole, tourRun],
  );

  const minimise = useCallback(() => {
    setOpen(false);
    setShowAll(false);
  }, []);

  const start = () => {
    reset();
    selectAccount("procurement");
    writeTour("started");
    void play(1);
  };

  const skip = () => {
    writeTour("skipped");
    minimise();
  };

  const finish = () => {
    writeTour("completed");
    minimise();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") minimise();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, minimise]);

  return (
    <>
      {children}
      {open && (
        <TourPanel
          step={step}
          busy={busy}
          result={result}
          showAll={showAll}
          toggleAll={() => setShowAll((v) => !v)}
          play={(n) => void play(n)}
          start={start}
          skip={skip}
          finish={finish}
          minimise={minimise}
        />
      )}
      <button
        type="button"
        onClick={() => (open ? minimise() : setOpen(true))}
        aria-label="Guided tour"
        aria-expanded={open}
        title="Guided tour"
        className={cn(
          "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-12 items-center justify-center rounded-full border-2 border-warning bg-sidebar text-sidebar-foreground shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "max-sm:hidden",
          pulse && "tour-pulse",
        )}
      >
        <Compass className="size-5" />
      </button>
    </>
  );
}

function TourPanel({
  step,
  busy,
  result,
  showAll,
  toggleAll,
  play,
  start,
  skip,
  finish,
  minimise,
}: {
  step: number;
  busy: boolean;
  result: string | null;
  showAll: boolean;
  toggleAll: () => void;
  play: (n: number) => void;
  start: () => void;
  skip: () => void;
  finish: () => void;
  minimise: () => void;
}) {
  const s = TOUR_STEPS[step]!;
  const total = TOUR_STEPS.length;
  const last = step === total - 1;
  const welcome = step === 0;
  const primary = "bg-warning text-background hover:bg-warning/90";

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className={cn(
        "surface fixed inset-x-0 bottom-0 z-40 flex max-h-[45vh] flex-col rounded-b-none pb-[env(safe-area-inset-bottom)] shadow-md",
        "sm:inset-x-auto sm:bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-4 sm:w-[360px] sm:rounded-b-lg sm:pb-0",
      )}
    >
      {!welcome && (
        <div
          className="h-1 shrink-0 overflow-hidden rounded-t-lg bg-muted"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
        >
          <div
            className="h-full bg-warning transition-[width]"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      )}
      <div className="flex items-start gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{welcome ? "Guided tour" : `Step ${step + 1} of ${total}`}</span>
            {s.persona && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">
                {PERSONA_CHIP[s.persona]}
              </span>
            )}
          </div>
          <h2 id="tour-title" className="mt-1 text-sm font-semibold leading-snug">
            {showAll ? "All steps" : s.title}
          </h2>
        </div>
        {!welcome && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={toggleAll}
            aria-label="All steps"
            aria-expanded={showAll}
            title="All steps"
          >
            <List className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={minimise}
          aria-label="Minimise the tour"
          title="Minimise (Escape)"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2 text-sm">
        {showAll ? (
          <ol className="space-y-0.5" aria-label="All steps">
            {TOUR_STEPS.map((x, i) => (
              <li key={x.title}>
                <button
                  onClick={() => play(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                    i === step && "bg-muted font-medium",
                  )}
                >
                  <span className="w-5 shrink-0 tabular text-muted-foreground">{i + 1}</span>
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
            {s.badges && (
              <div className="mb-2 flex flex-wrap gap-1">
                {s.badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                    {BADGE_LABEL[b]}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1.5 leading-relaxed">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            {s.notes?.map((n) => (
              <p key={n} className="mt-2 text-xs text-muted-foreground">
                {n}
              </p>
            ))}
            {s.why && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters: </span>
                {s.why}
              </p>
            )}
            {(busy || result) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs" aria-live="polite">
                {busy ? (
                  <span className="text-muted-foreground">Working…</span>
                ) : (
                  <>
                    <CircleCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                    <span>{result}</span>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        {welcome ? (
          <>
            <Button size="sm" variant="ghost" onClick={skip}>
              Skip
            </Button>
            <Button size="sm" className={cn("ml-auto", primary)} onClick={start}>
              Start tour
              <ArrowRight className="size-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => play(step - 1)}>
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            {last ? (
              <Button size="sm" className={cn("ml-auto", primary)} onClick={finish}>
                Finish
                <Check className="size-3.5" />
              </Button>
            ) : (
              <Button size="sm" className={cn("ml-auto", primary)} onClick={() => play(step + 1)}>
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
