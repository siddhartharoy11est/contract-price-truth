import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import aboutSource from "../../../docs/About_This_Project_content_v2.md?raw";
import { parseAbout } from "@/lib/about-content";
import { AboutArticle } from "./about-article";

const blocks = parseAbout(aboutSource);

function renderPage() {
  return render(
    <AboutArticle blocks={blocks} validationLink={<a href="/tests">Prototype validation</a>} />,
  );
}

describe("About page content", () => {
  it("leaves out the build notes and keeps every section from 1 to 7", () => {
    const h2 = blocks
      .filter((b) => b.type === "heading" && b.level === 2)
      .map((b) => (b.type === "heading" ? b.id : ""));
    expect(h2).toEqual(
      expect.arrayContaining([
        "section-1",
        "section-2",
        "section-3",
        "section-4",
        "section-5",
        "section-6",
        "section-7",
      ]),
    );
    expect(aboutSource).toContain("Notes for the build");
    expect(JSON.stringify(blocks)).not.toContain("Notes for the build");
  });

  it("renders the Documented bullets as a real list", () => {
    const i = blocks.findIndex((b) => b.type === "paragraph" && b.text === "**Documented**");
    const next = blocks[i + 1];
    expect(next?.type).toBe("list");
    expect(next?.type === "list" ? next.items.length : 0).toBe(3);
  });

  it("renders the greeting card and the four chart containers", () => {
    renderPage();
    expect(screen.getByTestId("greeting-card")).toBeInTheDocument();
    expect(screen.getByAltText("Illustration of Sid")).toHaveAttribute(
      "src",
      "/assets/sid-avatar.svg",
    );
    for (const name of ["problem-flow", "metric-tree", "trajectory", "sensitivity"]) {
      expect(screen.getByTestId(`chart-${name}`)).toBeInTheDocument();
    }
  });

  it("opens plain URLs in a new tab safely", () => {
    const { container } = renderPage();
    const links = [...container.querySelectorAll('a[href^="http"]')];
    expect(links.length).toBeGreaterThanOrEqual(9);
    for (const a of links) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("has no em or en dashes and no first person plural in the page text", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(new RegExp("[\\u2013\\u2014]"));
    expect(text).not.toMatch(/\bwe\b/i);
  });
});
