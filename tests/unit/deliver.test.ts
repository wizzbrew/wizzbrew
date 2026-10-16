import { beforeEach, describe, expect, it } from "vitest";
import { setDiscordApiForTests } from "../../src/discord/api.js";
import { deliver, deliverError } from "../../src/handlers/deliver.js";
import type { Answer, ReplyTarget } from "../../src/types.js";
import { FakeDiscordApi } from "../fakes/discord.js";

let api: FakeDiscordApi;

function bodyOf<T>(i: number): T {
  const call = api.calls[i];
  if (!call) throw new Error(`no call at ${i}`);
  return call.body as T;
}

beforeEach(() => {
  api = new FakeDiscordApi();
  setDiscordApiForTests(api);
});

const pub: Answer = { text: "Hello there", ephemeral: false };
const priv: Answer = { text: "Just for you", ephemeral: true };
const ix = (ephemeral: boolean): ReplyTarget => ({ kind: "interaction", token: "tok", ephemeral });
const msg: ReplyTarget = { kind: "message", channelId: "chan", messageId: "m1" };

describe("deliver", () => {
  it("edits the original for a public interaction answer", async () => {
    await deliver(ix(false), pub, { threadId: "t1" });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(api.calls[0]?.token).toBe("tok");
    expect(bodyOf<{ content: string }>(0).content).toBe("Hello there");
  });

  it("sends extra chunks as followups, private when the deferral is private", async () => {
    const long: Answer = { text: `${"a".repeat(1500)}\n\n${"b".repeat(1500)}`, ephemeral: true };
    await deliver(ix(true), long, { threadId: "t1" });
    expect(api.calls[0]?.method).toBe("editOriginal");
    const rest = api.calls.slice(1);
    expect(rest.length).toBeGreaterThan(0);
    for (const c of rest) {
      expect(c.method).toBe("followup");
      expect((c.body as { flags: number }).flags).toBe(64);
    }
  });

  it("long public answers use unflagged followups", async () => {
    const long: Answer = { text: `${"a".repeat(1500)}\n\n${"b".repeat(1500)}`, ephemeral: false };
    await deliver(ix(false), long, {});
    const rest = api.calls.slice(1);
    expect(rest.length).toBeGreaterThan(0);
    expect(bodyOf<{ flags?: number }>(1).flags).toBeUndefined();
  });

  it("puts a private answer behind a public deferral", async () => {
    await deliver(ix(false), priv, { threadId: "t1" });
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(bodyOf<{ content: string }>(0).content).toBe("I sent you the answer privately.");
    expect(api.calls[1]?.method).toBe("followup");
    expect(bodyOf<{ flags: number }>(1).flags).toBe(64);
  });

  it("replies to a message publicly with a reference", async () => {
    await deliver(msg, pub, {});
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe("postMessage");
    expect(api.calls[0]?.body).toMatchObject({ channelId: "chan", replyToMessageId: "m1" });
  });

  it("posts a private stub for a private message answer", async () => {
    await deliver(msg, priv, { threadId: "t9" });
    expect(api.calls).toHaveLength(1);
    const body = bodyOf<{ body: { content: string } }>(0).body;
    expect(body.content).toBe("This one is just for you.");
    expect(JSON.stringify(body)).toContain("t9");
  });

  it("needs a thread id for a private message answer", async () => {
    await expect(deliver(msg, priv, {})).rejects.toThrow();
  });
});

describe("deliverError", () => {
  it("edits the original for an interaction", async () => {
    await deliverError(ix(false), "Nope");
    expect(api.calls[0]?.method).toBe("editOriginal");
    expect(bodyOf<{ content: string }>(0).content).toBe("Nope");
  });

  it("posts a reply for a message", async () => {
    await deliverError(msg, "Nope");
    expect(api.calls[0]?.body).toMatchObject({
      channelId: "chan",
      replyToMessageId: "m1",
      body: { content: "Nope", allowed_mentions: { parse: [] } },
    });
  });

  it("never throws when Discord fails", async () => {
    api.failNext(new Error("boom"));
    await expect(deliverError(ix(false), "Nope")).resolves.toBeUndefined();
  });
});
