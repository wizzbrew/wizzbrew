import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import {
  PRIZE_POOL_FRESH_SEC,
  PRIZE_POOL_STALE_SEC,
  PRIZE_POOL_TIMEOUT_MS,
  prizePoolLine,
} from "../../src/event/prizepool.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { FakeKv } from "../fakes/kv.js";

const BOUNTY = "182107";
const URL_FOR_BOUNTY = `https://api.matcherino.com/__api/bounties/balance?bountyId=${BOUNTY}`;
// 14:05 on the community clock (America/New_York, EDT).
const T0 = new Date("2026-10-17T18:05:00Z");
const LINE = "Community prize pool total: $15,140 (updated 14:05)";

let clock: number;
let store: FakeKv;
let calls: { url: string; init: RequestInit | undefined }[];
let respond: (init: RequestInit | undefined) => Promise<Response>;
let logged: Record<string, unknown>[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function failures(): Record<string, unknown>[] {
  return logged.filter((l) => l.event === "prizepool.fetch_failed");
}

beforeEach(() => {
  clock = T0.getTime();
  store = new FakeKv(() => clock);
  setKvForTests(store);
  calls = [];
  respond = async () => json({ balance: "15140.00" });
  logged = [];
  vi.stubEnv("MATCHERINO_BOUNTY_ID", BOUNTY);
  resetConfigForTests();
  vi.stubGlobal("fetch", (async (input, init) => {
    calls.push({ url: String(input instanceof Request ? input.url : input), init });
    return respond(init);
  }) as typeof fetch);
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logged.push(JSON.parse(String(line)) as Record<string, unknown>);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setKvForTests(null);
  resetConfigForTests();
});

describe("prizePoolLine", () => {
  it("formats the balance in whole dollars with the update time on the community clock", async () => {
    expect(await prizePoolLine(T0)).toBe(LINE);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(URL_FOR_BOUNTY);
    expect(failures()).toEqual([]);
  });

  it("keeps the cents when the balance has them and groups thousands", async () => {
    respond = async () => json({ balance: "1234567.5" });
    expect(await prizePoolLine(T0)).toBe(
      "Community prize pool total: $1,234,567.50 (updated 14:05)",
    );
    store = new FakeKv(() => clock);
    setKvForTests(store);
    respond = async () => json({ balance: "999.00" });
    expect(await prizePoolLine(T0)).toBe("Community prize pool total: $999 (updated 14:05)");
    store = new FakeKv(() => clock);
    setKvForTests(store);
    respond = async () => json({ balance: "0.00" });
    expect(await prizePoolLine(T0)).toBe("Community prize pool total: $0 (updated 14:05)");
  });

  it("ignores fields it does not need", async () => {
    respond = async () => json({ balance: "15140.00", currency: "USD", bountyId: 182107 });
    expect(await prizePoolLine(T0)).toBe(LINE);
  });

  it("makes no network call and touches no Redis key when the feature is off", async () => {
    vi.stubEnv("MATCHERINO_BOUNTY_ID", "");
    resetConfigForTests();
    const get = vi.spyOn(store, "get");
    const set = vi.spyOn(store, "set");
    expect(await prizePoolLine(T0)).toBeNull();
    expect(calls).toHaveLength(0);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("is off when the variable is unset", async () => {
    vi.stubEnv("MATCHERINO_BOUNTY_ID", undefined);
    resetConfigForTests();
    expect(await prizePoolLine(T0)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("serves a cache hit without fetching", async () => {
    await prizePoolLine(T0);
    clock += (PRIZE_POOL_FRESH_SEC - 1) * 1000;
    respond = async () => json({ balance: "99999.00" });
    expect(await prizePoolLine(new Date(clock))).toBe(LINE);
    expect(calls).toHaveLength(1);
  });

  it("fetches again once the fresh copy has expired", async () => {
    await prizePoolLine(T0);
    clock += (PRIZE_POOL_FRESH_SEC + 1) * 1000;
    respond = async () => json({ balance: "15200.00" });
    expect(await prizePoolLine(new Date(clock))).toBe(
      "Community prize pool total: $15,200 (updated 14:10)",
    );
    expect(calls).toHaveLength(2);
  });

  it("stores the fresh copy for 300 seconds and the stale copy for 24 hours", async () => {
    await prizePoolLine(T0);
    const record = { balance: "15140.00", fetchedAt: T0.getTime() };
    expect(await store.get(keys.prizePool(BOUNTY))).toEqual(record);
    expect(await store.get(keys.prizePoolStale(BOUNTY))).toEqual(record);
    expect(PRIZE_POOL_FRESH_SEC).toBe(300);
    expect(PRIZE_POOL_STALE_SEC).toBe(24 * 60 * 60);

    clock = T0.getTime() + 301 * 1000;
    expect(await store.get(keys.prizePool(BOUNTY))).toBeNull();
    expect(await store.get(keys.prizePoolStale(BOUNTY))).toEqual(record);

    clock = T0.getTime() + (24 * 60 * 60 + 1) * 1000;
    expect(await store.get(keys.prizePoolStale(BOUNTY))).toBeNull();
  });

  it("falls back to the stale line on a 500, then to null when nothing is cached", async () => {
    await prizePoolLine(T0);
    clock += 10 * 60 * 1000;
    respond = async () => json({ error: "boom" }, 500);
    expect(await prizePoolLine(new Date(clock))).toBe(LINE);
    expect(failures()).toEqual([expect.objectContaining({ level: "warn", status: 500 })]);

    clock += 25 * 60 * 60 * 1000;
    expect(await prizePoolLine(new Date(clock))).toBeNull();
    expect(failures()).toHaveLength(2);
  });

  it("returns null on a 500 with nothing cached", async () => {
    respond = async () => json({}, 500);
    expect(await prizePoolLine(T0)).toBeNull();
    expect(failures()).toEqual([expect.objectContaining({ status: 500 })]);
    expect(await store.get(keys.prizePool(BOUNTY))).toBeNull();
  });

  it("gives up after four seconds and falls back to the stale line", async () => {
    await prizePoolLine(T0);
    clock += 10 * 60 * 1000;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      expect(ms).toBe(PRIZE_POOL_TIMEOUT_MS);
      return AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
    });
    respond = async (init) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      return json({ balance: "1.00" });
    };
    expect(PRIZE_POOL_TIMEOUT_MS).toBe(4000);
    expect(await prizePoolLine(new Date(clock))).toBe(LINE);
    expect(timeout).toHaveBeenCalledWith(4000);
    expect(failures()).toEqual([expect.objectContaining({ error: "TimeoutError" })]);
  });

  it("returns null when the network call itself fails and nothing is cached", async () => {
    respond = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await prizePoolLine(T0)).toBeNull();
    expect(failures()).toEqual([expect.objectContaining({ error: "TypeError" })]);
  });

  it("handles a body that is not JSON", async () => {
    respond = async () => new Response("<html>gateway</html>", { status: 200 });
    expect(await prizePoolLine(T0)).toBeNull();
    expect(failures()).toHaveLength(1);
    expect(await store.get(keys.prizePool(BOUNTY))).toBeNull();
  });

  it.each([
    ["a number instead of a decimal string", { balance: 15140 }],
    ["a string that is not a decimal", { balance: "lots" }],
    ["a negative balance", { balance: "-5.00" }],
    ["a missing balance", { total: "15140.00" }],
    ["an array", []],
    ["null", null],
  ])("rejects %s and caches nothing", async (_label, body) => {
    respond = async () => json(body);
    expect(await prizePoolLine(T0)).toBeNull();
    expect(failures()).toEqual([expect.objectContaining({ error: "BadShape" })]);
    expect(await store.get(keys.prizePool(BOUNTY))).toBeNull();
    expect(await store.get(keys.prizePoolStale(BOUNTY))).toBeNull();
  });

  it("ignores a cached record that does not match the shape and fetches instead", async () => {
    await store.set(keys.prizePool(BOUNTY), { balance: 15140 }, 300);
    expect(await prizePoolLine(T0)).toBe(LINE);
    expect(calls).toHaveLength(1);
    expect(logged.some((l) => l.event === "prizepool.cache_invalid")).toBe(true);
  });

  it("still answers when Redis fails, and never throws", async () => {
    vi.spyOn(store, "get").mockRejectedValue(new Error("redis down"));
    vi.spyOn(store, "set").mockRejectedValue(new Error("redis down"));
    expect(await prizePoolLine(T0)).toBe(LINE);
    expect(logged.filter((l) => l.event === "prizepool.cache_failed")).toHaveLength(2);
  });

  it("never logs the balance or the response body", async () => {
    respond = async () => json({ balance: "not money" }, 200);
    await prizePoolLine(T0);
    respond = async () => json({ balance: "15140.00" }, 502);
    await prizePoolLine(T0);
    expect(JSON.stringify(logged)).not.toContain("15140");
    expect(JSON.stringify(logged)).not.toContain("not money");
  });
});
