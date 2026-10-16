import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/llm/budget.js", () => ({ assertUnderBudget: vi.fn() }));
vi.mock("../../src/router/router.js", () => ({ routeQuestion: vi.fn() }));
vi.mock("../../src/responders/base.js", () => ({ runResponder: vi.fn() }));
vi.mock("../../src/actions/pending.js", () => ({
  createPending: vi.fn(),
  saveThread: vi.fn(),
}));
vi.mock("../../src/handlers/account.js", () => ({ accountAnswer: vi.fn() }));
vi.mock("../../src/responders/direct.js", () => ({ liveAnswer: vi.fn() }));
vi.mock("../../src/ops/alerts.js", () => ({ alertStaff: vi.fn(), isPaused: vi.fn() }));

import { APIError } from "@anthropic-ai/sdk";
import { createPending, saveThread } from "../../src/actions/pending.js";
import { setDiscordApiForTests } from "../../src/discord/api.js";
import { UserInputError, WizzrobeError } from "../../src/errors.js";
import { accountAnswer } from "../../src/handlers/account.js";
import { runAskPipeline } from "../../src/handlers/ask.js";
import { assertUnderBudget } from "../../src/llm/budget.js";
import { alertStaff, isPaused } from "../../src/ops/alerts.js";
import { runResponder } from "../../src/responders/base.js";
import { liveAnswer } from "../../src/responders/direct.js";
import { routeQuestion } from "../../src/router/router.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import type {
  Answer,
  Asker,
  ProposedAction,
  ReplyTarget,
  RoutingDecision,
} from "../../src/types.js";
import { FakeDiscordApi } from "../fakes/discord.js";
import { FakeKv } from "../fakes/kv.js";

const NOW = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));
const USER = "111111111111111111";
const unlinked: Asker = {
  discordUserId: USER,
  discordName: "tester",
  guildId: "g",
  channelId: "c",
  linked: null,
};
const linked: Asker = {
  ...unlinked,
  linked: { wizzrobeUserId: 1, wizzrobeUsername: "t", roles: ["player"], canWrite: true },
};
const staff: Asker = {
  ...unlinked,
  linked: { wizzrobeUserId: 1, wizzrobeUsername: "t", roles: ["staff"], canWrite: true },
};
const decision = (route: RoutingDecision["route"], params = {}): RoutingDecision => ({
  route,
  confidence: 0.9,
  params,
  reason: "test",
});
const ix: ReplyTarget = { kind: "interaction", token: "tok", ephemeral: false };
const msg: ReplyTarget = { kind: "message", channelId: "chan", messageId: "m1" };
const answer: Answer = { text: "The answer", ephemeral: false };

let api: FakeDiscordApi;
let store: FakeKv;

function run(over: Partial<Parameters<typeof runAskPipeline>[0]> = {}) {
  return runAskPipeline({
    requestId: "req1",
    asker: unlinked,
    question: "what is on",
    reply: ix,
    history: [],
    now: NOW,
    ...over,
  });
}

function sentText(): string {
  return JSON.stringify(api.calls.map((c) => c.body));
}

beforeEach(() => {
  vi.resetAllMocks();
  api = new FakeDiscordApi();
  store = new FakeKv(() => NOW.getTime());
  setDiscordApiForTests(api);
  setKvForTests(store);
  vi.mocked(isPaused).mockResolvedValue(false);
  vi.mocked(routeQuestion).mockResolvedValue(decision("schedule"));
  vi.mocked(runResponder).mockResolvedValue(answer);
  vi.mocked(saveThread).mockResolvedValue({ id: "thr1" } as never);
});

