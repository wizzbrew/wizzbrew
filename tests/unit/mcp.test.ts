import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WizzrobeError } from "../../src/errors.js";
import { setKvForTests } from "../../src/store/kv.js";
import {
  callTool,
  connectorParams,
  type RawToolCall,
  setRawToolCallForTests,
} from "../../src/wizzrobe/mcp.js";
import { FakeKv } from "../fakes/kv.js";
import { FakeWizzrobe } from "../fakes/wizzrobe.js";

let fake: FakeWizzrobe;

beforeEach(() => {
  fake = new FakeWizzrobe();
  setRawToolCallForTests(fake.rawToolCall);
  setKvForTests(new FakeKv());
});

afterEach(() => {
  vi.useRealTimers();
  setRawToolCallForTests(null);
  setKvForTests(null);
});

describe("connectorParams", () => {
  it("enables only the named read tools, default off, with the beta", () => {
    expect(connectorParams("tok-1", ["get_schedule", "list_matches"])).toEqual({
      mcp_servers: [
        {
          type: "url",
          url: "https://wizzrobe.test/mcp",
          name: "wizzrobe",
          authorization_token: "tok-1",
        },
      ],
      tools: [
        {
          type: "mcp_toolset",
          mcp_server_name: "wizzrobe",
          default_config: { enabled: false },
          configs: {
            get_schedule: { enabled: true },
            list_matches: { enabled: true },
          },
        },
      ],
      betas: ["mcp-client-2025-11-20"],
    });
  });

  it("returns empty servers and tools for an empty list, and still the beta", () => {
    expect(connectorParams("tok-1", [])).toEqual({
      mcp_servers: [],
      tools: [],
      betas: ["mcp-client-2025-11-20"],
    });
  });
});

describe("callTool tenant", () => {
  it("injects the configured tenant, overriding the caller's", async () => {
    await callTool("tok-1", "get_match", { match_id: 1, tenant: "someone-else" });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.args).toEqual({ match_id: 1, tenant: "sgl26" });
  });

  it("does not add a tenant to whoami or list_tenants", async () => {
    await callTool("tok-1", "whoami", {});
    expect(fake.calls[0]?.args).toEqual({});
    fake.answer("list_tenants", { result: [] });
    await callTool("tok-1", "list_tenants", {});
    expect(fake.calls[1]?.args).toEqual({});
  });
});

