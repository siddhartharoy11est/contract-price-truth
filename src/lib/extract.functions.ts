import { createServerFn } from "@tanstack/react-start";
import type { ExtractResponse } from "./extraction/guard";

/**
 * Live extraction server function (PRD 7.5). The input is passed through unparsed so that the
 * server side guard sees the raw shape: it validates with Zod, rejects unknown fields and
 * enforces every limit before any model call. The prompt and model are fixed on the server.
 */
export const extractDocumentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input)
  .handler(async ({ data }): Promise<ExtractResponse> => {
    const { runLiveExtraction } = await import("./extraction/entry.server");
    return runLiveExtraction(data);
  });
