import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bracketFor, parseBracketUrl } from "../../src/challonge/challonge.js";
import { resetConfigForTests } from "../../src/config.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { callTool } from "../../src/wizzrobe/mcp.js";
import { FakeChallonge } from "../fakes/challonge.js";
import { FakeKv } from "../fakes/kv.js";

const state = vi.hoisted(() => ({
  tournament: {} as Record<string, unknown>,
}));

vi.mock("../../src/wizzrobe/mcp.js", () => ({
  callTool: vi.fn(async (_token: string, name: string) => {
    if (name === "get_tournament") return state.tournament;
    throw new Error(`unexpected tool ${name}`);
  }),
}));
vi.mock("../../src/wizzrobe/tokens.js", () => ({
  botAccessToken: vi.fn(async () => "bot-token"),
}));

const NOW = new Date("2026-10-16T20:00:00Z");
const SNAP_KEY = keys.cache("challonge", "42");
const COUNT_KEY = keys.cache("challonge", "count-2026-10");
const HOUR = 60 * 60 * 1000;

let fake: FakeChallonge;
let calls: { url: string; headers: Record<string, string> }[];
let kvStore: FakeKv;

function tournament(bracketUrl: string | null): Record<string, unknown> {
  return { id: 42, name: "ALttPR Open", bracket_url: bracketUrl, rules_url: "https://rules.test" };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  kvStore = new FakeKv();
  setKvForTests(kvStore);
  fake = new FakeChallonge();
  calls = [];
  vi.stubGlobal("fetch", (async (input, init) => {
    calls.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return fake.fetch(input, init);
  }) as typeof fetch);
  state.tournament = tournament("https://speedgaming.challonge.com/sgl26alttpr");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setKvForTests(null);
});

describe("parseBracketUrl", () => {
  it("reads a subdomain as the community", () => {
    expect(parseBracketUrl("https://speedgaming.challonge.com/sgl26alttpr")).toEqual({
      url: "sgl26alttpr",
      communityId: "speedgaming",
    });
  });
  it("reads plain challonge.com with no community", () => {
    expect(parseBracketUrl("https://challonge.com/abc123")).toEqual({
      url: "abc123",
      communityId: null,
    });
  });
  it("rejects other hosts and null", () => {
    expect(parseBracketUrl("https://example.com/abc")).toBeNull();
    expect(parseBracketUrl("https://notchallonge.com/abc")).toBeNull();
    expect(parseBracketUrl(null)).toBeNull();
  });
});

