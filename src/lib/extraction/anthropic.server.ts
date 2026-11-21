/** Direct Anthropic API call for extraction. Server and script only; never imported by client code. */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { IncompleteOutputError, resultSchema, type GenerateFn } from "./core";

/** The model the server function uses. Clients cannot choose it. */
export const EXTRACTION_MODEL = "claude-sonnet-5-5";

/** Per model request options. Haiku runs with extended thinking off. */
const PROVIDER_OPTIONS: Record<string, Record<string, unknown>> = {
  "claude-sonnet-5-5": { effort: "medium", structuredOutputMode: "outputFormat" },
  "claude-haiku-5-5": { effort: "medium", structuredOutputMode: "outputFormat", thinking: { type: "disabled" } },
};

export function anthropicGenerate(apiKey: string, model: string = EXTRACTION_MODEL): GenerateFn {
  const provider = createAnthropic({ apiKey });
  const options = PROVIDER_OPTIONS[model];
  if (!options) throw new Error(`Unsupported extraction model ${model}`);
  return async ({ system, prompt, maxOutputTokens, signal }) => {
    try {
      const res = await generateText({
        model: provider(model),
        system,
        prompt,
        output: Output.object({ schema: resultSchema }),
        maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
        providerOptions: { anthropic: options as never },
      });
      return {
        terms: res.output.terms,
        finishReason: res.finishReason,
        inputTokens: res.totalUsage.inputTokens ?? 0,
        outputTokens: res.totalUsage.outputTokens ?? 0,
      };
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) {
        const why = e.finishReason === "length" ? "cut off at the output limit" : "returned incomplete or invalid JSON";
        throw new IncompleteOutputError(why, e.usage?.inputTokens ?? 0, e.usage?.outputTokens ?? 0);
      }
      throw e;
    }
  };
}
