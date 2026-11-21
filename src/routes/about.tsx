import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import aboutSource from "../../docs/About_This_Project_content_v2.md?raw";
import { AboutArticle } from "@/components/about/about-article";
import { Button } from "@/components/ui/button";
import { parseAbout } from "@/lib/about-content";

/** Every word on this page comes from docs/About_This_Project_content_v2.md. */
const BLOCKS = parseAbout(aboutSource);

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

function AboutPage() {
  return (
    <div className="surface max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <AboutArticle
        blocks={BLOCKS}
        validationLink={
          <Button asChild variant="outline" size="sm">
            <Link to="/tests">
              <FlaskConical />
              Prototype validation
            </Link>
          </Button>
        }
      />
    </div>
  );
}
