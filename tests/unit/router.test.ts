import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceededError, ModelOutputError } from "../../src/errors.js";
import { createMessage, textOf } from "../../src/llm/client.js";
import { ROUTER_PROMPT } from "../../src/router/prompt.js";
import { routeQuestion } from "../../src/router/router.js";
import type { AskContext } from "../../src/types.js";

vi.mock("../../src/llm/client.js");

// Thu 2026-10-15 12:00 in New York (EDT, UTC-4).
const NOW = new Date("2026-10-15T16:00:00Z");

const NO_PARAMS = { day: null, tournament: null, player: null, stage: null, matchId: null };

function ctx(overrides: Partial<AskContext> = {}, linked = false): AskContext {
  return {
    requestId: "req-1",
    asker: {
      discordUserId: "111",
      discordName: "Asker",
      guildId: "222",
      channelId: "333",
      linked: linked
        ? { wizzrobeUserId: 7, wizzrobeUsername: "asker", roles: [], canWrite: true }
        : null,
    },
    question: "what is on today",
    now: NOW,
    ephemeral: false,
    ...overrides,
  };
}

function decide(over: Record<string, unknown> = {}, params: Record<string, unknown> = {}) {
  return JSON.stringify({
    route: "schedule",
    confidence: 0.9,
    reason: "asks about matches",
    ...over,
    params: { ...NO_PARAMS, ...params },
  });
}

function reply(text: string): void {
  vi.mocked(createMessage).mockResolvedValue({} as BetaMessage);
  vi.mocked(textOf).mockReturnValue(text);
}

function request() {
  const call = vi.mocked(createMessage).mock.calls[0];
  if (!call) throw new Error("createMessage was not called");
  return call;
}

let out: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.mocked(createMessage).mockReset();
  vi.mocked(textOf).mockReset();
  out = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function logged(event: string): Record<string, unknown> | undefined {
  for (const call of out.mock.calls) {
    const line = JSON.parse(String(call[0])) as Record<string, unknown>;
    if (line.event === event) return line;
  }
  return undefined;
}

describe("routeQuestion decisions", () => {
  it("passes a schema valid decision through and resolves the day", async () => {
    reply(
      decide(
        { route: "players", confidence: 0.8 },
        { day: "saturday", tournament: "ALttPR Open", player: "Some Player", matchId: 12 },
      ),
    );
    const decision = await routeQuestion(ctx());
    expect(decision).toEqual({
      route: "players",
      confidence: 0.8,
      params: {
        day: "2026-10-17",
        tournament: "ALttPR Open",
        player: "Some Player",
        matchId: 12,
      },
      reason: "asks about matches",
    });
  });

  it("leaves null params absent", async () => {
    reply(decide());
    const decision = await routeQuestion(ctx());
    expect(decision.route).toBe("schedule");
    expect(Object.keys(decision.params)).toEqual([]);
  });

  it("copies names exactly as returned, without trimming or fixing them", async () => {
    reply(decide({}, { stage: "  stage  one", tournament: "alttpr opn" }));
    const decision = await routeQuestion(ctx());
    expect(decision.params.stage).toBe("  stage  one");
    expect(decision.params.tournament).toBe("alttpr opn");
  });

  it("drops an unreadable day and notes it in the reason", async () => {
    reply(decide({}, { day: "someday soon", player: "Some Player" }));
    const decision = await routeQuestion(ctx());
    expect(decision.route).toBe("schedule");
    expect(decision.params.day).toBeUndefined();
    expect(decision.params.player).toBe("Some Player");
    expect(decision.reason).toContain("day unreadable");
    expect(decision.reason).toContain("asks about matches");
  });

  it("sends low confidence to chat", async () => {
    reply(decide({ route: "standings", confidence: 0.3 }, { tournament: "Open" }));
    const decision = await routeQuestion(ctx());
    expect(decision).toEqual({
      route: "chat",
      confidence: 0.3,
      params: {},
      reason: "asks about matches",
    });
  });

  it("keeps a decision at exactly the threshold", async () => {
    reply(decide({ route: "help", confidence: 0.5 }));
    const decision = await routeQuestion(ctx());
    expect(decision.route).toBe("help");
  });

  it("logs the decision", async () => {
    reply(decide({ route: "streams" }, { stage: "Main" }));
    await routeQuestion(ctx());
    expect(logged("router.decision")).toMatchObject({
      requestId: "req-1",
      route: "streams",
      confidence: 0.9,
      params: { stage: "Main" },
      reason: "asks about matches",
    });
  });
});

