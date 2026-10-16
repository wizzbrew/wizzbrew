import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceededError, ModelOutputError } from "../../src/errors.js";
import { createMessage, setAnthropicForTests, textOf } from "../../src/llm/client.js";
import { MODELS, PRICING } from "../../src/llm/models.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import { communityDate } from "../../src/time/time.js";
import { block, FakeAnthropic, fakeMessage } from "../fakes/anthropic.js";
import { FakeKv } from "../fakes/kv.js";

const sdk = vi.hoisted(() => ({ ctor: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: function FakeSdk(this: { beta: unknown }, opts: unknown) {
    sdk.ctor(opts);
    this.beta = {
      messages: {
        create: async () => ({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    };
  },
}));

const NOW = new Date("2026-10-15T16:00:00Z");
const CTX = { requestId: "req-abc-123", now: NOW };
const BASE = {
  max_tokens: 1000,
  messages: [{ role: "user" as const, content: "a secret question about the schedule" }],
};

let fake: FakeAnthropic;
let kv: FakeKv;
let logSpy: ReturnType<typeof vi.spyOn>;

function spendKey(): string {
  return keys.spend(communityDate(NOW));
}

function sentParams(i = 0): Record<string, unknown> {
  return fake.requests[i] as Record<string, unknown>;
}

beforeEach(() => {
  fake = new FakeAnthropic();
  kv = new FakeKv();
  setAnthropicForTests(fake);
  setKvForTests(kv);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  setAnthropicForTests(null);
  setKvForTests(null);
  vi.restoreAllMocks();
});

describe("textOf", () => {
  it("skips a leading thinking block and returns the text (L9)", () => {
    const msg = fakeMessage([block.thinking("hmm"), block.text("  The answer.  ")]);
    expect(textOf(msg)).toBe("The answer.");
  });

  it("joins text blocks around a tool_use in order", () => {
    const msg = fakeMessage([
      block.text("Before. "),
      block.toolUse("lookup", { q: 1 }),
      block.text("After."),
    ]);
    expect(textOf(msg)).toBe("Before. After.");
  });

  it("returns an empty string when there is no text block", () => {
    expect(textOf(fakeMessage([block.thinking("only thoughts")]))).toBe("");
    expect(textOf(fakeMessage([block.toolUse("lookup", {})]))).toBe("");
    expect(textOf(fakeMessage([]))).toBe("");
  });
});

describe("createMessage request", () => {
  it("raises max_tokens below 4000 to 4000 and leaves larger values alone", async () => {
    fake.queue(fakeMessage([block.text("a")]), fakeMessage([block.text("b")]));
    await createMessage("responder", { ...BASE, max_tokens: 1000 }, CTX);
    await createMessage("responder", { ...BASE, max_tokens: 8000 }, CTX);
    expect(sentParams(0).max_tokens).toBe(4000);
    expect(sentParams(1).max_tokens).toBe(8000);
  });

  it("uses the model from MODELS for each purpose", async () => {
    const purposes = Object.keys(MODELS) as Array<keyof typeof MODELS>;
    for (const purpose of purposes) {
      fake.queue(fakeMessage([block.text("ok")], { model: MODELS[purpose] }));
    }
    for (const purpose of purposes) {
      await createMessage(purpose, BASE, CTX);
    }
    purposes.forEach((purpose, i) => {
      expect(sentParams(i).model).toBe(MODELS[purpose]);
    });
  });

  it("passes betas, system and output_config through unchanged", async () => {
    fake.queue(fakeMessage([block.text("ok")]));
    const system = [
      {
        type: "text" as const,
        text: "stable prompt",
        cache_control: { type: "ephemeral" as const },
      },
    ];
    const output_config = { effort: "low" as const };
    const betas = ["mcp-client-2025-11-20"];
    await createMessage("router", { ...BASE, system, output_config, betas }, CTX);
    const sent = sentParams();
    expect(sent.system).toEqual(system);
    expect(sent.output_config).toEqual(output_config);
    expect(sent.betas).toEqual(betas);
    expect(sent.messages).toEqual(BASE.messages);
  });
});

describe("createMessage spend and stops", () => {
  const usage = {
    input_tokens: 1200,
    output_tokens: 300,
    cache_read_input_tokens: 5000,
    cache_creation_input_tokens: 400,
  };

  function expectedUsd(model: string): number {
    const p = PRICING[model];
    if (p === undefined) throw new Error("no pricing");
    return (
      (usage.input_tokens * p.inPerM +
        usage.output_tokens * p.outPerM +
        usage.cache_read_input_tokens * p.cacheReadPerM +
        usage.cache_creation_input_tokens * p.cacheWritePerM) /
      1e6
    );
  }

  it("records the exact USD for the fake's usage and answering model", async () => {
    fake.queue(fakeMessage([block.text("ok")], { model: "claude-haiku-5-5", usage }));
    const msg = await createMessage("router", BASE, CTX);
    expect(textOf(msg)).toBe("ok");
    const spent = Number(await kv.get(spendKey()));
    expect(spent).toBeCloseTo(expectedUsd("claude-haiku-5-5"), 12);
    expect(spent).toBeGreaterThan(0);
  });

  it("adds to the day's spend across calls", async () => {
    fake.queue(
      fakeMessage([block.text("a")], { usage }),
      fakeMessage([block.text("b")], { usage }),
    );
    await createMessage("responder", BASE, CTX);
    await createMessage("responder", BASE, CTX);
    expect(Number(await kv.get(spendKey()))).toBeCloseTo(2 * expectedUsd("claude-sonnet-5-5"), 12);
  });

  it.each(["refusal", "max_tokens"])(
    "throws ModelOutputError on %s after recording spend",
    async (stop) => {
      fake.queue(fakeMessage([block.text("partial")], { stop_reason: stop, usage }));
      const err = await createMessage("responder", BASE, CTX).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ModelOutputError);
      expect((err as ModelOutputError).stopReason).toBe(stop);
      expect(Number(await kv.get(spendKey()))).toBeCloseTo(expectedUsd("claude-sonnet-5-5"), 12);
    },
  );

  it.each(["end_turn", "tool_use", "pause_turn", "stop_sequence"])(
    "returns the message on %s",
    async (stop) => {
      const queued = fakeMessage([block.text("ok")], { stop_reason: stop });
      fake.queue(queued);
      await expect(createMessage("responder", BASE, CTX)).resolves.toBe(queued);
    },
  );

  it("throws BudgetExceededError without calling the API when over budget", async () => {
    await kv.set(spendKey(), 25);
    fake.queue(fakeMessage([block.text("never sent")]));
    await expect(createMessage("responder", BASE, CTX)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(fake.requests).toHaveLength(0);
  });

  it("propagates SDK errors unchanged and logs a warning with the status", async () => {
    const boom = Object.assign(new Error("rate limited"), { status: 429 });
    const failing = {
      beta: {
        messages: {
          create: async (): Promise<never> => {
            throw boom;
          },
        },
      },
    };
    setAnthropicForTests(failing);
    await expect(createMessage("router", BASE, CTX)).rejects.toBe(boom);
    const line = JSON.parse(String(logSpy.mock.calls[0]?.[0]));
    expect(line).toMatchObject({
      level: "warn",
      requestId: "req-abc-123",
      purpose: "router",
      status: 429,
    });
    expect(await kv.get(spendKey())).toBeNull();
  });
});

describe("createMessage logging", () => {
  it("logs one anthropic.call line with the requestId and no message text", async () => {
    fake.queue(
      fakeMessage([block.text("the private answer")], {
        usage: { cache_read_input_tokens: 10, cache_creation_input_tokens: 20 },
      }),
    );
    await createMessage("responder", BASE, CTX);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const raw = String(logSpy.mock.calls[0]?.[0]);
    const line = JSON.parse(raw);
    expect(line).toMatchObject({
      level: "info",
      event: "anthropic.call",
      requestId: "req-abc-123",
      purpose: "responder",
      model: "claude-sonnet-5-5",
      stop_reason: "end_turn",
      input_tok: 100,
      output_tok: 50,
      cache_read_tok: 10,
      cache_creation_tok: 20,
    });
    expect(typeof line.usd).toBe("number");
    expect(raw).not.toContain("secret question");
    expect(raw).not.toContain("private answer");
  });
});

describe("client construction", () => {
  it("passes a 120 s timeout and one retry to the SDK", async () => {
    setAnthropicForTests(null);
    await createMessage("router", BASE, CTX);
    expect(sdk.ctor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 120000, maxRetries: 1 }),
    );
  });
});
