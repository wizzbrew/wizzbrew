import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAskPipeline } from "../../src/handlers/ask.js";
import { deliverError } from "../../src/handlers/deliver.js";
import { dmLimitMessage, runMessagePipeline } from "../../src/handlers/message.js";
import { dmCount, readDmLog, recordDm } from "../../src/store/dmlog.js";
import { keys } from "../../src/store/keys.js";
import { setKvForTests } from "../../src/store/kv.js";
import type { Asker, RelayMessage } from "../../src/types.js";
import { loadAskerFromMessage } from "../../src/wizzrobe/identity.js";
import { FakeKv } from "../fakes/kv.js";

vi.mock("../../src/wizzrobe/identity.js", () => ({ loadAskerFromMessage: vi.fn() }));
vi.mock("../../src/handlers/ask.js", () => ({ runAskPipeline: vi.fn() }));
vi.mock("../../src/handlers/deliver.js", () => ({ deliverError: vi.fn() }));

const NOW = new Date("2026-10-15T12:00:00Z");
const ASKER: Asker = {
  discordUserId: "111111111111111111",
  discordName: "Vince",
  guildId: "g",
  channelId: "c",
  linked: null,
};

function msg(over: Partial<RelayMessage> = {}): RelayMessage {
  return {
    messageId: "m1",
    channelId: "c1",
    guildId: "g",
    isDm: false,
    author: { id: "111111111111111111", username: "v", globalName: null, nick: null },
    content: "when is the next match",
    chain: [],
    ...over,
  };
}

let store: FakeKv;

