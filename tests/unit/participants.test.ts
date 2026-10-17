import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import {
  eventParticipants,
  findParticipants,
  PARTICIPANTS_FRESH_SEC,
  PARTICIPANTS_STALE_SEC,
  PARTICIPANTS_TIMEOUT_MS,
  type Participant,
} from "../../src/event/participants.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { FakeKv } from "../fakes/kv.js";

const BOUNTY = "182107";
const pageUrl = (n: number): string =>
  `https://api.matcherino.com/__api/bounties/participants?bountyId=${BOUNTY}&page=${n}&pageSize=500`;
const T0 = Date.parse("2026-10-17T18:05:00Z");

let clock: number;
let store: FakeKv;
let calls: { url: string; init: RequestInit | undefined }[];
let respond: (url: string, init: RequestInit | undefined) => Promise<Response>;
let logged: Record<string, unknown>[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// A Matcherino entry with the fields the bot must never keep.
function entry(displayName: string, addedAt = "2026-09-01T12:00:00.000Z"): Record<string, unknown> {
  return {
    displayName,
    addedAt,
    userId: 4242,
    authId: "123456789012345678",
    avatar: "https://cdn.discordapp.com/avatars/123456789012345678/abc.png",
  };
}

function pageOf(itemCount: number, contents: unknown[]): Response {
  return json({ body: { itemCount, pageCount: Math.ceil(itemCount / 500), contents } });
}

function failures(): Record<string, unknown>[] {
  return logged.filter((l) => l.event === "participants.fetch_failed");
}

function sizedPage(url: string, total: number): Response {
  const page = Number(new URL(url).searchParams.get("page"));
  const start = page * 500;
  const count = Math.max(0, Math.min(500, total - start));
  return pageOf(
    total,
    Array.from({ length: count }, (_, i) => entry(`player ${start + i}`)),
  );
}

beforeEach(() => {
  clock = T0;
  store = new FakeKv(() => clock);
  setKvForTests(store);
  calls = [];
  respond = async () => pageOf(2, [entry("PixelFox"), entry("Nimbus")]);
  logged = [];
  vi.stubEnv("MATCHERINO_BOUNTY_ID", BOUNTY);
  resetConfigForTests();
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  vi.stubGlobal("fetch", (async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    return respond(url, init);
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

describe("eventParticipants", () => {
  it("reads page 0 with the page size and a timeout, keeping only name and join time", async () => {
    const list = await eventParticipants();
    expect(list).toEqual({
      names: [
        { displayName: "PixelFox", addedAt: "2026-09-01T12:00:00.000Z" },
        { displayName: "Nimbus", addedAt: "2026-09-01T12:00:00.000Z" },
      ],
      count: 2,
      fetchedAt: T0,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(pageUrl(0));
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(PARTICIPANTS_TIMEOUT_MS).toBe(5000);
    expect(failures()).toEqual([]);
  });

  it("never caches or returns authId, userId or avatar", async () => {
    const list = await eventParticipants();
    for (const text of [
      JSON.stringify(list),
      JSON.stringify(await store.get(keys.participants(BOUNTY))),
      JSON.stringify(await store.get(keys.participantsStale(BOUNTY))),
    ]) {
      expect(text).toContain("PixelFox");
      for (const secret of ["authId", "userId", "avatar", "123456789012345678", "4242"]) {
        expect(text, secret).not.toContain(secret);
      }
    }
    expect(JSON.stringify(logged)).not.toContain("123456789012345678");
  });

  it("caches fresh for 1200 seconds and keeps a stale copy for a day", async () => {
    expect(PARTICIPANTS_FRESH_SEC).toBe(1200);
    expect(PARTICIPANTS_STALE_SEC).toBe(86_400);
    await eventParticipants();
    clock = T0 + 1199_000;
    expect(await store.get(keys.participants(BOUNTY))).not.toBeNull();
    clock = T0 + 1200_000;
    expect(await store.get(keys.participants(BOUNTY))).toBeNull();
    expect(await store.get(keys.participantsStale(BOUNTY))).not.toBeNull();
    clock = T0 + 86_399_000;
    expect(await store.get(keys.participantsStale(BOUNTY))).not.toBeNull();
    clock = T0 + 86_400_000;
    expect(await store.get(keys.participantsStale(BOUNTY))).toBeNull();
  });

  it("serves a fresh cache hit without a fetch", async () => {
    const first = await eventParticipants();
    expect(calls).toHaveLength(1);
    clock = T0 + 600_000;
    const second = await eventParticipants();
    expect(calls).toHaveLength(1);
    expect(second).toEqual(first);
  });

  it("fetches again once the fresh copy has expired", async () => {
    await eventParticipants();
    clock = T0 + 1200_000;
    await eventParticipants();
    expect(calls).toHaveLength(2);
  });

  it("fetches further pages when the count is over 500, up to three more", async () => {
    respond = async (url) => sizedPage(url, 1200);
    const list = await eventParticipants();
    expect(calls.map((c) => c.url)).toEqual([pageUrl(0), pageUrl(1), pageUrl(2)]);
    expect(list?.names).toHaveLength(1200);
    expect(list?.count).toBe(1200);
    expect(list?.names[1199]?.displayName).toBe("player 1199");
  });

  it("stops at three extra pages and reports the full count", async () => {
    respond = async (url) => sizedPage(url, 5000);
    const list = await eventParticipants();
    expect(calls).toHaveLength(4);
    expect(list?.names).toHaveLength(2000);
    expect(list?.count).toBe(5000);
  });

  it("makes one request when the list fits one page", async () => {
    respond = async (url) => sizedPage(url, 500);
    await eventParticipants();
    expect(calls).toHaveLength(1);
  });

  it("returns null and makes no request when MATCHERINO_BOUNTY_ID is unset", async () => {
    vi.stubEnv("MATCHERINO_BOUNTY_ID", "");
    resetConfigForTests();
    expect(await eventParticipants()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("falls back to the stale copy when a fetch fails, logging only the status", async () => {
    const first = await eventParticipants();
    clock = T0 + 1200_000;
    respond = async () => json({ error: "boom" }, 503);
    expect(await eventParticipants()).toEqual(first);
    expect(failures()).toEqual([expect.objectContaining({ status: 503 })]);
  });

  it("returns null when a fetch fails and there is no stale copy", async () => {
    respond = async () => {
      throw new DOMException("timed out", "TimeoutError");
    };
    expect(await eventParticipants()).toBeNull();
    expect(failures()).toEqual([expect.objectContaining({ error: "TimeoutError" })]);
  });

  it("treats a later page failing as a failed fetch, never a partial list", async () => {
    respond = async (url) =>
      new URL(url).searchParams.get("page") === "1"
        ? json({ error: "boom" }, 500)
        : sizedPage(url, 800);
    expect(await eventParticipants()).toBeNull();
    expect(await store.get(keys.participants(BOUNTY))).toBeNull();
  });

  it("treats an unexpected body shape as a failed fetch", async () => {
    respond = async () => json({ body: { contents: "nope" } });
    expect(await eventParticipants()).toBeNull();
    expect(failures()).toEqual([expect.objectContaining({ error: "BadShape" })]);
  });

  it("skips entries without a usable name and counts them in the log", async () => {
    respond = async () =>
      pageOf(4, [
        entry("PixelFox"),
        { displayName: null, addedAt: "x" },
        entry("   "),
        entry("Nimbus"),
      ]);
    const list = await eventParticipants();
    expect(list?.names.map((n) => n.displayName)).toEqual(["PixelFox", "Nimbus"]);
    expect(list?.count).toBe(4);
    expect(logged).toContainEqual(
      expect.objectContaining({ event: "participants.entries_skipped", count: 2 }),
    );
  });

  it("ignores a cached record with the wrong shape and fetches", async () => {
    await store.set(keys.participants(BOUNTY), { names: "x" }, 600);
    const list = await eventParticipants();
    expect(list?.count).toBe(2);
    expect(calls).toHaveLength(1);
  });
});

describe("findParticipants", () => {
  const list: Participant[] = [
    "Fox Mulder",
    "fox",
    "FOX",
    "The Fox",
    "foxglove",
    "Pixel_Fox_99",
    "Nimbus",
  ].map((displayName, i) => ({ displayName, addedAt: `2026-09-0${i + 1}T00:00:00.000Z` }));

  it("lists exact case-insensitive matches before whole-word matches", () => {
    expect(findParticipants(list, "Fox").map((p) => p.displayName)).toEqual([
      "fox",
      "FOX",
      "Fox Mulder",
      "The Fox",
      "Pixel_Fox_99",
    ]);
  });

  it("never matches inside a word", () => {
    const names = findParticipants(list, "fo").map((p) => p.displayName);
    expect(names).toEqual([]);
    expect(findParticipants(list, "mulde")).toEqual([]);
  });

  it("matches a multi-word name as a run of whole words", () => {
    expect(findParticipants(list, "fox mulder").map((p) => p.displayName)).toEqual(["Fox Mulder"]);
    expect(findParticipants(list, "mulder fox")).toEqual([]);
  });

  it("returns at most five", () => {
    const many: Participant[] = Array.from({ length: 12 }, (_, i) => ({
      displayName: i < 3 ? "ana" : `ana ${i}`,
      addedAt: "2026-09-01T00:00:00.000Z",
    }));
    const found = findParticipants(many, "ana");
    expect(found).toHaveLength(5);
    expect(found.slice(0, 3).map((p) => p.displayName)).toEqual(["ana", "ana", "ana"]);
  });

  it("returns the name and join time only", () => {
    expect(findParticipants(list, "nimbus")).toEqual([
      { displayName: "Nimbus", addedAt: "2026-09-07T00:00:00.000Z" },
    ]);
  });

  it("returns nothing for a blank or punctuation-only name", () => {
    expect(findParticipants(list, "")).toEqual([]);
    expect(findParticipants(list, "   ")).toEqual([]);
    expect(findParticipants(list, "!!!")).toEqual([]);
  });
});
