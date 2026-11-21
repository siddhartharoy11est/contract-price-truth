import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DOCUMENTS, documentPlainText } from "@/data/seed";

export const getLiveAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: Boolean(process.env["LOVABLE_API_KEY"]) };
});

export const rereadDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ docId: z.string().max(64) }).parse(input))
  .handler(async ({ data }) => {
    const doc = DOCUMENTS.find((d) => d.id === data.docId && d.supplierId === "brighthire");
    if (!doc) return { ok: false as const, code: "error" as const, message: "Unknown document." };
    const { runReread } = await import("./ai.server");
    return runReread(documentPlainText(doc.id));
  });