beforeEach(() => {
  store = new FakeKv();
  setKvForTests(store);
  vi.mocked(loadAskerFromMessage).mockReset().mockResolvedValue(ASKER);
  vi.mocked(runAskPipeline).mockReset().mockResolvedValue(null);
  vi.mocked(deliverError).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  setKvForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("runMessagePipeline", () => {
  it("normalizes timestamps in the content and the chain", async () => {
    await runMessagePipeline(
      msg({
        content: "at <t:1792195200:f> ok",
        chain: [
          { authorId: "2", authorName: "Sam", isBot: false, content: "see <t:1792195200:f>" },
        ],
      }),
      "req",
      NOW,
    );
    const req = vi.mocked(runAskPipeline).mock.calls[0]?.[0];
    expect(req?.question).not.toContain("<t:");
    expect(req?.question).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(req?.history[0]?.text).not.toContain("<t:");
    expect(req?.history[0]?.text).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("maps the chain to turns and replies under the message", async () => {
    await runMessagePipeline(
      msg({
        chain: [
          { authorId: "2", authorName: "Sam", isBot: false, content: "who streams?" },
          { authorId: "9", authorName: "Wizzbrew", isBot: true, content: "Stage 1." },
        ],
      }),
      "req",
      NOW,
    );
    const req = vi.mocked(runAskPipeline).mock.calls[0]?.[0];
    expect(req?.history).toEqual([
      { role: "user", text: "Sam: who streams?" },
      { role: "assistant", text: "Stage 1." },
    ]);
    expect(req?.reply).toEqual({ kind: "message", channelId: "c1", messageId: "m1" });
    expect(req?.question).toBe("when is the next match");
    expect(req?.requestId).toBe("req");
    expect(req?.asker).toBe(ASKER);
  });

  it("keeps the last 10 turns", async () => {
    const chain = Array.from({ length: 12 }, (_, i) => ({
      authorId: "2",
      authorName: "Sam",
      isBot: false,
      content: `t${i}`,
    }));
    await runMessagePipeline(msg({ chain }), "req", NOW);
    const history = vi.mocked(runAskPipeline).mock.calls[0]?.[0].history ?? [];
    expect(history).toHaveLength(10);
    expect(history[0]?.text).toBe("Sam: t2");
    expect(history[9]?.text).toBe("Sam: t11");
  });

  it("gives an empty mention a placeholder question", async () => {
    await runMessagePipeline(msg({ content: "   " }), "req", NOW);
    expect(vi.mocked(runAskPipeline).mock.calls[0]?.[0].question).toBe(
      "(the asker mentioned you without saying anything else)",
    );
  });

  it("delivers an error to the message when identity fails", async () => {
    vi.mocked(loadAskerFromMessage).mockRejectedValue(new Error("boom"));
    await runMessagePipeline(msg(), "req", NOW);
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(deliverError).toHaveBeenCalledWith(
      { kind: "message", channelId: "c1", messageId: "m1" },
      expect.any(String),
    );
  });
});

describe("the DM log and the daily DM cap", () => {
  const DAY = "2026-10-15";
  const USER = "111111111111111111";
  const DELIVERED = { route: "schedule", text: "Stage 1 has two matches tonight." };

  function dm(over: Partial<RelayMessage> = {}) {
    return msg({ isDm: true, guildId: null, ...over });
  }

  function fillTo(count: number) {
    return Promise.all(
      Array.from({ length: count }, () =>
        recordDm({
          day: DAY,
          userId: USER,
          userName: "Vince",
          question: "earlier",
          route: "chat",
          response: "ok",
        }),
      ),
    );
  }

  it("records a DM with the question, the route and the final answer text", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await runMessagePipeline(dm(), "req", NOW);
    const view = await readDmLog(DAY);
    expect(view.total).toBe(1);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]).toMatchObject({
      userId: USER,
      userName: "Vince",
      question: "when is the next match",
      route: "schedule",
      response: "Stage 1 has two matches tonight.",
    });
    expect(deliverError).not.toHaveBeenCalled();
  });

  it("records the answer text, not the prompt or the history", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await runMessagePipeline(
      dm({ chain: [{ authorId: "2", authorName: "Sam", isBot: false, content: "earlier turn" }] }),
      "req",
      NOW,
    );
    const [entry] = (await readDmLog(DAY)).entries;
    expect(JSON.stringify(entry)).not.toContain("earlier turn");
  });

  it("files the DM under the community day, not the UTC day", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    // 02:00 UTC on the 16th is 22:00 on the 15th in New York.
    await runMessagePipeline(dm(), "req", new Date("2026-10-16T02:00:00Z"));
    expect(await dmCount("2026-10-15", USER)).toBe(1);
    expect(await dmCount("2026-10-16", USER)).toBe(0);
  });

  it("does not record or count a message that is not a DM", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    const reads = vi.spyOn(store, "hget");
    await runMessagePipeline(msg(), "req", NOW);
    expect(reads).not.toHaveBeenCalled();
    expect(store.keys().filter((k) => k.includes(":dm"))).toEqual([]);
  });

  it("does not record a DM whose answer failed", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(null);
    await runMessagePipeline(dm(), "req", NOW);
    expect(await dmCount(DAY, USER)).toBe(0);
  });

  it("answers while the count is under the limit", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await fillTo(4);
    await runMessagePipeline(dm(), "req", NOW);
    expect(runAskPipeline).toHaveBeenCalledTimes(1);
    expect(await dmCount(DAY, USER)).toBe(5);
  });

  it("refuses at the limit with one plain line, records the attempt, and does not ask", async () => {
    await fillTo(5);
    await runMessagePipeline(dm(), "req", NOW);
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(loadAskerFromMessage).not.toHaveBeenCalled();
    expect(deliverError).toHaveBeenCalledTimes(1);
    expect(deliverError).toHaveBeenCalledWith(
      { kind: "message", channelId: "c1", messageId: "m1" },
      "You've reached today's DM limit of 5. The channel is the normal place to ask, so ask there instead.",
    );
    const view = await readDmLog(DAY);
    const last = view.entries[view.entries.length - 1];
    expect(last).toMatchObject({
      userId: USER,
      userName: "v",
      question: "when is the next match",
      route: "rate_limited",
      response: "",
    });
    expect(view.total).toBe(6);
  });

  it("keeps refusing on later attempts the same day", async () => {
    await fillTo(5);
    await runMessagePipeline(dm({ messageId: "m2" }), "req1", NOW);
    await runMessagePipeline(dm({ messageId: "m3" }), "req2", NOW);
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(deliverError).toHaveBeenCalledTimes(2);
  });

  it("counts each person on their own", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await fillTo(5);
    const other = "222222222222222222";
    await runMessagePipeline(
      dm({ author: { id: other, username: "o", globalName: null, nick: null } }),
      "req",
      NOW,
    );
    expect(runAskPipeline).toHaveBeenCalledTimes(1);
  });

  it("lets the next day start fresh", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await fillTo(5);
    await runMessagePipeline(dm(), "req", new Date("2026-10-16T12:00:00Z"));
    expect(runAskPipeline).toHaveBeenCalledTimes(1);
  });

  it("reads the limit from DM_DAILY_LIMIT", async () => {
    vi.stubEnv("DM_DAILY_LIMIT", "2");
    await fillTo(2);
    await runMessagePipeline(dm(), "req", NOW);
    expect(runAskPipeline).not.toHaveBeenCalled();
    expect(vi.mocked(deliverError).mock.calls[0]?.[1]).toBe(dmLimitMessage(2));
    expect(dmLimitMessage(2)).toContain("limit of 2");
  });

  it("never lets a failure to record break the answer", async () => {
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    vi.spyOn(store, "rpush").mockRejectedValue(new Error("redis down"));
    await runMessagePipeline(dm(), "req", NOW);
    expect(runAskPipeline).toHaveBeenCalledTimes(1);
    expect(deliverError).not.toHaveBeenCalled();
    const logged = out.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain('"level":"warn"');
    expect(logged).toContain("dm.record_failed");
    expect(logged).not.toContain("Stage 1 has two matches");
  });

  it("still sends the refusal when recording the refused attempt fails", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await fillTo(5);
    vi.spyOn(store, "rpush").mockRejectedValue(new Error("redis down"));
    await runMessagePipeline(dm(), "req", NOW);
    expect(deliverError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deliverError).mock.calls[0]?.[1]).toContain("DM limit");
  });

  it("writes only the two DM keys", async () => {
    vi.mocked(runAskPipeline).mockResolvedValue(DELIVERED);
    await runMessagePipeline(dm(), "req", NOW);
    expect(store.keys().sort()).toEqual([keys.dmCount(DAY), keys.dmLog(DAY)].sort());
  });
});
