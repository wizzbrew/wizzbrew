import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotLinkedError } from "../../src/errors.js";
import type { AskContext, RoutingDecision } from "../../src/types.js";
import { block, fakeMessage } from "../fakes/anthropic.js";

const h = vi.hoisted(() => ({
  scripted: [] as unknown[],
  requests: [] as Record<string, unknown>[],
  callTool: undefined as unknown,
  runClientTool: undefined as unknown,
  botAccessToken: undefined as unknown,
  userAccessToken: undefined as unknown,
}));

vi.mock("../../src/config.js", () => ({
  config: () => ({ communityTimezone: "America/New_York", wizzrobeTenant: "sgl26" }),
}));

vi.mock("../../src/llm/client.js", () => ({
  createMessage: vi.fn(async (purpose: string, params: Record<string, unknown>) => {
    h.requests.push(structuredClone({ purpose, ...params }));
    const next = h.scripted.shift();
    if (!next) throw new Error("no scripted response");
    return next;
  }),
  textOf: (msg: BetaMessage) =>
    msg.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim(),
}));

vi.mock("../../src/responders/specs.js", () => ({
  SHARED_RULES: "SHARED",
  SPECS: new Proxy(
    {},
    { get: (_t, route) => ({ route, register: "data", instructions: `INSTR ${String(route)}` }) },
  ),
}));

vi.mock("../../src/wizzrobe/tokens.js", () => ({
  botAccessToken: vi.fn(async () => (h.botAccessToken as () => Promise<string>)()),
  userAccessToken: vi.fn(async (id: string) =>
    (h.userAccessToken as (i: string) => Promise<string>)(id),
  ),
}));

vi.mock("../../src/responders/clientTools.js", () => ({
  clientToolDefs: (names: string[]) => names.map((name) => ({ name })),
  runClientTool: vi.fn(async (...a: unknown[]) =>
    (h.runClientTool as (...x: unknown[]) => Promise<string>)(...a),
  ),
}));

vi.mock("../../src/wizzrobe/mcp.js", () => ({
  connectorParams: (token: string, readTools: string[]) => ({
    mcp_servers: readTools.length > 0 ? [{ name: "wizzrobe", authorization_token: token }] : [],
    tools: readTools.length > 0 ? [{ type: "mcp_toolset", readTools }] : [],
    betas: ["beta-x"],
  }),
  callTool: vi.fn(async (...a: unknown[]) =>
    (h.callTool as (...x: unknown[]) => Promise<unknown>)(...a),
  ),
}));

import { createMessage } from "../../src/llm/client.js";
import { runResponder } from "../../src/responders/base.js";
import { runClientTool } from "../../src/responders/clientTools.js";

const decision: RoutingDecision = {
  route: "schedule",
  confidence: 1,
  params: { day: "2026-10-15" },
  reason: "t",
};

function ctx(over: Partial<AskContext> = {}): AskContext {
  return {
    requestId: "req1",
    asker: {
      discordUserId: "42",
      discordName: "Sam",
      guildId: null,
      channelId: "c",
      linked: { wizzrobeUserId: 7, wizzrobeUsername: "sam7", roles: ["player"], canWrite: true },
    },
    question: "who plays tonight?",
    now: new Date("2026-10-15T18:00:00Z"),
    ephemeral: false,
    history: [],
    ...over,
  };
}

function queue(...msgs: BetaMessage[]): void {
  h.scripted.push(...msgs);
}

function lastUserText(req: Record<string, unknown>): string {
  const messages = req.messages as { role: string; content: { text: string }[] }[];
  return messages[0]?.content[0]?.text ?? "";
}

