import type { BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceededError } from "../../src/errors.js";
import { assertUnderBudget, recordSpend } from "../../src/llm/budget.js";
import { type Kv, setKvForTests } from "../../src/store/kv.js";

vi.mock("../../src/config.js", () => ({
  config: () => ({ anthropicDailyBudgetUsd: 25 }),
}));
vi.mock("../../src/time/time.js", () => ({
  communityDate: () => "2026-10-15",
}));
vi.mock("../../src/store/keys.js", () => ({
  keys: { spend: (day: string) => `spend:${day}` },
}));

const NOW = new Date("2026-10-15T12:00:00Z");
const SPEND_KEY = "spend:2026-10-15";

// Map-backed Kv. Values are stored as strings, the way Redis returns them.
let store: Map<string, string>;
const incrByFloat = vi.fn<Kv["incrByFloat"]>(async (key, by) => {
  const next = Number(store.get(key) ?? 0) + by;
  store.set(key, String(next));
  return next;
});

function makeKv(): Kv {
  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) ?? null) as T | null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, String(value));
    },
    async del(key: string): Promise<void> {
      store.delete(key);
    },
    incrByFloat,
    async expire(): Promise<void> {
      // TTLs are not enforced by the test Kv.
    },
  };
}

function usage(u: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): BetaUsage {
  return u as BetaUsage;
}

beforeEach(() => {
  store = new Map();
  incrByFloat.mockClear();
  setKvForTests(makeKv());
});

afterEach(() => {
  setKvForTests(null);
});

describe("recordSpend", () => {
  it("prices Sonnet 1000 in and 500 out at 0.007 USD", async () => {
    const usd = await recordSpend(
      "claude-sonnet-5-5",
      usage({ input_tokens: 1000, output_tokens: 500 }),
      NOW,
    );
    expect(usd).toBeCloseTo(0.007, 12);
  });

  it("prices Haiku 2000 cache-read and 1000 cache-write tokens exactly", async () => {
    const usd = await recordSpend(
      "claude-haiku-5-5",
      usage({
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 2000,
        cache_creation_input_tokens: 1000,
      }),
      NOW,
    );
    // 2000 * 0.01 + 1000 * 0.125 = 145 per million tokens
    expect(usd).toBeCloseTo(0.000145, 12);
  });

  it("treats null cache counts as zero", async () => {
    const usd = await recordSpend(
      "claude-sonnet-5-5",
      usage({
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: null,
        cache_creation_input_tokens: null,
      }),
      NOW,
    );
    expect(usd).toBeCloseTo(0.007, 12);
  });

  it("increments the community-day spend key with a 48 h TTL", async () => {
    const usd = await recordSpend(
      "claude-sonnet-5-5",
      usage({ input_tokens: 1000, output_tokens: 500 }),
      NOW,
    );
    expect(incrByFloat).toHaveBeenCalledWith(SPEND_KEY, usd, 172800);
  });

  it("throws for a model with no pricing and records nothing", async () => {
    await expect(
      recordSpend("claude-opus-9", usage({ input_tokens: 1, output_tokens: 1 }), NOW),
    ).rejects.toThrow("no pricing for claude-opus-9");
    expect(incrByFloat).not.toHaveBeenCalled();
  });
});

describe("assertUnderBudget", () => {
  it("resolves when spend is under the budget", async () => {
    store.set(SPEND_KEY, "24.99");
    await expect(assertUnderBudget(NOW)).resolves.toBeUndefined();
  });

  it("throws BudgetExceededError when spend is exactly the budget", async () => {
    store.set(SPEND_KEY, "25");
    await expect(assertUnderBudget(NOW)).rejects.toThrow(BudgetExceededError);
  });

  it("throws BudgetExceededError when spend is over the budget", async () => {
    store.set(SPEND_KEY, "30.5");
    await expect(assertUnderBudget(NOW)).rejects.toThrow(BudgetExceededError);
  });

  it("treats a missing counter as zero", async () => {
    await expect(assertUnderBudget(NOW)).resolves.toBeUndefined();
  });
});
