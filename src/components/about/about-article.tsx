import { Fragment, type ReactNode } from "react";
import { parseInline, type Block, type Inline } from "@/lib/about-content";
import { MetricTree, ProblemFlow, Sensitivity, Trajectory } from "./about-visuals";

/** Renders the parsed About content. Wording comes only from the content file. */

function InlineText({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>;
}

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "strong":
        return (
          <strong key={i} className="font-semibold">
            {renderInline(n.children)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            {n.href}
          </a>
        );
    }
  });
}

export function ContentTable({
  head,
  align,
  rows,
  label,
}: {
  head: string[];
  align: ("left" | "center")[];
  rows: string[][];
  label: string;
}) {
  const hasHead = head.some((h) => h.trim());
  const cols = head.length;
  const minW = cols >= 5 ? "min-w-[46rem]" : cols === 4 ? "min-w-[34rem]" : "";
  return (
    <div
      className="my-4 max-w-full overflow-x-auto rounded-md border"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className={`w-full text-sm ${minW}`}>
        {hasHead && (
          <thead>
            <tr>
              {head.map((h, j) => (
                <th
                  key={j}
                  scope="col"
                  className={`table-heading ${align[j] === "center" ? "text-center" : ""}`}
                >
                  <InlineText text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3.5 py-2.5 align-top leading-relaxed ${
                    align[j] === "center" ? "text-center" : ""
                  } ${!hasHead && j === 0 ? "w-40 text-muted-foreground" : ""}`}
                >
                  <InlineText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BlockView({
  block,
  heading,
  first,
  validationLink,
}: {
  block: Block;
  heading: string;
  first: boolean;
  validationLink: ReactNode;
}) {
  switch (block.type) {
    case "greeting":
      return <Greeting text={block.text} />;
    case "heading": {
      if (block.level === 1)
        return (
          <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {block.text}
          </h1>
        );
      if (block.level === 2)
        return (
          <h2
            id={block.id}
            className={
              first
                ? "mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
                : "mt-12 scroll-mt-24 text-2xl font-semibold leading-tight"
            }
          >
            {block.text}
          </h2>
        );
      return (
        <h3 id={block.id} className="mt-8 mb-2 scroll-mt-24 text-lg font-semibold">
          {block.text}
        </h3>
      );
    }
    case "paragraph": {
      if (block.text === "**Prototype validation**")
        return <div className="mb-6">{validationLink}</div>;
      const tagline = /^\*[^*]+\*$/.test(block.text);
      return (
        <p className={tagline ? "mt-1 mb-4 text-lg text-muted-foreground" : "my-3 leading-relaxed"}>
          <InlineText text={block.text} />
        </p>
      );
    }
    case "list":
      return (
        <ul className="my-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          {block.items.map((it, i) => (
            <li key={i}>
              <InlineText text={it} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote
          className="my-4 space-y-1 rounded border-l-[3px] bg-muted px-4 py-3"
          style={{ borderLeftColor: "var(--s1)" }}
        >
          {block.paragraphs.map((p, i) => (
            <p key={i}>
              <InlineText text={p} />
            </p>
          ))}
        </blockquote>
      );
    case "table":
      return (
        <ContentTable head={block.head} align={block.align} rows={block.rows} label={heading} />
      );
    case "rule":
      return <hr className="my-9 border-border" />;
    case "visual":
      return <Visual name={block.name} />;
  }
}

function Visual({ name }: { name: string }) {
  switch (name) {
    case "problem-flow":
      return <ProblemFlow />;
    case "metric-tree":
      return <MetricTree />;
    case "trajectory":
      return <Trajectory />;
    case "sensitivity":
      return <Sensitivity />;
    default:
      return null;
  }
}

function Greeting({ text }: { text: string }) {
  return (
    <aside
      data-testid="greeting-card"
      className="mb-7 flex items-center gap-4 rounded-2xl bg-muted px-4 py-3.5 sm:px-5"
    >
      <img
        src="/assets/sid-avatar.svg"
        alt="Illustration of Sid"
        width={56}
        height={56}
        className="size-14 flex-none rounded-full transition-transform duration-200 hover:-rotate-[5deg] motion-reduce:transition-none motion-reduce:hover:rotate-0"
      />
      <p className="m-0 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
    </aside>
  );
}

type Section = { id: string; title: string; blocks: Block[] };

export function groupSections(blocks: Block[]): { intro: Block[]; sections: Section[] } {
  const intro: Block[] = [];
  const sections: Section[] = [];
  for (const b of blocks) {
    if (b.type === "heading" && b.level === 2) {
      sections.push({ id: b.id, title: b.text, blocks: [b] });
    } else if (sections.length) {
      sections[sections.length - 1]?.blocks.push(b);
    } else {
      intro.push(b);
    }
  }
  return { intro, sections };
}

export function AboutArticle({
  blocks,
  validationLink,
}: {
  blocks: Block[];
  validationLink: ReactNode;
}) {
  const { intro, sections } = groupSections(blocks);

  const renderList = (list: Block[], firstSection: boolean) => {
    let heading = "";
    return list.map((b, i) => {
      if (b.type === "heading") heading = b.text;
      return (
        <BlockView
          key={i}
          block={b}
          heading={heading || "Table"}
          first={firstSection && i === 0}
          validationLink={validationLink}
        />
      );
    });
  };

  return (
    <article
      className="min-w-0 text-[15px] [--s1:#2a78d6] [--s2:#eb6834] dark:[--s1:#3987e5] dark:[--s2:#d95926]"
      data-testid="about-article"
    >
      {renderList(intro, false)}
      {sections.map((s, n) => (
        <section key={s.id} data-section={s.id}>
          {renderList(s.blocks, n === 0)}
        </section>
      ))}
    </article>
  );
}
