import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildRelayMessage, cleanContent, shouldForward, sign } from "../src/forward.js";

const allow = new Set(["c1"]);
const base = {
  authorIsBot: false,
  isDm: false,
  mentionsBot: false,
  repliesToBot: false,
  channelId: "c1",
  parentId: null as string | null,
};

describe("shouldForward", () => {
  it("never forwards bots", () => {
    expect(
      shouldForward({ ...base, authorIsBot: true, isDm: true, mentionsBot: true }, allow),
    ).toBe(false);
  });
  it("always forwards DMs", () => {
    expect(shouldForward({ ...base, isDm: true, channelId: "x" }, allow)).toBe(true);
  });
  it("forwards a mention in an allowed channel", () => {
    expect(shouldForward({ ...base, mentionsBot: true }, allow)).toBe(true);
  });
  it("ignores a mention elsewhere", () => {
    expect(shouldForward({ ...base, mentionsBot: true, channelId: "x" }, allow)).toBe(false);
  });
  it("forwards a reply to the bot in a thread under an allowed parent", () => {
    expect(
      shouldForward({ ...base, repliesToBot: true, channelId: "t9", parentId: "c1" }, allow),
    ).toBe(true);
  });
  it("ignores a plain message", () => {
    expect(shouldForward(base, allow)).toBe(false);
  });
});

describe("cleanContent", () => {
  it("removes both mention forms", () => {
    expect(cleanContent("<@42> hello <@!42>", "42")).toBe("hello");
  });
  it("removes a leading @Wizzbrew", () => {
    expect(cleanContent("@Wizzbrew what is next", "42")).toBe("what is next");
  });
});

describe("buildRelayMessage", () => {
  const entry = (n: number) => ({
    authorId: `a${n}`,
    authorName: `n${n}`,
    isBot: false,
    content: `m${n}`,
  });
  it("caps the chain at 10 and keeps order", () => {
    const chain = Array.from({ length: 12 }, (_, i) => entry(i));
    const msg = buildRelayMessage({
      messageId: "m",
      channelId: "c1",
      guildId: "g",
      isDm: false,
      author: { id: "u", username: "u", globalName: null, nick: null },
      text: "<@42> hi",
      botId: "42",
      chain,
    });
    expect(msg.content).toBe("hi");
    expect(msg.chain).toHaveLength(10);
    expect(msg.chain.map((c) => c.authorId)).toEqual(chain.slice(2).map((c) => c.authorId));
  });
});

describe("sign", () => {
  it("matches an HMAC computed with node:crypto", () => {
    const secret = "s".repeat(32);
    const expected = createHmac("sha256", secret).update('1700000000.{"a":1}').digest("hex");
    expect(sign(secret, "1700000000", '{"a":1}')).toBe(expected);
  });
});
