import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "../../src/config.js";
import { type Kv, kv, setKvForTests } from "../../src/store/kv.js";

// The Upstash client is the external boundary. The fake records each call and returns the
// configured result, or rejects with the configured error.
const fake = vi.hoisted(() => {
  const state = {
    ctorOptions: [] as unknown[],
    calls: [] as { method: string; args: unknown[] }[],
    result: undefined as unknown,
    failWith: null as Error | null,
  };
  const record = (method: string, args: unknown[]): Promise<unknown> => {
    state.calls.push({ method, args });
    if (state.failWith !== null) return Promise.reject(state.failWith);
    return Promise.resolve(state.result);
  };
  class FakeRedis {
    constructor(options: unknown) {
      state.ctorOptions.push(options);
    }
    get(...args: unknown[]) {
      return record("get", args);
    }
    set(...args: unknown[]) {
      return record("set", args);
    }
    del(...args: unknown[]) {
      return record("del", args);
    }
    incrbyfloat(...args: unknown[]) {
      return record("incrbyfloat", args);
    }
    expire(...args: unknown[]) {
      return record("expire", args);
    }
  }
  return { state, FakeRedis };
});

vi.mock("@upstash/redis", () => ({ Redis: fake.FakeRedis }));

const KEY = Buffer.alloc(32, 1).toString("base64");

// config() validates every variable, so each test sets the full valid set.
function stubConfigEnv(): void {
  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: "test-anthropic-key",
    ANTHROPIC_DAILY_BUDGET_USD: "1",
    DISCORD_APPLICATION_ID: "123456789012345678",
    DISCORD_PUBLIC_KEY: "00".repeat(32),
    DISCORD_BOT_TOKEN: "test-bot-token",
    WIZZROBE_BASE_URL: "https://wizzrobe.example.test",
    WIZZROBE_MCP_URL: "https://wizzrobe.example.test/mcp",
    WIZZROBE_TENANT: "sgl26",
    WIZZROBE_OAUTH_CLIENT_ID: "test-client-id",
    WIZZROBE_OAUTH_CLIENT_SECRET: "test-client-secret",
    WIZZROBE_OAUTH_REDIRECT_URI: "https://wizzbrew.example.test/api/oauth/callback",
    WIZZROBE_BOT_REFRESH_TOKEN: "test-refresh-token",
    TOKEN_ENCRYPTION_KEY: KEY,
    KV_REST_API_URL: "https://kv.example.test",
    KV_REST_API_TOKEN: "test-kv-token",
    COMMUNITY_TIMEZONE: "America/New_York",
  };
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  resetConfigForTests();
}

describe("kv", () => {
  beforeEach(() => {
    stubConfigEnv();
    setKvForTests(null);
    fake.state.ctorOptions = [];
    fake.state.calls = [];
    fake.state.result = undefined;
    fake.state.failWith = null;
  });

  afterEach(() => {
    setKvForTests(null);
    vi.unstubAllEnvs();
    resetConfigForTests();
  });

  it("builds one Upstash client from config on first use", () => {
    kv();
    kv();
    expect(fake.state.ctorOptions).toStrictEqual([
      { url: "https://kv.example.test", token: "test-kv-token" },
    ]);
  });

  it("get returns the decoded value", async () => {
    fake.state.result = { a: 1 };
    await expect(kv().get<{ a: number }>("k")).resolves.toStrictEqual({ a: 1 });
    expect(fake.state.calls).toStrictEqual([{ method: "get", args: ["k"] }]);
  });

  it("get returns null when Upstash has no value", async () => {
    fake.state.result = null;
    await expect(kv().get("missing")).resolves.toBeNull();
  });

  it("set passes the ex option only when a TTL is given", async () => {
    await kv().set("k", { a: 1 }, 60);
    await kv().set("k2", "v");
    expect(fake.state.calls).toStrictEqual([
      { method: "set", args: ["k", { a: 1 }, { ex: 60 }] },
      { method: "set", args: ["k2", "v"] },
    ]);
  });

  it("del calls Upstash del with the key", async () => {
    await kv().del("k");
    expect(fake.state.calls).toStrictEqual([{ method: "del", args: ["k"] }]);
  });

  it("incrByFloat sets the TTL only when given and returns a number", async () => {
    fake.state.result = "7.25";
    const value = await kv().incrByFloat("k", 1.5, 300);
    expect(value).toBe(7.25);
    expect(fake.state.calls).toStrictEqual([
      { method: "incrbyfloat", args: ["k", 1.5] },
      { method: "expire", args: ["k", 300] },
    ]);
  });

  it("incrByFloat without a TTL does not call expire", async () => {
    fake.state.result = "2";
    const value = await kv().incrByFloat("k", 1);
    expect(value).toBe(2);
    expect(fake.state.calls).toStrictEqual([{ method: "incrbyfloat", args: ["k", 1] }]);
  });

  it("expire calls Upstash expire with the TTL", async () => {
    await kv().expire("k", 90);
    expect(fake.state.calls).toStrictEqual([{ method: "expire", args: ["k", 90] }]);
  });

  it("propagates an Upstash rejection unchanged", async () => {
    const failure = new Error("upstash unavailable");
    fake.state.failWith = failure;
    await expect(kv().get("k")).rejects.toBe(failure);
    await expect(kv().incrByFloat("k", 1, 60)).rejects.toBe(failure);
  });

  it("setKvForTests swaps the singleton and null resets it", () => {
    const custom: Kv = {
      get: async () => null,
      set: async () => undefined,
      del: async () => undefined,
      incrByFloat: async () => 0,
      expire: async () => undefined,
    };
    setKvForTests(custom);
    expect(kv()).toBe(custom);
    expect(fake.state.ctorOptions).toHaveLength(0);

    setKvForTests(null);
    expect(kv()).not.toBe(custom);
    expect(fake.state.ctorOptions).toHaveLength(1);
  });
});
