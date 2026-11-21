import { useEffect, useState, type MouseEvent } from "react";

/**
 * Slim sticky list of sections 1 to 7, shown from 1100px wide. The section that crosses a
 * thin line 30% down the viewport is the current one.
 */
export function ProgressRail({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = sections
      .map((s) => document.querySelector<HTMLElement>(`[data-section="${s.id}"]`))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive((e.target as HTMLElement).dataset["section"] ?? null);
        }
      },
      { rootMargin: "-30% 0px -69% 0px" },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  function go(e: MouseEvent<HTMLAnchorElement>, id: string) {
    const heading = document.getElementById(id);
    if (!heading) return;
    e.preventDefault();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    setActive(id);
  }

  return (
    <nav aria-label="Sections on this page" className="hidden min-[1100px]:block">
      <ol className="sticky top-24 space-y-0.5 border-l text-[13px]">
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => go(e, s.id)}
                aria-current={current ? "true" : undefined}
                className={`-ml-px block border-l-2 py-1 pl-3 leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                  current
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
