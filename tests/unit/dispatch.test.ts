import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/wizzrobe/identity.js", () => ({ loadAsker: vi.fn() }));
vi.mock("../../src/actions/pending.js", () => ({
  takePending: vi.fn(),
  loadThread: vi.fn(),
  saveThread: vi.fn(),
}));
vi.mock("../../src/ops/rate.js", () => ({ allowRequest: vi.fn() }));
vi.mock("../../src/handlers/ask.js", () => ({ runAskPipeline: vi.fn() }));
vi.mock("../../src/handlers/deliver.js", () => ({ deliver: vi.fn(), deliverError: vi.fn() }));
vi.mock("../../src/handlers/component.js", () => ({ runComponent: vi.fn() }));
vi.mock("../../src/responders/direct.js", () => ({ scheduleAnswer: vi.fn(), liveAnswer: vi.fn() }));
vi.mock("../../src/ops/alerts.js", () => ({ isPaused: vi.fn(), alertStaff: vi.fn() }));

import { loadThread, saveThread, takePending } from "../../src/actions/pending.js";
import { encodeCustomId } from "../../src/discord/components.js";
import { helpText } from "../../src/discord/help.js";
import { runAskPipeline } from "../../src/handlers/ask.js";
import { runComponent } from "../../src/handlers/component.js";
import { deliver, deliverError } from "../../src/handlers/deliver.js";
import { handleInteraction } from "../../src/handlers/dispatch.js";
import { isPaused } from "../../src/ops/alerts.js";
import { allowRequest } from "../../src/ops/rate.js";
import { scheduleAnswer } from "../../src/responders/direct.js";
import { loadAsker } from "../../src/wizzrobe/identity.js";

const asker = {
  discordUserId: "u1",
  discordName: "Ann",
  guildId: "g",
  channelId: "c",
  linked: null,
};

const thread = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  discordUserId: "u1",
  question: "q",
  decision: { route: "chat", confidence: 1, params: {}, reason: "x" },
  ephemeral: false,
  turns: [{ role: "user", text: "hi" }],
  createdAt: 0,
  expiresAt: 1,
  ...over,
});

let pending: Promise<unknown>[] = [];
const waitUntil = (p: Promise<unknown>) => {
  pending.push(p);
};
async function run(i: unknown) {
  const res = await handleInteraction(i as never, waitUntil);
  await Promise.all(pending);
  return res;
}
interface Body {
  type: number;
  data: {
    content: string;
    flags: number;
    allowed_mentions: unknown;
    custom_id: string;
    title: string;
    components: { components: unknown[] }[];
  };
}
const body = async (r: Response) => (await r.json()) as Body;

