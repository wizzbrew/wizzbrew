import type { APIMessageComponentInteraction } from "discord-api-types/v10";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDiscordApiForTests } from "../../src/discord/api.js";
import { encodeCustomId } from "../../src/discord/components.js";
import { WizzrobeError } from "../../src/errors.js";
import type { PendingAction, RoutingDecision, ThreadRecord } from "../../src/types.js";
import { FakeDiscordApi } from "../fakes/discord.js";

vi.mock("../../src/actions/pending.js", () => ({
  takePending: vi.fn(),
  loadThread: vi.fn(),
}));
vi.mock("../../src/actions/execute.js", () => ({ executeAction: vi.fn() }));
vi.mock("../../src/handlers/ask.js", () => ({ runAskPipeline: vi.fn() }));
vi.mock("../../src/wizzrobe/identity.js", () => ({ loadAsker: vi.fn() }));

import { executeAction } from "../../src/actions/execute.js";
import { loadThread, takePending } from "../../src/actions/pending.js";
import { runAskPipeline } from "../../src/handlers/ask.js";
import { runComponent } from "../../src/handlers/component.js";
import { loadAsker } from "../../src/wizzrobe/identity.js";

const NOW = new Date("2026-10-15T12:00:00Z");
const MENTIONS = { parse: [] };

const decision: RoutingDecision = {
  route: "players",
  confidence: 0.9,
  params: {},
  reason: "test",
};

const pending: PendingAction = {
  id: "p1",
  tool: "acknowledge_match",
  args: { match_id: 1 },
  summary: "Acknowledge match 1",
  discordUserId: "u1",
  createdAt: 0,
  expiresAt: NOW.getTime() + 1000,
};

function thread(over: Partial<ThreadRecord> = {}): ThreadRecord {
  return {
    id: "t1",
    discordUserId: "u1",
    question: "who is alex",
    decision,
    ephemeral: false,
    turns: [{ role: "user", text: "hi" }],
    createdAt: 0,
    expiresAt: NOW.getTime() + 1000,
    ...over,
  };
}

function press(customId: string, userId = "u1"): APIMessageComponentInteraction {
  return {
    token: "tok",
    data: { custom_id: customId },
    member: { user: { id: userId } },
  } as unknown as APIMessageComponentInteraction;
}

let api: FakeDiscordApi;

beforeEach(() => {
  vi.resetAllMocks();
  api = new FakeDiscordApi();
  setDiscordApiForTests(api);
});

afterEach(() => {
  setDiscordApiForTests(null);
  vi.restoreAllMocks();
});

const confirmId = encodeCustomId({ kind: "confirm", pendingId: "p1" });
const cancelId = encodeCustomId({ kind: "cancel", pendingId: "p1" });

