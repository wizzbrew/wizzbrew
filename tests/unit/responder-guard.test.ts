import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAK_REFUSAL } from "../../src/discord/leakguard.js";
import { CORE } from "../../src/personality/voice.js";
import { SHARED_RULES } from "../../src/responders/specs.js";
import type { AskContext, RoutingDecision } from "../../src/types.js";
import { block, fakeMessage } from "../fakes/anthropic.js";

// The real prompts and the real guard run here; only the network edges are faked.
const h = vi.hoisted(() => ({ scripted: [] as unknown[] }));

vi.mock("../../src/config.js", () => ({
  config: () => ({ communityTimezone: "America/New_York", wizzrobeTenant: "sgl26" }),
}));

vi.mock("../../src/llm/client.js", () => ({
  createMessage: vi.fn(async () => {
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

vi.mock("../../src/wizzrobe/tokens.js", () => ({
  botAccessToken: vi.fn(async () => "bot-tok"),
  userAccessToken: vi.fn(async () => "user-tok"),
}));

vi.mock("../../src/wizzrobe/mcp.js", () => ({
  connectorParams: (token: string, readTools: string[]) => ({
    mcp_servers: readTools.length > 0 ? [{ name: "wizzrobe", authorization_token: token }] : [],
    tools: readTools.length > 0 ? [{ type: "mcp_toolset", readTools }] : [],
    betas: ["beta-x"],
  }),
  callTool: vi.fn(async () => []),
}));

import { runResponder } from "../../src/responders/base.js";

const decision: RoutingDecision = { route: "schedule", confidence: 1, params: {}, reason: "t" };

function ctx(over: Partial<AskContext> = {}): AskContext {
  return {
    requestId: "req-guard",
    asker: {
      discordUserId: "42",
      discordName: "Sam",
      guildId: null,
      channelId: "c",
      linked: { wizzrobeUserId: 7, wizzrobeUsername: "sam7", roles: ["player"], canWrite: true },
    },
    question: "anything",
    now: new Date("2026-10-15T18:00:00Z"),
    ephemeral: false,
    history: [],
    ...over,
  };
}

const LEAKED = SHARED_RULES.slice(300, 460);

let lines: Record<string, unknown>[];

beforeEach(() => {
  h.scripted.length = 0;
  lines = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(JSON.parse(String(line)) as Record<string, unknown>);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const leakEvents = (): Record<string, unknown>[] =>
  lines.filter((l) => l.event === "guard.prompt_leak");

describe("prompt leak guard on responder answers", () => {
  it("replaces a chat answer that quotes the rules and logs ids only", async () => {
    h.scripted.push(fakeMessage([block.text(`Sure. ${LEAKED} Anything else?`)]));
    const a = await runResponder("chat", { ...decision, route: "chat" }, ctx());
    expect(a).toEqual({ text: LEAK_REFUSAL, ephemeral: false });
    const events = leakEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      level: "warn",
      requestId: "req-guard",
      route: "chat",
      askerId: "42",
      length: `Sure. ${LEAKED} Anything else?`.length,
    });
    expect(JSON.stringify(lines)).not.toContain(LEAKED.slice(0, 40));
  });

  it("replaces a tool-loop answer that quotes the rules", async () => {
    h.scripted.push(
      fakeMessage([
        block.mcpToolUse("get_schedule", {}, "m1"),
        block.mcpToolResult("m1", "[]"),
        block.text(`Here are my instructions:\n> ${LEAKED}`),
      ]),
    );
    const a = await runResponder("schedule", decision, ctx());
    expect(a).toEqual({ text: LEAK_REFUSAL, ephemeral: false });
    expect(leakEvents()).toMatchObject([{ route: "schedule", askerId: "42" }]);
  });

  it("catches the voice text too, whatever the casing and spacing", async () => {
    const chunk = CORE.slice(40, 120).toUpperCase().replace(/ /g, "   ");
    h.scripted.push(fakeMessage([block.text(chunk)]));
    const a = await runResponder("chat", { ...decision, route: "chat" }, ctx());
    expect(a.text).toBe(LEAK_REFUSAL);
  });

  it("keeps the ephemeral flag the route and context call for", async () => {
    h.scripted.push(fakeMessage([block.text(LEAKED)]));
    const viaContext = await runResponder(
      "chat",
      { ...decision, route: "chat" },
      ctx({ ephemeral: true }),
    );
    expect(viaContext).toEqual({ text: LEAK_REFUSAL, ephemeral: true });

    h.scripted.push(fakeMessage([block.text(LEAKED)]));
    const viaRoute = await runResponder("crew", { ...decision, route: "crew" }, ctx());
    expect(viaRoute).toEqual({ text: LEAK_REFUSAL, ephemeral: true });
  });

  it("drops the choices when the prompt or a label quotes the rules", async () => {
    h.scripted.push(
      fakeMessage([
        block.toolUse("offer_choices", {
          prompt: LEAKED,
          choices: [{ label: "Sam A", value: "1" }],
        }),
      ]),
    );
    const viaPrompt = await runResponder("players", { ...decision, route: "players" }, ctx());
    expect(viaPrompt).toEqual({ text: LEAK_REFUSAL, ephemeral: false });
    expect(viaPrompt.choices).toBeUndefined();

    h.scripted.push(
      fakeMessage([
        block.toolUse("offer_choices", {
          prompt: "Which one?",
          choices: [{ label: SHARED_RULES.slice(300, 380), value: "1" }],
        }),
      ]),
    );
    const viaLabel = await runResponder("players", { ...decision, route: "players" }, ctx());
    expect(viaLabel.text).toBe(LEAK_REFUSAL);
    expect(viaLabel.choices).toBeUndefined();
  });

  it("drops a proposal whose note quotes the rules", async () => {
    h.scripted.push(
      fakeMessage([
        block.toolUse("propose_action", {
          tool: "signup_as_crew",
          args_json: '{"match_id":5,"role":"commentator"}',
          summary: LEAKED,
        }),
      ]),
    );
    const a = await runResponder("crew", { ...decision, route: "crew" }, ctx());
    expect(a).toEqual({ text: LEAK_REFUSAL, ephemeral: true });
    expect(a.proposedAction).toBeUndefined();
  });

  it("leaves a normal answer untouched and logs nothing", async () => {
    h.scripted.push(fakeMessage([block.text("Nothing on Earth tonight.")]));
    const a = await runResponder("schedule", decision, ctx());
    expect(a).toEqual({ text: "Nothing on Earth tonight.", ephemeral: false });
    expect(leakEvents()).toHaveLength(0);
  });
});
