/**
 * Server side guard for live extraction (PRD 7.5). Pure apart from injected dependencies, so
 * every control can be tested with a mocked model call and an in memory counter store.
 * Logs counts, sizes and outcomes only. Document text is never logged or stored.
 */
import { z } from "zod";
import { extractDocument, splitPageMarkedText, type CheckedTerm, type GenerateFn } from "./core";

export const LIMITS = {
  maxBodyBytes: 250_000,
  maxPages: 25,
  maxChars: 80_000,
  perClientPerDay: 3,
  globalPerDay: 20,
  maxChunkCalls: 4,
} as const;

/** One document per request. Unknown fields (including any prompt or model) are rejected. */
export const extractRequestSchema = z
  .object({
    documentType: z.enum(["Agreement", "Schedule", "Amendment", "Order Form", "Supplier notice", "Other"]),
    signingStatus: z.enum(["Signed", "Unsigned draft", "Received notice"]),
    text: z.string().min(1),
  })
  .strict();
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export type ExtractErrorCode =
  | "invalid_request"
  | "too_large"
  | "disabled"
  | "not_configured"
  | "client_limit"
  | "capacity"
  | "store_unavailable"
  | "extraction_failed";

export type ExtractResponse =
  | {
      ok: true;
      pages: number;
      chunks: number;
      terms: CheckedTerm[];
      accepted: number;
      rejected: number;
    }
  | { ok: false; code: ExtractErrorCode; message: string };

/** Atomic counts only. `increment` adds one only while the count is below the limit. */
export interface CounterStore {
  increment(key: string, limit: number): Promise<{ allowed: boolean; count: number }>;
  decrement(key: string): Promise<void>;
}

export interface GuardDeps {
  /** Raw environment: LIVE_EXTRACTION ("on" enables), ANTHROPIC_API_KEY, IP_HASH_SALT. */
  env: Record<string, unknown>;
  bodyBytes: number;
  clientIp: string;
  /** Null when no counter store binding is available. */
  store: CounterStore | null;
  makeGenerate: (apiKey: string) => GenerateFn;
  now?: () => Date;
  log?: (entry: Record<string, string | number | boolean>) => void;
  timeoutMs?: number;
}

export const MESSAGES = {
  disabled: "Live extraction is switched off right now. The stored demo keeps working.",
  capacity:
    "Live extraction has reached today's limit for everyone. It pauses until tomorrow, and the stored demo keeps working.",
  clientLimit: "You have used today's live extractions from this connection. The stored demo keeps working.",
  storeUnavailable: "Live extraction is unavailable because its usage counter cannot be reached. The stored demo keeps working.",
  notConfigured: "Live extraction is not configured on this server. The stored demo keeps working.",
} as const;

export async function hashClientIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function handleExtract(input: unknown, deps: GuardDeps): Promise<ExtractResponse> {
  const log = deps.log ?? ((e) => console.log(JSON.stringify({ event: "live_extraction", ...e })));
  const reject = (code: ExtractErrorCode, message: string, extra: Record<string, string | number | boolean> = {}): ExtractResponse => {
    log({ outcome: code, bodyBytes: deps.bodyBytes, ...extra });
    return { ok: false, code, message };
  };

  // Size and shape. Nothing below this block runs for an over limit or malformed request.
  if (deps.bodyBytes > LIMITS.maxBodyBytes)
    return reject("too_large", `The request is larger than ${LIMITS.maxBodyBytes / 1000} KB.`);
  if (Array.isArray(input)) return reject("too_large", "Send one document per request.");
  const parsed = extractRequestSchema.safeParse(input);
  if (!parsed.success) {
    const unknown = parsed.error.issues.some((i) => i.code === "unrecognized_keys");
    return reject("invalid_request", unknown ? "The request has fields that are not allowed." : "The request is not valid.");
  }
  const req = parsed.data;
  const restarts = (req.text.match(/^\[\[PAGE 1\]\]/gm) ?? []).length;
  if (restarts > 1) return reject("too_large", "Send one document per request.");
  const pages = splitPageMarkedText(req.text);
  if (!pages) return reject("invalid_request", "The text must be page marked with [[PAGE n]] lines, starting at page 1.");
  const chars = pages.reduce((s, p) => s + p.length, 0);
  const size = { pages: pages.length, chars };
  if (pages.length > LIMITS.maxPages)
    return reject("too_large", `The document has ${pages.length} pages. The limit is ${LIMITS.maxPages}.`, size);
  if (chars > LIMITS.maxChars)
    return reject("too_large", `The document has ${chars} characters of text. The limit is ${LIMITS.maxChars}.`, size);

  // Kill switch and configuration.
  if (deps.env["LIVE_EXTRACTION"] !== "on") return reject("disabled", MESSAGES.disabled, size);
  const apiKey = deps.env["ANTHROPIC_API_KEY"];
  if (typeof apiKey !== "string" || !apiKey) return reject("not_configured", MESSAGES.notConfigured, size);

  // Counters. Fail closed if the store is missing or errors.
  if (!deps.store) return reject("store_unavailable", MESSAGES.storeUnavailable, size);
  const day = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  const salt = typeof deps.env["IP_HASH_SALT"] === "string" ? (deps.env["IP_HASH_SALT"] as string) : "contract-price-truth";
  const clientKey = `client:${day}:${await hashClientIp(deps.clientIp, salt)}`;
  const globalKey = `global:${day}`;
  try {
    const client = await deps.store.increment(clientKey, LIMITS.perClientPerDay);
    if (!client.allowed) return reject("client_limit", MESSAGES.clientLimit, size);
    const global = await deps.store.increment(globalKey, LIMITS.globalPerDay);
    if (!global.allowed) {
      await deps.store.decrement(clientKey).catch(() => undefined);
      return reject("capacity", MESSAGES.capacity, size);
    }
  } catch {
    return reject("store_unavailable", MESSAGES.storeUnavailable, size);
  }

  const started = Date.now();
  const out = await extractDocument(pages, deps.makeGenerate(apiKey), {
    maxChunkCalls: LIMITS.maxChunkCalls,
    ...(deps.timeoutMs ? { timeoutMs: deps.timeoutMs } : {}),
  });
  const stats = {
    ...size,
    chunks: out.chunks,
    calls: out.calls,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    ms: Date.now() - started,
  };
  if (!out.ok) return reject("extraction_failed", `Live extraction failed: ${out.message} The stored demo keeps working.`, stats);
  const accepted = out.checked.filter((c) => c.accepted).length;
  log({ outcome: "ok", bodyBytes: deps.bodyBytes, ...stats, terms: out.checked.length, accepted });
  return {
    ok: true,
    pages: pages.length,
    chunks: out.chunks,
    terms: out.checked,
    accepted,
    rejected: out.checked.length - accepted,
  };
}