describe("callTool errors", () => {
  it.each([
    ["not_found", 404],
    ["forbidden", 403],
    ["unauthorized", 401],
    ["invalid_request", 400],
    ["internal_error", 500],
  ])("maps the %s code to status %i with the message as detail", async (code, status) => {
    fake.failTool("signup_as_crew", code, `the ${code} detail`);
    const err = await callTool("tok-1", "signup_as_crew", { match_id: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(WizzrobeError);
    expect(err).toMatchObject({ status, detail: `the ${code} detail` });
  });

  it("maps text with no code to 500 and keeps the whole text", async () => {
    setRawToolCallForTests(async () => ({ isError: true, text: "it broke, no code here" }));
    const err = await callTool("tok-1", "signup_as_crew", {}).catch((e) => e);
    expect(err).toBeInstanceOf(WizzrobeError);
    expect(err).toMatchObject({ status: 500, detail: "it broke, no code here" });
  });

  it("maps a feature that is off to 404 with 'not enabled' in the detail", async () => {
    const err = await callTool("tok-1", "list_brackets", {}).catch((e) => e);
    expect(err).toBeInstanceOf(WizzrobeError);
    expect((err as WizzrobeError).status).toBe(404);
    expect((err as WizzrobeError).detail).toContain("not enabled");
  });

  it("turns a success reply that is not JSON into a 502", async () => {
    setRawToolCallForTests(async () => ({ isError: false, text: "<html>oops</html>" }));
    const err = await callTool("tok-1", "get_match", { match_id: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(WizzrobeError);
    expect(err).toMatchObject({ status: 502, detail: "Wizzrobe sent a reply that isn't JSON" });
  });
});

describe("callTool read cache", () => {
  it("returns the parsed fixture and serves an identical second call from cache", async () => {
    const first = await callTool("tok-1", "get_match", { match_id: 1 });
    expect(first).toMatchObject({ id: 1, tournament: { id: 9 } });
    const second = await callTool("tok-1", "get_match", { match_id: 1 });
    expect(second).toEqual(first);
    expect(fake.calls).toHaveLength(1);
  });

  it("treats argument key order as the same call", async () => {
    await callTool("tok-1", "list_matches", { limit: 5, status: "open" });
    await callTool("tok-1", "list_matches", { status: "open", limit: 5 });
    expect(fake.calls).toHaveLength(1);
  });

  it("keeps a different token in a different cache entry", async () => {
    await callTool("tok-1", "get_match", { match_id: 1 });
    await callTool("tok-2", "get_match", { match_id: 1 });
    expect(fake.calls.map((c) => c.token)).toEqual(["tok-1", "tok-2"]);
  });

  it("keeps different arguments in different cache entries", async () => {
    await callTool("tok-1", "get_match", { match_id: 1 });
    await callTool("tok-1", "get_match", { match_id: 2 });
    expect(fake.calls).toHaveLength(2);
  });

  it("never caches a write", async () => {
    await callTool("tok-1", "signup_as_crew", { match_id: 1 });
    await callTool("tok-1", "signup_as_crew", { match_id: 1 });
    expect(fake.calls).toHaveLength(2);
  });

  it("never caches whoami", async () => {
    await callTool("tok-1", "whoami", {});
    await callTool("tok-1", "whoami", {});
    expect(fake.calls).toHaveLength(2);
  });

  it("does not cache a failure", async () => {
    fake.failTool("get_match", "not_found", "gone");
    await callTool("tok-1", "get_match", { match_id: 1 }).catch(() => undefined);
    await callTool("tok-1", "get_match", { match_id: 1 }).catch(() => undefined);
    expect(fake.calls).toHaveLength(2);
  });
});

describe("callTool token rate cap", () => {
  it("rejects the 101st uncached call in a minute without calling Wizzrobe", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:10Z"));
    for (let i = 0; i < 100; i++) await callTool("tok-1", "whoami", {});
    expect(fake.calls).toHaveLength(100);
    const err = await callTool("tok-1", "whoami", {}).catch((e) => e);
    expect(err).toBeInstanceOf(WizzrobeError);
    expect(err).toMatchObject({ status: 429, retryAfterSec: 30 });
    expect(fake.calls).toHaveLength(100);
    // another token and the next minute are unaffected
    await callTool("tok-2", "whoami", {});
    vi.setSystemTime(new Date("2026-10-15T12:01:10Z"));
    await callTool("tok-1", "whoami", {});
    expect(fake.calls).toHaveLength(102);
  });

  it("does not count cached reads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:10Z"));
    await callTool("tok-1", "get_match", { match_id: 1 });
    for (let i = 0; i < 150; i++) await callTool("tok-1", "get_match", { match_id: 1 });
    expect(fake.calls).toHaveLength(1);
  });
});

describe("callTool 429 retry", () => {
  // Fails the first `failures` calls with a rate error, then answers like the fake.
  function rateLimited(failures: number, retryAfterSec?: number): RawToolCall {
    let seen = 0;
    return async (token, name, args) => {
      seen += 1;
      if (seen <= failures) {
        if (retryAfterSec !== undefined) throw new WizzrobeError(429, "slow down", retryAfterSec);
        return { isError: true, text: "rate_limited: slow down" };
      }
      return fake.rawToolCall(token, name, args);
    };
  }

  it("retries once after a 429 and returns the success", async () => {
    vi.useFakeTimers();
    setRawToolCallForTests(rateLimited(1));
    const pending = callTool("tok-1", "get_match", { match_id: 1 });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toMatchObject({ id: 1 });
    expect(fake.calls).toHaveLength(1);
  });

  it("propagates a second 429", async () => {
    vi.useFakeTimers();
    setRawToolCallForTests(rateLimited(2));
    const outcome = callTool("tok-1", "get_match", { match_id: 1 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await outcome;
    expect(err).toBeInstanceOf(WizzrobeError);
    expect(err).toMatchObject({ status: 429, detail: "slow down" });
    expect(fake.calls).toHaveLength(0);
  });

  it("waits for a transport Retry-After before the retry", async () => {
    vi.useFakeTimers();
    setRawToolCallForTests(rateLimited(1, 3));
    const pending = callTool("tok-1", "get_match", { match_id: 1 });
    await vi.advanceTimersByTimeAsync(2999);
    expect(fake.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ id: 1 });
    expect(fake.calls).toHaveLength(1);
  });

  it("caps the wait at 10 seconds", async () => {
    vi.useFakeTimers();
    setRawToolCallForTests(rateLimited(1, 120));
    const pending = callTool("tok-1", "get_match", { match_id: 1 });
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ id: 1 });
  });

  it("does not retry a transport failure that is not a 429", async () => {
    let calls = 0;
    setRawToolCallForTests(async () => {
      calls += 1;
      throw new WizzrobeError(503, "could not reach Wizzrobe");
    });
    const err = await callTool("tok-1", "get_match", { match_id: 1 }).catch((e) => e);
    expect(err).toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });
});
