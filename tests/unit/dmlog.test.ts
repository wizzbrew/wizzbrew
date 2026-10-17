import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DM_QUESTION_MAX,
  DM_RESPONSE_MAX,
  DM_RETENTION_SEC,
  dmCount,
  readDmLog,
  recordDm,
} from "../../src/store/dmlog.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { FakeKv } from "../fakes/kv.js";

const DAY = "2026-10-17";
const ANN = "111111111111111111";
const BEN = "222222222222222222";

let now = Date.UTC(2026, 9, 17, 15, 0, 0);
let store: FakeKv;

function dm(over: Partial<Parameters<typeof recordDm>[0]> = {}) {
  return recordDm({
    day: DAY,
    userId: ANN,
    userName: "Ann",
    question: "when is the next match",
    route: "schedule",
    response: "Stage 1 at 8pm.",
    ...over,
  });
}

beforeEach(() => {
  now = Date.UTC(2026, 9, 17, 15, 0, 0);
  store = new FakeKv(() => now);
  setKvForTests(store);
});

afterEach(() => {
  setKvForTests(null);
  vi.restoreAllMocks();
});

describe("keys", () => {
  it("builds the two DM log keys under the wb:v1 prefix", () => {
    expect(keys.dmLog(DAY)).toBe("wb:v1:dmlog:2026-10-17");
    expect(keys.dmCount(DAY)).toBe("wb:v1:dmcount:2026-10-17");
  });

  it("refuses a day that is not YYYY-MM-DD", () => {
    expect(() => keys.dmLog("tomorrow")).toThrow("invalid day");
    expect(() => keys.dmCount("2026-10-17\n")).toThrow("invalid day");
  });
});

describe("recordDm and dmCount", () => {
  it("counts per user per day and starts at zero", async () => {
    expect(await dmCount(DAY, ANN)).toBe(0);
    await dm();
    await dm();
    await dm({ userId: BEN, userName: "Ben" });
    expect(await dmCount(DAY, ANN)).toBe(2);
    expect(await dmCount(DAY, BEN)).toBe(1);
    expect(await dmCount("2026-10-18", ANN)).toBe(0);
  });

  it("writes one JSON line per DM with an ISO timestamp", async () => {
    await dm({ at: new Date(Date.UTC(2026, 9, 17, 14, 32, 5, 123)) });
    const lines = await store.lrange(keys.dmLog(DAY), 0, -1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] as string)).toEqual({
      ts: "2026-10-17T14:32:05.123Z",
      userId: ANN,
      userName: "Ann",
      question: "when is the next match",
      route: "schedule",
      response: "Stage 1 at 8pm.",
    });
  });

  it("clips the question to 300 characters and the response to 500", async () => {
    await dm({ question: "q".repeat(900), response: "r".repeat(900) });
    const [entry] = (await readDmLog(DAY)).entries;
    expect(entry?.question).toHaveLength(DM_QUESTION_MAX);
    expect(entry?.question.endsWith("...")).toBe(true);
    expect(entry?.response).toHaveLength(DM_RESPONSE_MAX);
    expect(entry?.response.endsWith("...")).toBe(true);
  });

  it("keeps text at the limit whole and never splits a surrogate pair", async () => {
    await dm({ question: "a".repeat(DM_QUESTION_MAX), response: `${"b".repeat(496)}\u{1F600}xyz` });
    const [entry] = (await readDmLog(DAY)).entries;
    expect(entry?.question).toBe("a".repeat(DM_QUESTION_MAX));
    expect(entry?.response).toBe(`${"b".repeat(496)}...`);
  });

  it("sets a 14 day expiry on both keys on every write", async () => {
    expect(DM_RETENTION_SEC).toBe(14 * 24 * 60 * 60);
    await dm();
    expect(store.ttlSec(keys.dmLog(DAY))).toBe(DM_RETENTION_SEC);
    expect(store.ttlSec(keys.dmCount(DAY))).toBe(DM_RETENTION_SEC);
    now += 3_600_000;
    await dm();
    expect(store.ttlSec(keys.dmLog(DAY))).toBe(DM_RETENTION_SEC);
    expect(store.ttlSec(keys.dmCount(DAY))).toBe(DM_RETENTION_SEC);
  });

  it("drops both keys once the 14 days pass", async () => {
    await dm();
    now += DM_RETENTION_SEC * 1000;
    expect(store.has(keys.dmLog(DAY))).toBe(false);
    expect(store.has(keys.dmCount(DAY))).toBe(false);
    expect(await dmCount(DAY, ANN)).toBe(0);
  });

  it("makes one call per Redis command: two to record, one to count, two to read", async () => {
    const calls: string[] = [];
    for (const name of ["rpush", "hincrby", "hget", "hgetall", "lrange", "expire"] as const) {
      const original = store[name].bind(store) as (...a: unknown[]) => Promise<unknown>;
      vi.spyOn(store, name).mockImplementation(((...a: unknown[]) => {
        calls.push(name);
        return original(...a);
      }) as never);
    }
    await dm();
    expect(calls).toEqual(["rpush", "hincrby"]);
    calls.length = 0;
    await dmCount(DAY, ANN);
    expect(calls).toEqual(["hget"]);
    calls.length = 0;
    await readDmLog(DAY);
    expect(calls.sort()).toEqual(["hgetall", "lrange"]);
  });

  it("refuses a user id that is not a Discord id", async () => {
    await expect(dm({ userId: "not-an-id" })).rejects.toThrow("invalid discord id");
    await expect(dmCount(DAY, "x")).rejects.toThrow("invalid discord id");
  });
});

