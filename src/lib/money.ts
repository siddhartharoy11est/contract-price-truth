/** Money is held as integer paise everywhere. Never use floats for amounts. */
export type Paise = number;

export function rupees(r: number): Paise {
  return Math.round(r * 100);
}

/** Parses "1,200" or "1200.50" or "₹1,200" into paise. Returns null when invalid. */
export function parseRupees(input: string): Paise | null {
  const s = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [i = "0", f = ""] = s.split(".");
  return Number(i) * 100 + Number((f + "00").slice(0, 2));
}

/** Parses hours with up to two decimals. Returns null when invalid. */
export function parseHours(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

/** Formats paise as INR with Indian digit grouping, for example ₹1,05,000. */
export function formatINR(paise: Paise): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const r = Math.floor(abs / 100);
  const p = abs % 100;
  const body = `₹${groupIndian(String(r))}${p ? `.${String(p).padStart(2, "0")}` : ""}`;
  return neg ? `-${body}` : body;
}

/** hours x rate, computed in integer centi-hours to stay decimal-safe. */
export function amountFor(hours: number, ratePaise: Paise): Paise {
  const centiHours = Math.round(hours * 100);
  return Math.round((centiHours * ratePaise) / 100);
}