describe("confirm", () => {
  it("shows working then the result", async () => {
    vi.mocked(takePending).mockResolvedValue(pending);
    vi.mocked(executeAction).mockResolvedValue("Done.");
    await runComponent(press(confirmId), "r1", NOW);
    expect(takePending).toHaveBeenCalledWith("p1", "u1", NOW);
    expect(api.calls.map((c) => c.body)).toEqual([
      { content: "Working on it...", components: [], allowed_mentions: MENTIONS },
      { content: "Done.", components: [], allowed_mentions: MENTIONS },
    ]);
  });

  it("answers not_yours privately without editing", async () => {
    vi.mocked(takePending).mockResolvedValue("not_yours");
    await runComponent(press(confirmId, "u2"), "r1", NOW);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe("followup");
    expect(api.calls[0]?.body).toMatchObject({
      content: "Only the person who asked can confirm this.",
      flags: 64,
    });
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("edits on expired", async () => {
    vi.mocked(takePending).mockResolvedValue("expired");
    await runComponent(press(confirmId), "r1", NOW);
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(api.calls[0]?.body).toMatchObject({
      content: "That request expired. Ask again.",
      components: [],
    });
  });

  it("turns a WizzrobeError 403 into the user message", async () => {
    vi.mocked(takePending).mockResolvedValue(pending);
    vi.mocked(executeAction).mockRejectedValue(new WizzrobeError(403, "not crew"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runComponent(press(confirmId), "r1", NOW);
    const last = api.calls.at(-1);
    expect(last?.method).toBe("editOriginal");
    expect(last?.body).toMatchObject({
      content: "Your Wizzrobe account can't do that (not crew).",
      components: [],
    });
  });
});

describe("text finalizing", () => {
  it("strips dashes and caps edit text", async () => {
    vi.mocked(takePending).mockResolvedValue(pending);
    vi.mocked(executeAction).mockResolvedValue(`done \u2014 ${"x".repeat(3000)}`);
    await runComponent(press(confirmId), "r1", NOW);
    const last = api.calls.at(-1)?.body as { content: string };
    expect(last.content).not.toContain("\u2014");
    expect(last.content.length).toBeLessThanOrEqual(2000);
  });
});

describe("cancel", () => {
  it("cancels", async () => {
    vi.mocked(takePending).mockResolvedValue(pending);
    await runComponent(press(cancelId), "r1", NOW);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.body).toMatchObject({ content: "Cancelled.", components: [] });
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("handles not_yours and expired", async () => {
    vi.mocked(takePending).mockResolvedValueOnce("not_yours");
    await runComponent(press(cancelId, "u2"), "r1", NOW);
    expect(api.calls[0]?.method).toBe("followup");
    vi.mocked(takePending).mockResolvedValueOnce("expired");
    await runComponent(press(cancelId), "r1", NOW);
    expect(api.calls[1]?.body).toMatchObject({ content: "That request expired. Ask again." });
  });
});

describe("choose", () => {
  const chooseId = encodeCustomId({ kind: "choose", threadId: "t1", value: "Alex:2" });
  const asker = { discordUserId: "u2" };

  it("runs the pipeline for the owner", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread());
    vi.mocked(loadAsker).mockResolvedValue(asker as never);
    await runComponent(press(chooseId, "u1"), "r1", NOW);
    expect(runAskPipeline).toHaveBeenCalledWith({
      requestId: "r1",
      asker,
      question: "who is alex\n(Picked: Alex:2)",
      reply: { kind: "interaction", token: "tok", ephemeral: false },
      history: [{ role: "user", text: "hi" }],
      threadId: "t1",
      forced: decision,
      now: NOW,
    });
  });

  it("lets another user pick on a public thread", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread());
    vi.mocked(loadAsker).mockResolvedValue(asker as never);
    await runComponent(press(chooseId, "u2"), "r1", NOW);
    expect(loadThread).toHaveBeenCalledWith("t1", "u2", NOW);
    expect(runAskPipeline).toHaveBeenCalledTimes(1);
  });

  it("replies privately instead of editing when the thread expired", async () => {
    vi.mocked(loadThread).mockResolvedValue("expired");
    await runComponent(press(chooseId, "u1"), "r1", NOW);
    expect(api.calls[0]?.method).toBe("followup");
    expect(api.calls[0]?.body).toMatchObject({ flags: 64 });
  });

  it("answers a non-owner's pick on its own ephemeral target", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread());
    vi.mocked(loadAsker).mockResolvedValue(asker as never);
    await runComponent(press(chooseId, "u2"), "r1", NOW);
    expect(vi.mocked(runAskPipeline).mock.calls[0]?.[0].reply).toEqual({
      kind: "interaction",
      token: "tok",
      ephemeral: true,
    });
  });

  it("refuses another user on a private thread", async () => {
    vi.mocked(loadThread).mockResolvedValue("not_yours");
    await runComponent(press(chooseId, "u2"), "r1", NOW);
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(api.calls[0]?.method).toBe("followup");
    expect(api.calls[0]?.body).toMatchObject({ content: "That one is private.", flags: 64 });
  });
});

describe("private", () => {
  const privateId = encodeCustomId({ kind: "private", threadId: "t1" });

  it("shows the held answer with Confirm buttons", async () => {
    vi.mocked(loadThread).mockResolvedValue(
      thread({
        ephemeral: true,
        held: { answer: { text: "Your shift is at 5.", ephemeral: true }, pendingId: "p1" },
      }),
    );
    await runComponent(press(privateId), "r1", NOW);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe("editOriginal");
    const body = api.calls[0]?.body as {
      content: string;
      components: { components: { custom_id: string }[] }[];
    };
    expect(body.content).toBe("Your shift is at 5.");
    const ids = body.components.flatMap((r) => r.components.map((c) => c.custom_id));
    expect(ids).toContain(confirmId);
    expect(ids).toContain(cancelId);
  });

  it("says nothing is waiting", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread());
    await runComponent(press(privateId), "r1", NOW);
    expect(api.calls[0]?.body).toMatchObject({
      content: "Nothing is waiting here anymore. Ask again.",
    });
  });

  it("refuses another user", async () => {
    vi.mocked(loadThread).mockResolvedValue("not_yours");
    await runComponent(press(privateId, "u2"), "r1", NOW);
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(api.calls[0]?.body).toMatchObject({
      content: "That one is just for the person who asked.",
    });
  });
});

describe("robustness", () => {
  it("rejects a bad custom_id", async () => {
    await runComponent(press("nonsense"), "r1", NOW);
    expect(api.calls[0]?.method).toBe("followup");
    expect(api.calls[0]?.body).toMatchObject({ content: "That button isn't mine.", flags: 64 });
  });

  it("does not throw when the edit fails", async () => {
    vi.mocked(takePending).mockResolvedValue("expired");
    const failing = new FakeDiscordApi();
    failing.editOriginal = async () => {
      throw new Error("down");
    };
    setDiscordApiForTests(failing);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runComponent(press(confirmId), "r1", NOW)).resolves.toBeUndefined();
  });
});
