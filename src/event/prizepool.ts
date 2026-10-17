import { z } from "zod";
import { configFor } from "../config.js";
import { log } from "../log.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { communityHm } from "../time/time.js";

// The live community prize pool total, read from Matcherino's public balance endpoint for the
// bounty in MATCHERINO_BOUNTY_ID. Only the balance is read: no donor data and no donations
// endpoint. The result is one line for the volatile block of the help route, or null. It never
// throws and a failure never reaches the answer.

export const PRIZE_POOL_FRESH_SEC = 300; // a fetched balance is served for 5 minutes
export const PRIZE_POOL_STALE_SEC = 24 * 60 * 60; // and kept for a day as the fallback
export const PRIZE_POOL_TIMEOUT_MS = 4000;

const BALANCE_URL = "https://api.matcherino.com/__api/bounties/balance";

// A decimal string such as "15140.00".
const Decimal = z.string().regex(/^\d+(\.\d+)?$/);

const Balance = z.object({ balance: Decimal });

const PoolRecordSchema = z.object({ balance: Decimal, fetchedAt: z.number().int().nonnegative() });
type PoolRecord = z.infer<typeof PoolRecordSchema>;

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown";
}

// Whole dollars with thousands separators; cents only when the balance has them.
function dollars(balance: string): string | null {
  const cents = Math.round(Number(balance) * 100);
  if (!Number.isSafeInteger(cents)) return null;
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const rest = cents % 100;
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, "0")}`;
}

function lineOf(record: PoolRecord): string | null {
  const amount = dollars(record.balance);
  if (amount === null) return null;
  return `Community prize pool total: ${amount} (updated ${communityHm(new Date(record.fetchedAt))})`;
}

async function readRecord(key: string): Promise<PoolRecord | null> {
  try {
    const raw = await kv().get<unknown>(key);
    if (raw === null) return null;
    const parsed = PoolRecordSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    log("warn", "prizepool.cache_invalid", { key });
    return null;
  } catch (err) {
    log("warn", "prizepool.cache_failed", { op: "read", error: errorName(err) });
    return null;
  }
}

async function writeRecord(id: string, record: PoolRecord): Promise<void> {
  try {
    await kv().set(keys.prizePool(id), record, PRIZE_POOL_FRESH_SEC);
    await kv().set(keys.prizePoolStale(id), record, PRIZE_POOL_STALE_SEC);
  } catch (err) {
    log("warn", "prizepool.cache_failed", { op: "write", error: errorName(err) });
  }
}

// The balance string from Matcherino, or null after logging why not.
async function fetchBalance(id: string): Promise<string | null> {
  const url = new URL(BALANCE_URL);
  url.searchParams.set("bountyId", id);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PRIZE_POOL_TIMEOUT_MS),
    });
  } catch (err) {
    log("warn", "prizepool.fetch_failed", { error: errorName(err) });
    return null;
  }
  if (!res.ok) {
    log("warn", "prizepool.fetch_failed", { status: res.status });
    return null;
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    log("warn", "prizepool.fetch_failed", { error: errorName(err) });
    return null;
  }
  const parsed = Balance.safeParse(body);
  if (!parsed.success) {
    log("warn", "prizepool.fetch_failed", { error: "BadShape" });
    return null;
  }
  return parsed.data.balance;
}

// One line with the community prize pool total and when it was read, on the community clock.
// Null when the feature is off (no bounty id; no network call) or nothing usable is known.
export async function prizePoolLine(now: Date): Promise<string | null> {
  let id: string | null;
  try {
    id = configFor("matcherinoBountyId").matcherinoBountyId;
  } catch (err) {
    log("warn", "prizepool.config_invalid", { error: errorName(err) });
    return null;
  }
  if (id === null) return null;

  try {
    const fresh = await readRecord(keys.prizePool(id));
    if (fresh) return lineOf(fresh);

    const balance = await fetchBalance(id);
    if (balance !== null) {
      const record: PoolRecord = { balance, fetchedAt: now.getTime() };
      await writeRecord(id, record);
      return lineOf(record);
    }

    const stale = await readRecord(keys.prizePoolStale(id));
    return stale ? lineOf(stale) : null;
  } catch (err) {
    log("warn", "prizepool.fetch_failed", { error: errorName(err) });
    return null;
  }
}