describe("readDmLog", () => {
  it("is empty for a day with no DMs", async () => {
    expect(await readDmLog(DAY)).toEqual({ day: DAY, total: 0, users: [], entries: [] });
  });

  it("returns counts by user, highest first, with the latest known name", async () => {
    await dm({ userName: "Ann" });
    await dm({ userId: BEN, userName: "Ben" });
    await dm({ userName: "Annie" });
    await dm({ userName: "Annie" });
    const view = await readDmLog(DAY);
    expect(view.total).toBe(4);
    expect(view.users).toEqual([
      { userId: ANN, userName: "Annie", count: 3 },
      { userId: BEN, userName: "Ben", count: 1 },
    ]);
  });

  it("breaks a tie by id", async () => {
    await dm({ userId: BEN, userName: "Ben" });
    await dm();
    expect((await readDmLog(DAY)).users.map((u) => u.userId)).toEqual([ANN, BEN]);
  });

  it("returns the last 20 entries, oldest first", async () => {
    for (let n = 1; n <= 25; n++) await dm({ question: `q${n}` });
    const view = await readDmLog(DAY);
    expect(view.total).toBe(25);
    expect(view.entries).toHaveLength(20);
    expect(view.entries[0]?.question).toBe("q6");
    expect(view.entries[19]?.question).toBe("q25");
  });

  it("gives a null name to a counted user with no entry in the window", async () => {
    await store.hincrby(keys.dmCount(DAY), BEN, 2);
    const view = await readDmLog(DAY);
    expect(view.users).toEqual([{ userId: BEN, userName: null, count: 2 }]);
  });

  it("reads lines that arrive already parsed, as Upstash returns them", async () => {
    const entry = {
      ts: "2026-10-17T14:00:00.000Z",
      userId: ANN,
      userName: "Ann",
      question: "q",
      route: "chat",
      response: "a",
    };
    await store.rpush(keys.dmLog(DAY), entry as unknown as string);
    expect((await readDmLog(DAY)).entries).toEqual([entry]);
  });

  it("skips a line it cannot read and warns, without failing the read", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await dm();
    await store.rpush(keys.dmLog(DAY), "{not json");
    await store.rpush(keys.dmLog(DAY), JSON.stringify({ ts: "yesterday" }));
    const view = await readDmLog(DAY);
    expect(view.entries).toHaveLength(1);
    const logged = out.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("dmlog.skipped_lines");
    expect(logged).not.toContain("not json");
  });

  it("throws on a count that is not a number", async () => {
    vi.spyOn(store, "hgetall").mockResolvedValue({ [ANN]: "many" });
    await expect(readDmLog(DAY)).rejects.toThrow();
  });
});
