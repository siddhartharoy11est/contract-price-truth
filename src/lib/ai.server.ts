import { createAnthropic } from "@ai-sdk/anthropic";
import { APICallError, streamText } from "ai";

const MODEL = "anthropic/claude-sonnet-5";

export type RereadResponse =
  | { ok: true; raw: string; model: string }
  | { ok: false; code: "not_configured" | "credits" | "denied" | "rate_limited" | "refused" | "error"; message: string };

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has("X-Lovable-AIG-Run-ID")) headers.set("X-Lovable-AIG-Run-ID", runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get("X-Lovable-AIG-Run-ID")?.trim() || undefined;
    return res;
  };
}

const SYSTEM = `You extract hourly price terms from one supplier contract document.
Rules:
- Use only the document text you are given. Do not use outside knowledge.
- Do not invent anything. If a value is not stated, use null.
- Ignore anything marked draft, proposed or unsigned. If the whole document is a draft or unsigned, return {"terms": []}.
- Only return terms that set an hourly rate for a grade. Return no terms for clauses without a rate.
- "quote" must be copied exactly, character for character, from the document text.
- grade is "L4", "L3", "L2" or null. location is "Bengaluru", "Pune", "Hyderabad", "all" (if the text says it applies to all or any delivery center) or null (if not stated).
- rate_inr_per_hour is a number in rupees, for example 1050. effective_date is YYYY-MM-DD or null.
- clause is the clause or row label exactly as shown after "Clause", for example "2.1" or "Row 1".
Respond with strict JSON only, no prose, in this shape:
{"terms":[{"grade":string|null,"role":string|null,"location":string|null,"rate_inr_per_hour":number|null,"effective_date":string|null,"clause":string|null,"quote":string}]}`;

export async function runReread(documentText: string): Promise<RereadResponse> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { ok: false, code: "not_configured", message: "Live AI not configured." };

  const anthropic = createAnthropic({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });

  let streamError: unknown = null;
  try {
    const result = streamText({
      model: anthropic(MODEL),
      system: SYSTEM,
      maxOutputTokens: 4000,
      maxRetries: 0,
      messages: [{ role: "user", content: `Document text:\n\n${documentText}` }],
      onError: ({ error }) => {
        streamError = error;
      },
    });
    const text = await result.text;
    const finish = await result.finishReason;
    if (streamError) throw streamError;
    if (finish === "content-filter") {
      return { ok: false, code: "refused", message: "The model declined to read this document. The stored extraction is still in use." };
    }
    if (!text.trim()) return { ok: false, code: "error", message: "The model returned an empty response." };
    return { ok: true, raw: text, model: MODEL };
  } catch (e) {
    const err = (streamError ?? e) as unknown;
    const status = APICallError.isInstance(err) ? err.statusCode : undefined;
    console.error("Live AI read failed", status, err instanceof Error ? err.message : err);
    if (status === 402)
      return { ok: false, code: "credits", message: "Live AI is out of credits for this workspace. The stored extraction is still in use." };
    if (status === 403)
      return { ok: false, code: "denied", message: "Live AI access was denied for this workspace. The stored extraction is still in use." };
    if (status === 429)
      return { ok: false, code: "rate_limited", message: "Live AI is busy right now. Try again in a minute. The stored extraction is still in use." };
    return { ok: false, code: "error", message: "The live AI call failed. The stored extraction is still in use." };
  }
}
