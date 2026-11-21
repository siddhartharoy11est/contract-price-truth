/** Counts only counter store on Cloudflare D1. Holds keys and integers, never document text. */
import type { CounterStore } from "./guard";

/** Minimal shape of the D1 binding used here. */
interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
    run(): Promise<unknown>;
  };
}

const CREATE = "CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL)";
const INCREMENT =
  "INSERT INTO counters (key, count) VALUES (?1, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ?2 RETURNING count";
const DECREMENT = "UPDATE counters SET count = count - 1 WHERE key = ?1 AND count > 0";

export function d1CounterStore(db: unknown): CounterStore | null {
  if (!db || typeof (db as D1Like).prepare !== "function") return null;
  const d1 = db as D1Like;
  let ready: Promise<unknown> | null = null;
  const ensure = () => (ready ??= d1.prepare(CREATE).run());
  return {
    async increment(key, limit) {
      await ensure();
      const row = await d1.prepare(INCREMENT).bind(key, limit).first<{ count: number }>();
      return row ? { allowed: true, count: row.count } : { allowed: false, count: limit };
    },
    async decrement(key) {
      await ensure();
      await d1.prepare(DECREMENT).bind(key).run();
    },
  };
}
