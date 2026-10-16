import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAskPipeline } from "../../src/handlers/ask.js";
import { deliverError } from "../../src/handlers/deliver.js";
import { runMessagePipeline } from "../../src/handlers/message.js";
import type { Asker, RelayMessage } from "../../src/types.js";
import { loadAskerFromMessage } from "../../src/wizzrobe/identity.js";

vi.mock("../../src/wizzrobe/identity.js", () => ({ loadAskerFromMessage: vi.fn() }));
vi.mock("../../src/handlers/ask.js", () => ({ runAskPipeline: vi.fn() }));
vi.mock("../../src/handlers/deliver.js", () => ({ deliverError: vi.fn() }));

const NOW = new Date("2026-10-15T12:00:00Z");
const ASKER: Asker = {
  discordUserId: "1",
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
    author: { id: "1", username: "v", globalName: null, nick: null },
    content: "when is the next match",
    chain: [],
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(loadAskerFromMessage).mockReset().mockResolvedValue(ASKER);
  vi.mocked(runAskPipeline).mockReset().mockResolvedValue(undefined);
  vi.mocked(deliverError).mockReset().mockResolvedValue(undefined);
});

describe("runMessagePipeline", () => {
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