describe("runAskPipeline", () => {
  it("routes, answers, saves a thread and delivers", async () => {
    await run({ history: [{ role: "user", text: "earlier" }] });
    expect(routeQuestion).toHaveBeenCalledOnce();
    expect(assertUnderBudget).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveThread).mock.calls[0]?.[0];
    expect(saved?.turns).toEqual([
      { role: "user", text: "earlier" },
      { role: "user", text: "what is on" },
      { role: "assistant", text: "The answer" },
    ]);
    expect(saved?.held).toBeUndefined();
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(sentText()).toContain("The answer");
  });

  it("skips the budget and router for a forced live route", async () => {
    vi.mocked(liveAnswer).mockResolvedValue(answer);
    await run({ forced: decision("live") });
    expect(assertUnderBudget).not.toHaveBeenCalled();
    expect(routeQuestion).not.toHaveBeenCalled();
    expect(liveAnswer).toHaveBeenCalledWith(NOW);
  });

  it("calls the account handler with the action", async () => {
    vi.mocked(routeQuestion).mockResolvedValue(decision("account", { accountAction: "unlink" }));
    vi.mocked(accountAnswer).mockResolvedValue(answer);
    await run();
    expect(accountAnswer).toHaveBeenCalledWith("unlink", unlinked, NOW);
  });

  it("refuses a second request while locked", async () => {
    await store.set(keys.lock(USER), "other", 120);
    await run();
    expect(routeQuestion).not.toHaveBeenCalled();
    expect(sentText()).toContain("Still working");
    expect(await store.get(keys.lock(USER))).toBe("other");
  });

  it("releases the lock after success and after an error", async () => {
    await run();
    expect(await store.get(keys.lock(USER))).toBeNull();
    vi.mocked(runResponder).mockRejectedValue(new Error("x"));
    await run();
    expect(await store.get(keys.lock(USER))).toBeNull();
  });

  it("stops when paused", async () => {
    vi.mocked(isPaused).mockResolvedValue(true);
    await run();
    expect(routeQuestion).not.toHaveBeenCalled();
    expect(sentText()).toContain("paused");
  });

  it("tells an unlinked user to link", async () => {
    vi.mocked(routeQuestion).mockResolvedValue(decision("my_stuff"));
    await run();
    expect(runResponder).not.toHaveBeenCalled();
    expect(sentText()).toContain("/link");
    expect(alertStaff).not.toHaveBeenCalled();
  });

  it("gates staff routes in code", async () => {
    vi.mocked(routeQuestion).mockResolvedValue(decision("staff"));
    await run({ asker: linked });
    expect(runResponder).not.toHaveBeenCalled();
    expect(sentText()).toContain("event staff");
    await run({ asker: staff });
    expect(runResponder).toHaveBeenCalledOnce();
  });

  it("creates a pending action and passes its id", async () => {
    const proposedAction: ProposedAction = { tool: "acknowledge_match", args: {}, summary: "Ack" };
    vi.mocked(runResponder).mockResolvedValue({ ...answer, proposedAction });
    vi.mocked(createPending).mockResolvedValue({ id: "pend1" } as never);
    await run({ asker: linked });
    expect(createPending).toHaveBeenCalledWith(proposedAction, USER, NOW);
    expect(sentText()).toContain("pend1");
  });

  it("holds a private answer for a message reply", async () => {
    const priv: Answer = { text: "secret", ephemeral: true };
    vi.mocked(runResponder).mockResolvedValue(priv);
    await run({ reply: msg });
    const saved = vi.mocked(saveThread).mock.calls[0]?.[0];
    expect(saved?.held?.answer).toEqual(priv);
    expect(sentText()).toContain("thr1");
    expect(sentText()).not.toContain("secret");
  });

  it("alerts staff once and replies on an internal error", async () => {
    vi.mocked(runResponder).mockRejectedValue(new Error("kaboom"));
    await run();
    expect(alertStaff).toHaveBeenCalledOnce();
    expect(sentText()).toContain("Something went wrong");
  });

  it("does not alert for a user input error or a Wizzrobe 404", async () => {
    vi.mocked(runResponder).mockRejectedValue(new UserInputError("bad time"));
    await run();
    vi.mocked(runResponder).mockRejectedValue(new WizzrobeError(404, "gone"));
    await run();
    expect(alertStaff).not.toHaveBeenCalled();
    expect(sentText()).toContain("bad time");
  });

  it("holds the lock for 300 seconds", async () => {
    const spy = vi.spyOn(store, "setIfAbsent");
    await run();
    expect(spy).toHaveBeenCalledWith(keys.lock(USER), "req1", 300);
  });

  it("rate limits the ninth request in a minute before the lock", async () => {
    for (let i = 0; i < 8; i++) await run();
    vi.mocked(routeQuestion).mockClear();
    await run();
    expect(routeQuestion).not.toHaveBeenCalled();
    expect(sentText()).toContain("asking faster than I can keep up");
  });

  it("stores a placeholder turn instead of the account link", async () => {
    vi.mocked(routeQuestion).mockResolvedValue(decision("account", { accountAction: "link" }));
    vi.mocked(accountAnswer).mockResolvedValue({
      text: "https://oauth.example/secret",
      ephemeral: true,
    });
    await run();
    const saved = vi.mocked(saveThread).mock.calls[0]?.[0];
    expect(JSON.stringify(saved?.turns)).not.toContain("oauth.example");
    expect(saved?.turns.at(-1)).toEqual({
      role: "assistant",
      text: "(sent a private account link)",
    });
  });

  it("does not alert for Anthropic 429 or 529 but does for 503", async () => {
    const err = (status: number) => new APIError(status, undefined, "x", new Headers());
    vi.mocked(runResponder).mockRejectedValue(err(429));
    await run();
    vi.mocked(runResponder).mockRejectedValue(err(529));
    await run();
    expect(alertStaff).not.toHaveBeenCalled();
    vi.mocked(runResponder).mockRejectedValue(err(503));
    await run();
    expect(alertStaff).toHaveBeenCalledOnce();
    expect(sentText()).toContain("model is busy");
  });

  it("uses the public error text on the message path", async () => {
    vi.mocked(runResponder).mockRejectedValue(new WizzrobeError(403, "secret detail"));
    await run({ reply: msg });
    expect(sentText()).not.toContain("secret detail");
    expect(sentText()).toContain("can't do that.");
  });
});