function command(name: string, options: unknown[] = []) {
  return {
    type: 2,
    token: "tok",
    member: { user: { id: "u1", username: "ann" } },
    data: { type: 1, name, options },
  };
}
function button(customId: string, userId = "u1") {
  return {
    type: 3,
    token: "tok",
    member: { user: { id: userId, username: "x" } },
    data: { custom_id: customId, component_type: 2 },
  };
}
function submit(customId: string, value = "and then?") {
  return {
    type: 5,
    token: "tok",
    member: { user: { id: "u1", username: "ann" } },
    data: {
      custom_id: customId,
      components: [{ type: 1, components: [{ type: 4, custom_id: "question", value }] }],
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  pending = [];
  vi.mocked(isPaused).mockResolvedValue(false);
  vi.mocked(allowRequest).mockResolvedValue(true);
  vi.mocked(loadAsker).mockResolvedValue(asker);
  vi.mocked(runAskPipeline).mockResolvedValue(undefined);
  vi.mocked(runComponent).mockResolvedValue(undefined);
  vi.mocked(deliver).mockResolvedValue(undefined);
  vi.mocked(deliverError).mockResolvedValue(undefined);
});

describe("handleInteraction", () => {
  it("answers PING", async () => {
    expect(await body(await run({ type: 1 }))).toEqual({ type: 1 });
  });

  it("rejects other types with 400", async () => {
    expect((await run({ type: 4 })).status).toBe(400);
  });

  it("answers type 4 when paused", async () => {
    vi.mocked(isPaused).mockResolvedValue(true);
    const b = await body(await run(command("ask")));
    expect(b.type).toBe(4);
    expect(b.data.content).toBe("Wizzbrew is paused right now.");
    expect(b.data.flags).toBe(64);
    expect(b.data.allowed_mentions).toEqual({ parse: [] });
    expect(runAskPipeline).not.toHaveBeenCalled();
  });

  it("/ask defers publicly and runs the pipeline", async () => {
    const b = await body(
      await run(command("ask", [{ name: "question", type: 3, value: "who is up?" }])),
    );
    expect(b).toEqual({ type: 5, data: { flags: 0 } });
    expect(runAskPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "who is up?",
        asker,
        history: [],
        reply: { kind: "interaction", token: "tok", ephemeral: false },
      }),
    );
  });

  it("/link defers privately with a forced account decision", async () => {
    const b = await body(await run(command("link")));
    expect(b).toEqual({ type: 5, data: { flags: 64 } });
    const req = vi.mocked(runAskPipeline).mock.calls[0]?.[0];
    expect(req?.forced).toEqual({
      route: "account",
      confidence: 1,
      params: { accountAction: "link" },
      reason: "shortcut /link",
    });
    expect(req?.reply).toEqual({ kind: "interaction", token: "tok", ephemeral: true });
  });

  it("/unlink forces unlink", async () => {
    await run(command("unlink"));
    expect(vi.mocked(runAskPipeline).mock.calls[0]?.[0].forced?.params.accountAction).toBe(
      "unlink",
    );
  });

  it("/schedule uses scheduleAnswer and deliver", async () => {
    const answer = { text: "sched", ephemeral: false };
    vi.mocked(scheduleAnswer).mockResolvedValue(answer);
    const b = await body(
      await run(command("schedule", [{ name: "stage", type: 3, value: "Main" }])),
    );
    expect(b).toEqual({ type: 5, data: { flags: 0 } });
    expect(scheduleAnswer).toHaveBeenCalledWith(
      { day: undefined, stage: "Main", tournament: undefined },
      expect.any(Date),
    );
    expect(deliver).toHaveBeenCalledWith(
      { kind: "interaction", token: "tok", ephemeral: false },
      answer,
      {},
    );
    expect(runAskPipeline).not.toHaveBeenCalled();
  });

  it("/schedule saves a thread when the answer has choices", async () => {
    const answer = { text: "which?", ephemeral: false, choices: [{ label: "A", value: "a" }] };
    vi.mocked(scheduleAnswer).mockResolvedValue(answer);
    vi.mocked(saveThread).mockResolvedValue(thread({ id: "tx" }) as never);
    await run(command("schedule", [{ name: "stage", type: 3, value: "Ma" }]));
    expect(saveThread).toHaveBeenCalledWith(
      expect.objectContaining({ discordUserId: "u1", ephemeral: false, turns: [] }),
      expect.any(Date),
    );
    expect(deliver).toHaveBeenCalledWith(expect.anything(), answer, { threadId: "tx" });
  });

  it("/schedule is rate limited", async () => {
    vi.mocked(allowRequest).mockResolvedValue(false);
    await run(command("schedule"));
    expect(scheduleAnswer).not.toHaveBeenCalled();
    expect(deliverError).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("faster"));
  });

  it("confirm presses honor the kill switch", async () => {
    vi.mocked(isPaused).mockResolvedValue(true);
    const b = await body(await run(button(encodeCustomId({ kind: "confirm", pendingId: "p1" }))));
    expect(b.type).toBe(4);
    expect(b.data.content).toBe("Wizzbrew is paused right now.");
    expect(runComponent).not.toHaveBeenCalled();
  });

  it("a non-owner's choose is deferred as its own ephemeral reply", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread() as never);
    const b = await body(
      await run(button(encodeCustomId({ kind: "choose", threadId: "t1", value: "a" }), "u2")),
    );
    expect(b).toEqual({ type: 5, data: { flags: 64 } });
    expect(runComponent).toHaveBeenCalled();
  });

  it("an expired thread on choose answers privately", async () => {
    vi.mocked(loadThread).mockResolvedValue("expired");
    const b = await body(
      await run(button(encodeCustomId({ kind: "choose", threadId: "t1", value: "a" }))),
    );
    expect(b.type).toBe(4);
    expect(b.data.flags).toBe(64);
    expect(runComponent).not.toHaveBeenCalled();
  });

  it("/me is private and forces my_stuff", async () => {
    const b = await body(await run(command("me")));
    expect(b.data.flags).toBe(64);
    expect(vi.mocked(runAskPipeline).mock.calls[0]?.[0].forced?.route).toBe("my_stuff");
  });

  it("/help answers at once, privately, with the static overview and no outside call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const b = await body(await run(command("help")));
    expect(b.type).toBe(4);
    expect(b.data.flags).toBe(64);
    expect(b.data.allowed_mentions).toEqual({ parse: [] });
    expect(b.data.content).toBe(helpText());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loadAsker).not.toHaveBeenCalled();
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(scheduleAnswer).not.toHaveBeenCalled();
    expect(saveThread).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
    expect(deliverError).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("/help honors the kill switch like every other command", async () => {
    vi.mocked(isPaused).mockResolvedValue(true);
    const b = await body(await run(command("help")));
    expect(b.data.content).toBe("Wizzbrew is paused right now.");
  });

  it("/live forces the live route", async () => {
    await run(command("live"));
    expect(vi.mocked(runAskPipeline).mock.calls[0]?.[0].forced?.route).toBe("live");
  });

  it("unknown command answers immediately", async () => {
    const b = await body(await run(command("nope")));
    expect(b.type).toBe(4);
    expect(b.data.content).toBe("I don't know that command.");
  });

  it("background errors go to deliverError", async () => {
    vi.mocked(runAskPipeline).mockRejectedValue(new Error("boom"));
    await run(command("live"));
    expect(deliverError).toHaveBeenCalledWith(
      { kind: "interaction", token: "tok", ephemeral: false },
      "Something went wrong on my side. Try again in a minute.",
    );
  });

  it("a bad day becomes a user message", async () => {
    await run(command("schedule", [{ name: "day", type: 3, value: "someday" }]));
    expect(deliverError).toHaveBeenCalledOnce();
    expect(scheduleAnswer).not.toHaveBeenCalled();
  });

  it("follow-up button opens a modal, including one left on an old public answer", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread({ ephemeral: false }) as never);
    const b = await body(await run(button(encodeCustomId({ kind: "followup", threadId: "t1" }))));
    expect(b.type).toBe(9);
    expect(b.data.custom_id).toBe("wb:followup:t1");
    expect(b.data.title).toBe("Ask a follow-up");
    expect(b.data.components[0]?.components[0]).toMatchObject({
      type: 4,
      custom_id: "question",
      style: 2,
      max_length: 500,
      required: true,
    });
  });

  it("expired and private threads answer type 4", async () => {
    vi.mocked(loadThread).mockResolvedValueOnce("expired");
    const id = encodeCustomId({ kind: "followup", threadId: "t1" });
    const a = await body(await run(button(id)));
    expect(a.type).toBe(4);
    expect(a.data.content).toBe("That conversation expired. Ask again.");
    vi.mocked(loadThread).mockResolvedValueOnce("not_yours");
    const b = await body(await run(button(id)));
    expect(b.data.content).toBe("That conversation is private.");
  });

  it("change takes the pending action then opens a modal", async () => {
    vi.mocked(takePending).mockResolvedValue({ id: "p1" } as never);
    const b = await body(
      await run(button(encodeCustomId({ kind: "change", pendingId: "p1", threadId: "t1" }))),
    );
    expect(takePending).toHaveBeenCalledWith("p1", "u1", expect.any(Date));
    expect(b.type).toBe(9);
    expect(b.data.title).toBe("What should change?");
    expect(b.data.custom_id).toBe("wb:followup:t1");
  });

  it("change by another user answers type 4", async () => {
    vi.mocked(takePending).mockResolvedValue("not_yours");
    const b = await body(
      await run(button(encodeCustomId({ kind: "change", pendingId: "p1", threadId: "t1" }), "u2")),
    );
    expect(b.type).toBe(4);
    expect(b.data.content).toBe("Only the person who asked can change this.");
  });

  it("change on an expired request answers type 4", async () => {
    vi.mocked(takePending).mockResolvedValue("expired");
    const b = await body(
      await run(button(encodeCustomId({ kind: "change", pendingId: "p1", threadId: "t1" }))),
    );
    expect(b.data.content).toBe("That request expired. Ask again.");
  });

  it("modal submit defers and runs the pipeline on the thread", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread({ ephemeral: true }) as never);
    const b = await body(await run(submit("wb:followup:t1")));
    expect(b).toEqual({ type: 5, data: { flags: 64 } });
    expect(runAskPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "and then?",
        history: [{ role: "user", text: "hi" }],
        threadId: "t1",
        reply: { kind: "interaction", token: "tok", ephemeral: true },
      }),
    );
  });

  it("modal submit on a public thread defers publicly", async () => {
    vi.mocked(loadThread).mockResolvedValue(thread() as never);
    expect((await body(await run(submit("wb:followup:t1")))).data.flags).toBe(0);
  });

  it("modal submit on an expired thread answers type 4", async () => {
    vi.mocked(loadThread).mockResolvedValue("expired");
    const b = await body(await run(submit("wb:followup:t1")));
    expect(b.type).toBe(4);
    expect(runAskPipeline).not.toHaveBeenCalled();
  });

  it("private button defers ephemerally and runs the component", async () => {
    const b = await body(await run(button("wb:private:t1")));
    expect(b).toEqual({ type: 5, data: { flags: 64 } });
    expect(runComponent).toHaveBeenCalledOnce();
  });

  it("confirm defers the update and runs the component", async () => {
    const b = await body(await run(button("wb:confirm:p1")));
    expect(b).toEqual({ type: 6 });
    expect(runComponent).toHaveBeenCalledOnce();
  });

  it("a bad custom_id answers type 4", async () => {
    const b = await body(await run(button("garbage")));
    expect(b.type).toBe(4);
    expect(b.data.content).toBe("That button isn't mine.");
  });
});
