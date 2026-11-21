/** Wires the guard to the Workers runtime: bindings, secrets, caller IP and body size. Server only. */
import { getRequestHeader } from "@tanstack/react-start/server";
import { anthropicGenerate } from "./anthropic.server";
import { d1CounterStore } from "./d1-counter.server";
import { handleExtract, type ExtractResponse } from "./guard";

/** Nitro's cloudflare-module runtime sets this to the Worker env (bindings, vars, secrets) on each request. */
function workerEnv(): Record<string, unknown> {
  const env = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  return env ?? (process.env as Record<string, unknown>);
}

export async function runLiveExtraction(data: unknown): Promise<ExtractResponse> {
  const env = workerEnv();
  const declared = Number(getRequestHeader("content-length") ?? NaN);
  const measured = new TextEncoder().encode(JSON.stringify(data ?? null)).length;
  const bodyBytes = Number.isFinite(declared) ? Math.max(declared, measured) : measured;
  const clientIp = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return handleExtract(data, {
    env,
    bodyBytes,
    clientIp,
    store: d1CounterStore(env["COUNTERS"]),
    makeGenerate: (apiKey) => anthropicGenerate(apiKey),
  });
}
