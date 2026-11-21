/**
 * Calls the deployed live extraction server function the way the app's client does.
 * Usage: bun scripts/live-check.ts <baseUrl> <case>
 * Cases: oversize | tiny | unknown-field
 * Prints status, outcome code and timing only. Never needs or prints an API key.
 */
import { fromJSON, toJSONAsync } from "seroval";

const FN_URL = "/_serverFn/fed1dc8e24d75af9483102f9539f3c03d6c93e63243aa1ed315d6c185fd28662";

const TINY = {
  documentType: "Order Form",
  signingStatus: "Signed",
  text: "[[PAGE 1]]\nOrder Form for synthetic test only. The rates below apply to all locations.\nRole: Test Analyst. Rate: INR 450 per hour from 1 January 2027.",
};

function body(c: string): unknown {
  if (c === "oversize")
    return { ...TINY, text: Array.from({ length: 26 }, (_, i) => `[[PAGE ${i + 1}]]\nPage ${i + 1} text`).join("\n") };
  if (c === "unknown-field") return { ...TINY, model: "claude-opus-5-5" };
  return TINY;
}

async function main() {
  const [base, c] = process.argv.slice(2);
  if (!base || !c) throw new Error("Usage: bun scripts/live-check.ts <baseUrl> <case>");
  const url = new URL(FN_URL, base);
  const payload = JSON.stringify(await toJSONAsync({ data: body(c) }));
  const started = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-tsr-serverFn": "true",
      origin: url.origin,
      "sec-fetch-site": "same-origin",
    },
    body: payload,
  });
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let summary = text.slice(0, 200);
  try {
    const value = fromJSON(JSON.parse(text)) as Record<string, unknown>;
    const r = (value?.["result"] ?? value) as Record<string, unknown>;
    summary = r["ok"]
      ? `ok terms=${(r["terms"] as unknown[]).length} accepted=${r["accepted"]} rejected=${r["rejected"]} chunks=${r["chunks"]}`
      : `code=${r["code"]} message=${r["message"]}`;
  } catch {
    // leave the raw prefix
  }
  console.log(`${c}: HTTP ${res.status} in ${ms} ms | ${summary}`);
}

main().catch((e) => {
  console.error(`ERROR ${(e as Error).message}`);
  process.exit(1);
});