describe("bracketFor", () => {
  it("returns link_only without fetching for a non-challonge url or null", async () => {
    state.tournament = tournament("https://example.com/bracket");
    const a = await bracketFor(42);
    expect(a).toMatchObject({
      tournament: "ALttPR Open",
      bracketUrl: "",
      rulesUrl: "https://rules.test",
      source: "link_only",
      fetchedAt: null,
      alive: [],
    });
    state.tournament = tournament(null);
    expect((await bracketFor(42)).source).toBe("link_only");
    expect(calls).toHaveLength(0);
  });

  it("builds the summary from the Challonge fixtures", async () => {
    const s = await bracketFor(42);
    expect(s.source).toBe("challonge");
    expect(s.bracketUrl).toBe("https://speedgaming.challonge.com/sgl26alttpr");
    expect(s.fetchedAt).toBe(NOW.toISOString());
    expect(s.state).toBe("underway");
    expect(s.alive).toEqual([
      "Player One",
      "Player Three",
      "Player Five",
      "Player Seven",
      "Player Eight",
    ]);
    expect(s.eliminated).toEqual(["Player Four", "Player Six", "Player Two"]);
    expect(s.recent).toEqual([
      { round: "Round 1", players: ["Player One", "Player Two"], winner: "Player One" },
      { round: "Round 1", players: ["Player Three", "Player Four"], winner: "Player Three" },
      { round: "Round 1", players: ["Player Five", "Player Six"], winner: "Player Five" },
    ]);
    expect(s.upcoming).toEqual([
      { round: "Round 1", players: ["Player Seven", "Player Eight"] },
      { round: "Round 2", players: ["Player One", "Player Three"] },
      { round: "Round 2", players: ["Player Five", null] },
      { round: "Round 3", players: [null, null] },
    ]);

    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/v2.1/tournaments/sgl26alttpr/participants.json",
      "/v2.1/tournaments/sgl26alttpr/matches.json",
    ]);
    for (const c of calls) {
      expect(new URL(c.url).searchParams.get("community_id")).toBe("speedgaming");
      expect(c.headers).toMatchObject({
        Accept: "application/json",
        "Content-Type": "application/vnd.api+json",
        "Authorization-Type": "v1",
        Authorization: "test-challonge-key",
      });
    }
    expect(await kvStore.get(COUNT_KEY)).toBe(2);
  });

  it("sends no community_id for plain challonge.com", async () => {
    state.tournament = tournament("https://challonge.com/abc123");
    await bracketFor(42);
    expect(new URL(calls[0]?.url ?? "").searchParams.has("community_id")).toBe(false);
  });

  it("parses relationships placed beside attributes", async () => {
    const original = fake.fetch;
    vi.stubGlobal("fetch", (async (input, init) => {
      const res = await original(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/matches.json")) return res;
      const body = (await res.json()) as {
        data: { attributes: { relationships?: unknown }; relationships?: unknown }[];
      };
      for (const m of body.data) {
        m.relationships = m.attributes.relationships;
        m.attributes.relationships = undefined;
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch);
    const s = await bracketFor(42);
    expect(s.recent[0]).toEqual({
      round: "Round 1",
      players: ["Player One", "Player Two"],
      winner: "Player One",
    });
    expect(s.upcoming[2]).toEqual({ round: "Round 2", players: ["Player Five", null] });
  });

  it("serves a snapshot under 60 minutes old without fetching", async () => {
    const first = await bracketFor(42);
    calls.length = 0;
    vi.setSystemTime(new Date(NOW.getTime() + 59 * 60 * 1000));
    expect(await bracketFor(42)).toEqual(first);
    expect(calls).toHaveLength(0);
  });

  it("refreshes a snapshot over 60 minutes old", async () => {
    await bracketFor(42);
    calls.length = 0;
    vi.setSystemTime(new Date(NOW.getTime() + HOUR + 1000));
    const s = await bracketFor(42);
    expect(calls).toHaveLength(2);
    expect(s.fetchedAt).toBe(new Date(NOW.getTime() + HOUR + 1000).toISOString());
  });

  it("never calls list_matches", async () => {
    await bracketFor(42);
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR));
    await bracketFor(42);
    const names = vi.mocked(callTool).mock.calls.map((c) => c[1]);
    expect(names).not.toContain("list_matches");
  });

  it("serves the snapshot in quiet hours (02:00 Eastern)", async () => {
    const first = await bracketFor(42);
    calls.length = 0;
    vi.setSystemTime(new Date("2026-10-17T06:00:00Z"));
    expect(await bracketFor(42)).toEqual(first);
    expect(calls).toHaveLength(0);
  });

  it("fetches in quiet hours when there is no snapshot", async () => {
    vi.setSystemTime(new Date("2026-10-17T06:00:00Z"));
    const s = await bracketFor(42);
    expect(calls).toHaveLength(2);
    expect(s.source).toBe("challonge");
  });

  it("refreshes at 08:30 Eastern once the snapshot is over an hour old", async () => {
    await bracketFor(42);
    calls.length = 0;
    vi.setSystemTime(new Date("2026-10-17T12:30:00Z"));
    await bracketFor(42);
    expect(calls).toHaveLength(2);
  });

  it("sends If-None-Match and keeps the summary on a 304", async () => {
    const original = fake.fetch;
    const seen: (string | undefined)[] = [];
    vi.stubGlobal("fetch", (async (input, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push(headers["If-None-Match"]);
      if (headers["If-None-Match"]) return new Response(null, { status: 304 });
      const res = await original(input, init);
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const tag = url.includes("/participants.json") ? '"p1"' : '"m1"';
      return new Response(await res.text(), { status: 200, headers: { ETag: tag } });
    }) as typeof fetch);
    const first = await bracketFor(42);
    expect(seen).toEqual([undefined, undefined]);
    const later = new Date(NOW.getTime() + HOUR + 1000);
    vi.setSystemTime(later);
    const second = await bracketFor(42);
    expect(seen.slice(2)).toEqual(['"p1"', '"m1"']);
    expect({ ...second, fetchedAt: null }).toEqual({ ...first, fetchedAt: null });
    expect(second.fetchedAt).toBe(later.toISOString());
    expect(await kvStore.get(COUNT_KEY)).toBe(4);
  });

  it("refreshes a snapshot whose fetchedAt is unreadable", async () => {
    await bracketFor(42);
    const snap = await kvStore.get<{ summary: { fetchedAt: string | null } }>(SNAP_KEY);
    if (!snap) throw new Error("snapshot missing");
    snap.summary.fetchedAt = "not a time";
    await kvStore.set(SNAP_KEY, snap);
    calls.length = 0;
    const s = await bracketFor(42);
    expect(calls).toHaveLength(2);
    expect(s.fetchedAt).toBe(NOW.toISOString());
  });

  it("without an API key serves link_only, or the snapshot if there is one", async () => {
    vi.stubEnv("CHALLONGE_API_KEY", "");
    resetConfigForTests();
    expect((await bracketFor(42)).source).toBe("link_only");
    expect(calls).toHaveLength(0);

    vi.unstubAllEnvs();
    resetConfigForTests();
    const first = await bracketFor(42);
    calls.length = 0;
    vi.stubEnv("CHALLONGE_API_KEY", "");
    resetConfigForTests();
    expect(await bracketFor(42)).toEqual(first);
    expect(calls).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it.each([500, 429])("serves the stale snapshot on Challonge %i", async (status) => {
    const first = await bracketFor(42);
    calls.length = 0;
    fake.fail(status);
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    const s = await bracketFor(42);
    expect(calls.length).toBeGreaterThan(0);
    expect(s).toEqual(first);
    expect(s.fetchedAt).toBe(NOW.toISOString());
  });

  it.each([500, 429])("falls back to link_only on %i with no snapshot", async (status) => {
    fake.fail(status);
    const s = await bracketFor(42);
    expect(s.source).toBe("link_only");
    expect(s.fetchedAt).toBeNull();
    expect(s.bracketUrl).toBe("https://speedgaming.challonge.com/sgl26alttpr");
  });

  it("stops fetching at the monthly guard", async () => {
    await kvStore.set(COUNT_KEY, 450);
    const s = await bracketFor(42);
    expect(calls).toHaveLength(0);
    expect(s.source).toBe("link_only");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("challonge.monthly_guard"));
  });
});