beforeEach(() => {
  h.scripted.length = 0;
  h.requests.length = 0;
  h.botAccessToken = async () => "bot-tok";
  h.userAccessToken = async () => "user-tok";
  h.callTool = async () => [];
  h.runClientTool = async () => "{}";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runResponder", () => {
  it("answers a public route with the bot token and splits the system prompt", async () => {
    queue(
      fakeMessage(
        [
          block.thinking("hmm"),
          block.mcpToolUse("get_schedule", {}, "m1"),
          block.mcpToolResult("m1", "[]"),
          block.text("Nothing tonight."),
        ],
        {},
      ),
    );
    const a = await runResponder("schedule", decision, ctx());
    expect(a).toEqual({ text: "Nothing tonight.", ephemeral: false });
    const req = h.requests[0] as Record<string, unknown>;
    expect(req.purpose).toBe("responder");
    expect((req.mcp_servers as { authorization_token: string }[])[0]?.authorization_token).toBe(
      "bot-tok",
    );
    const system = req.system as { text: string; cache_control?: unknown }[];
    expect(system[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(system[0]?.text).not.toContain("Current time");
    expect(system[0]?.text).toContain("SHARED");
    expect(system[0]?.text).toContain("INSTR schedule");
    expect(system[1]?.text).toContain("Current time");
    expect(system[1]?.text).toContain("Wizzrobe tenant: sgl26");
    expect(system[1]?.text).toContain("Linked Wizzrobe account: sam7 (user id 7), roles: player");
  });

  it("puts earlier turns before the question", async () => {
    queue(fakeMessage([block.text("ok")]));
    await runResponder(
      "schedule",
      decision,
      ctx({
        history: [
          { role: "user", text: "first q" },
          { role: "assistant", text: "first a" },
        ],
      }),
    );
    const text = lastUserText(h.requests[0] as Record<string, unknown>);
    expect(text.indexOf("User: first q")).toBeGreaterThan(-1);
    expect(text.indexOf("Wizzbrew: first a")).toBeGreaterThan(text.indexOf("User: first q"));
    expect(text.indexOf("who plays tonight?")).toBeGreaterThan(text.indexOf("Wizzbrew: first a"));
    expect(text.startsWith("Earlier in this conversation:")).toBe(true);
  });

  it("uses the user token on a linked route and lets NotLinkedError propagate", async () => {
    queue(fakeMessage([block.text("yours")]));
    await runResponder("my_stuff", { ...decision, route: "my_stuff" }, ctx());
    const req = h.requests[0] as Record<string, unknown>;
    expect((req.mcp_servers as { authorization_token: string }[])[0]?.authorization_token).toBe(
      "user-tok",
    );
  });

  it("propagates NotLinkedError", async () => {
    h.userAccessToken = async () => {
      throw new NotLinkedError("no");
    };
    await expect(runResponder("my_stuff", decision, ctx())).rejects.toBeInstanceOf(NotLinkedError);
  });

  it("runs client tools, sends results in one message and keeps assistant content", async () => {
    h.runClientTool = async () => '{"matches":[]}';
    const first = fakeMessage([
      block.thinking("t"),
      block.toolUse("matches_for_me", { days_ahead: 3 }, "c1"),
      block.toolUse("matches_for_me", { days_ahead: 5 }, "c2"),
    ]);
    queue(first, fakeMessage([block.text("none")]));
    const c = ctx();
    const a = await runResponder("schedule", decision, c);
    expect(a.text).toBe("none");
    expect(runClientTool).toHaveBeenCalledWith("matches_for_me", { days_ahead: 3 }, c);
    const second = h.requests[1] as { messages: { role: string; content: unknown[] }[] };
    expect(second.messages).toHaveLength(3);
    expect(second.messages[1]?.role).toBe("assistant");
    expect(second.messages[1]?.content).toEqual(first.content);
    expect(second.messages[2]?.role).toBe("user");
    expect(second.messages[2]?.content).toHaveLength(2);
  });

  it("returns a valid proposal and limits the enum to the route's write tools", async () => {
    queue(
      fakeMessage([
        block.toolUse("propose_action", {
          tool: "signup_as_crew",
          args_json: '{"match_id":5,"role":"commentator"}',
          summary: "Sign up on <t:1:f>",
        }),
      ]),
    );
    const a = await runResponder("crew", { ...decision, route: "crew" }, ctx());
    expect(a.proposedAction).toEqual({
      tool: "signup_as_crew",
      args: { match_id: 5, role: "commentator" },
      summary: "Sign up on <t:1:f>",
    });
    expect(a.text).toBe("Sign up on <t:1:f>");
    const tools = (h.requests[0] as { tools: { name?: string; input_schema?: unknown }[] }).tools;
    const propose = tools.find((t) => t.name === "propose_action");
    const schema = propose?.input_schema as { properties: { tool: { enum: string[] } } };
    expect(schema.properties.tool.enum).toEqual(["signup_as_crew", "withdraw_crew_signup"]);
    expect(tools.some((t) => t.name === "offer_choices")).toBe(true);
  });

  it("answers an invalid proposal with is_error, then accepts a valid retry", async () => {
    queue(
      fakeMessage([
        block.toolUse(
          "propose_action",
          {
            tool: "signup_as_crew",
            args_json: '{"match_id":"x","role":"commentator"}',
            summary: "s",
          },
          "p1",
        ),
      ]),
      fakeMessage([
        block.toolUse(
          "propose_action",
          {
            tool: "signup_as_crew",
            args_json: '{"match_id":5,"role":"tracker"}',
            summary: "s2",
          },
          "p2",
        ),
      ]),
    );
    const a = await runResponder("crew", { ...decision, route: "crew" }, ctx());
    expect(a.proposedAction?.args).toEqual({ match_id: 5, role: "tracker" });
    const second = h.requests[1] as { messages: { content: Record<string, unknown>[] }[] };
    const result = second.messages[2]?.content[0];
    expect(result?.is_error).toBe(true);
    expect(String(result?.content)).toContain("match_id");
  });

  it("rejects a write tool outside the route", async () => {
    queue(
      fakeMessage([
        block.toolUse("propose_action", {
          tool: "acknowledge_match",
          args_json: '{"match_id":5}',
          summary: "s",
        }),
      ]),
      fakeMessage([block.text("sorry")]),
    );
    const a = await runResponder("crew", { ...decision, route: "crew" }, ctx());
    expect(a.proposedAction).toBeUndefined();
    expect(a.text).toBe("sorry");
  });

  it("ends on offer_choices", async () => {
    queue(
      fakeMessage([
        block.toolUse("offer_choices", {
          prompt: "Which Sam?",
          choices: [
            { label: "Sam A", value: "1" },
            { label: "Sam B", value: "2" },
          ],
        }),
      ]),
    );
    const a = await runResponder("players", { ...decision, route: "players" }, ctx());
    expect(a.text).toBe("Which Sam?");
    expect(a.choices).toHaveLength(2);
  });

  it("answers an unknown tool with is_error and loops on", async () => {
    queue(fakeMessage([block.toolUse("nope", {}, "u1")]), fakeMessage([block.text("done")]));
    const a = await runResponder("schedule", decision, ctx());
    expect(a.text).toBe("done");
    const second = h.requests[1] as { messages: { content: Record<string, unknown>[] }[] };
    expect(second.messages[2]?.content[0]?.content).toBe("unknown tool");
  });

  it("calls again on pause_turn", async () => {
    queue(
      fakeMessage([block.text("partial")], { stop_reason: "pause_turn" }),
      fakeMessage([block.text("final")]),
    );
    const a = await runResponder("schedule", decision, ctx());
    expect(a.text).toBe("final");
    expect(h.requests).toHaveLength(2);
  });

  it("stops after 8 calls", async () => {
    for (let i = 0; i < 9; i++) {
      queue(fakeMessage([block.text("more")], { stop_reason: "pause_turn" }));
    }
    await expect(runResponder("schedule", decision, ctx())).rejects.toMatchObject({
      stopReason: "iteration_cap",
    });
    expect(h.requests).toHaveLength(8);
  });

  it("times out past 200 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
    const real = fakeMessage([block.text("x")], { stop_reason: "pause_turn" });
    vi.mocked(createMessage).mockImplementationOnce(async () => {
      vi.setSystemTime(new Date("2026-10-15T18:03:30Z"));
      return real;
    });
    await expect(runResponder("schedule", decision, ctx())).rejects.toMatchObject({
      stopReason: "timeout",
    });
  });

  it("fails on an empty answer", async () => {
    queue(fakeMessage([block.thinking("only")]));
    await expect(runResponder("schedule", decision, ctx())).rejects.toMatchObject({
      stopReason: "empty",
    });
  });

  it("gives chat an event block and a single low-effort call", async () => {
    h.callTool = async (_t: string, name: string) =>
      name === "list_tournaments"
        ? [{ name: "Zelda Open" }]
        : [{ name: "Stage 1", stream_url: "https://twitch.tv/x" }];
    queue(fakeMessage([block.text("hi")]));
    const a = await runResponder("chat", { ...decision, route: "chat" }, ctx());
    expect(a.text).toBe("hi");
    const req = h.requests[0] as Record<string, unknown>;
    expect(req.purpose).toBe("chat");
    expect(req.output_config).toEqual({ effort: "low" });
    const vol = (req.system as { text: string }[])[1]?.text ?? "";
    expect(vol).toContain("Zelda Open");
    expect(vol).toContain("Stage 1 (https://twitch.tv/x)");
  });

  it("leaves the event block part out when list_stages fails", async () => {
    h.callTool = async (_t: string, name: string) => {
      if (name === "list_stages") throw new Error("down");
      return [{ name: "Zelda Open" }];
    };
    queue(fakeMessage([block.text("hi")]));
    await runResponder("chat", { ...decision, route: "chat" }, ctx());
    const vol = ((h.requests[0] as Record<string, unknown>).system as { text: string }[])[1]?.text;
    expect(vol).toContain("Zelda Open");
    expect(vol).not.toContain("Stages:");
  });

  it("answers staff at once and rejects live and account", async () => {
    expect(await runResponder("staff", decision, ctx())).toEqual({
      text: "Staff tools aren't in Wizzbrew yet. Use Wizzrobe directly.",
      ephemeral: true,
    });
    await expect(runResponder("live", decision, ctx())).rejects.toThrow(
      "route live has no responder",
    );
    await expect(runResponder("account", decision, ctx())).rejects.toThrow(
      "route account has no responder",
    );
    expect(h.requests).toHaveLength(0);
  });
});
