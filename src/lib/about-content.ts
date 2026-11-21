/**
 * A small parser for docs/About_This_Project_content_v2.md, the single source of truth for
 * the About page wording. It covers only what that file uses: headings, paragraphs, bold,
 * italic, plain URLs, tables, bullet lists, block quotes, rules and the [[...]] markers.
 * Everything from "## Notes for the build" on is left out of the page.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string };

export type Align = "left" | "center";

export type Block =
  | { type: "greeting"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; paragraphs: string[] }
  | { type: "table"; head: string[]; align: Align[]; rows: string[][] }
  | { type: "rule" }
  | { type: "visual"; name: string };

const BUILD_NOTES = /^##\s+Notes for the build/;

export function slugify(text: string): string {
  const numbered = /^(\d+)\.\s/.exec(text);
  if (numbered) return `section-${numbered[1]}`;
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableLine = (l: string) => l.trim().startsWith("|");
const isListLine = (l: string) => /^\s*-\s+/.test(l);
const isRule = (l: string) => l.trim() === "---";

export function parseAbout(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (BUILD_NOTES.test(trimmed)) break;
    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === "[[GREETING]]") {
      const body: string[] = [];
      i++;
      while (i < lines.length && (lines[i] ?? "").trim() !== "[[/GREETING]]") {
        body.push((lines[i] ?? "").trim());
        i++;
      }
      i++;
      blocks.push({ type: "greeting", text: body.filter(Boolean).join(" ") });
      continue;
    }

    const visual = /^\[\[VISUAL:\s*([\w-]+)\s*\]\]$/.exec(trimmed);
    if (visual) {
      blocks.push({ type: "visual", name: visual[1] ?? "" });
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = (heading[1] ?? "#").length as 1 | 2 | 3;
      const text = heading[2] ?? "";
      blocks.push({ type: "heading", level, text, id: slugify(text) });
      i++;
      continue;
    }

    if (isRule(trimmed)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (isTableLine(trimmed)) {
      const raw: string[] = [];
      while (i < lines.length && isTableLine(lines[i] ?? "")) {
        raw.push(lines[i] ?? "");
        i++;
      }
      const head = splitRow(raw[0] ?? "");
      const align: Align[] = splitRow(raw[1] ?? "").map((c) =>
        c.startsWith(":") && c.endsWith(":") ? "center" : "left",
      );
      const rows = raw.slice(2).map(splitRow);
      blocks.push({ type: "table", head, align, rows });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const paragraphs: string[] = [];
      let current: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) {
        const content = (lines[i] ?? "").trim().replace(/^>\s?/, "").trim();
        if (content) current.push(content);
        else if (current.length) {
          paragraphs.push(current.join(" "));
          current = [];
        }
        i++;
      }
      if (current.length) paragraphs.push(current.join(" "));
      blocks.push({ type: "quote", paragraphs });
      continue;
    }

    if (isListLine(line)) {
      const items: string[] = [];
      while (i < lines.length && isListLine(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*-\s+/, "").trim());
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // A paragraph runs until a blank line or the start of another block. A bullet line
    // directly after a bold label (as under "Documented") ends the paragraph and starts a list.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? "";
      const t = l.trim();
      if (
        !t ||
        isListLine(l) ||
        isTableLine(t) ||
        isRule(t) ||
        t.startsWith(">") ||
        /^#{1,3}\s/.test(t) ||
        t.startsWith("[[")
      )
        break;
      para.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|https?:\/\/[^\s)]+)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const token = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (token.startsWith("**")) {
      out.push({ kind: "strong", children: parseInline(token.slice(2, -2)) });
      last = at + token.length;
    } else if (token.startsWith("*")) {
      out.push({ kind: "em", children: parseInline(token.slice(1, -1)) });
      last = at + token.length;
    } else {
      // Trailing sentence punctuation is not part of the address.
      const href = token.replace(/[.,;:]+$/, "");
      out.push({ kind: "link", href });
      last = at + href.length;
    }
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

/** Plain text of an inline string, used for titles, labels and the text scans in tests. */
export function plainText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

export type Section = { id: string; title: string; blocks: Block[] };

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