describe("routeQuestion failures", () => {
  it("turns a refusal into chat with confidence 0", async () => {
    vi.mocked(createMessage).mockRejectedValue(new ModelOutputError("refusal", "refused"));
    const decision = await routeQuestion(ctx());
    expect(decision).toEqual({
      route: "chat",
      confidence: 0,
      params: {},
      reason: "router failed: refusal",
    });
    expect(logged("router.failed")).toMatchObject({ requestId: "req-1", kind: "refusal" });
  });

  it("names max_tokens", async () => {
    vi.mocked(createMessage).mockRejectedValue(new ModelOutputError("max_tokens", "cut off"));
    const decision = await routeQuestion(ctx());
    expect(decision.reason).toBe("router failed: max_tokens");
  });

  it("turns prose instead of JSON into chat", async () => {
    reply("The best route is schedule.");
    const decision = await routeQuestion(ctx());
    expect(decision.route).toBe("chat");
    expect(decision.confidence).toBe(0);
    expect(decision.reason).toContain("bad_json");
  });

  it("turns JSON of the wrong shape into chat", async () => {
    reply(JSON.stringify({ route: "bracket_room", confidence: 0.9, params: {}, reason: "x" }));
    const decision = await routeQuestion(ctx());
    expect(decision.route).toBe("chat");
    expect(decision.confidence).toBe(0);
    expect(decision.reason).toContain("bad_shape");
  });

  it("lets a budget error propagate", async () => {
    vi.mocked(createMessage).mockRejectedValue(new BudgetExceededError("daily cap"));
    await expect(routeQuestion(ctx())).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("lets any other error propagate", async () => {
    vi.mocked(createMessage).mockRejectedValue(new Error("network down"));
    await expect(routeQuestion(ctx())).rejects.toThrow("network down");
  });
});

describe("routeQuestion request", () => {
  it("caches the system prompt, keeps the clock in the user turn and asks for low effort", async () => {
    reply(decide());
    await routeQuestion(ctx());
    const [purpose, params, meta] = request();
    expect(purpose).toBe("router");
    expect(meta).toEqual({ requestId: "req-1", now: NOW });
    expect(params.max_tokens).toBe(4000);

    const system = params.system;
    if (!Array.isArray(system)) throw new Error("system must be a block array");
    expect(system).toHaveLength(1);
    expect(system[0]).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    expect(system[0]?.text).toBe(ROUTER_PROMPT);
    expect(system[0]?.text).not.toContain("Current time");

    expect(params.messages).toHaveLength(1);
    const message = params.messages[0];
    expect(message?.role).toBe("user");
    expect(String(message?.content)).toContain("Current time:");
    expect(String(message?.content)).toContain("what is on today");

    expect(params.output_config?.effort).toBe("low");
    expect(params.output_config?.format).toMatchObject({ type: "json_schema" });
  });

  it("states whether the asker is linked", async () => {
    reply(decide());
    await routeQuestion(ctx({}, true));
    expect(String(request()[1].messages[0]?.content)).toContain("Asker linked: yes\n\n");

    vi.mocked(createMessage).mockClear();
    await routeQuestion(ctx({}, false));
    expect(String(request()[1].messages[0]?.content)).toContain("Asker linked: no\n\n");
  });

  it("sends a strict schema with every route and every param", async () => {
    reply(decide());
    await routeQuestion(ctx());
    const format = request()[1].output_config?.format;
    if (format?.type !== "json_schema") throw new Error("no json_schema format");
    const schema = format.schema as {
      additionalProperties: boolean;
      required: string[];
      properties: {
        route: { enum: string[] };
        params: {
          additionalProperties: boolean;
          required: string[];
          properties: Record<string, { type: string[] }>;
        };
      };
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["route", "confidence", "params", "reason"]);
    expect([...schema.properties.route.enum].sort()).toEqual(
      [
        "chat",
        "crew",
        "help",
        "my_stuff",
        "player_actions",
        "players",
        "schedule",
        "standings",
        "staff",
        "streams",
        "tournaments",
      ].sort(),
    );
    const params = schema.properties.params;
    expect(params.additionalProperties).toBe(false);
    expect(params.required).toEqual(["day", "tournament", "player", "stage", "matchId"]);
    expect(params.properties.matchId?.type).toEqual(["integer", "null"]);
    expect(params.properties.day?.type).toEqual(["string", "null"]);
  });

  it("sanitizes the question before it reaches the model", async () => {
    reply(decide());
    await routeQuestion(ctx({ question: "line one\n\n\n\nline two" }));
    const content = String(request()[1].messages[0]?.content);
    expect(content).toContain("line one");
    expect(content).not.toContain("\n\n\n");
  });
});

describe("ROUTER_PROMPT", () => {
  const dashes = String.fromCharCode(0x2014, 0x2013);

  it("lists no sample questions or phrasings", () => {
    for (const phrase of ["e.g.", "for example", "such as"]) {
      expect(ROUTER_PROMPT.toLowerCase(), phrase).not.toContain(phrase);
    }
    for (const line of ROUTER_PROMPT.split("\n")) {
      expect(line.trimEnd().endsWith("?"), line).toBe(false);
    }
    expect(ROUTER_PROMPT).not.toMatch(/["“”]/);
  });

  it("has no em or en dashes", () => {
    expect(new RegExp(`[${dashes}]`).test(ROUTER_PROMPT)).toBe(false);
  });

  it("holds no clock and names every route", () => {
    expect(ROUTER_PROMPT).not.toContain("Current time");
    for (const route of [
      "schedule",
      "streams",
      "standings",
      "players",
      "tournaments",
      "my_stuff",
      "crew",
      "player_actions",
      "help",
      "staff",
      "chat",
    ]) {
      expect(ROUTER_PROMPT, route).toContain(`${route}:`);
    }
  });
});
