import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildRelayMessage,
  cleanContent,
  formatIgnoredLog,
  ignoreReason,
  isBotMention,
  mentionsBotName,
  shouldForward,
  sign,
} from "../src/forward.js";

const allow = new Set(["c1"]);
const base = {
  authorIsBot: false,
  isDm: false,
  mentionsBot: false,
  repliesToBot: false,
  channelId: "c1",
  parentId: null as string | null,
  isMemberOfAllowedGuild: true,
};

describe("shouldForward", () => {
  it("never forwards bots", () => {
    expect(
      shouldForward({ ...base, authorIsBot: true, isDm: true, mentionsBot: true }, allow),
    ).toBe(false);
  });
  it("forwards a DM from a guild member", () => {
    expect(shouldForward({ ...base, isDm: true, channelId: "x" }, allow)).toBe(true);
  });
  it("refuses a DM from a non-member", () => {
    expect(
      shouldForward({ ...base, isDm: true, channelId: "x", isMemberOfAllowedGuild: false }, allow),
    ).toBe(false);
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

describe("ignoreReason", () => {
  const ib = { ...base, nameInContent: false };
  it("is null when the message is forwarded", () => {
    expect(ignoreReason({ ...ib, mentionsBot: true }, allow)).toBeNull();
    expect(ignoreReason({ ...ib, isDm: true, channelId: "x" }, allow)).toBeNull();
  });
  it("is null for ordinary chatter that was not aimed at the bot", () => {
    expect(ignoreReason(ib, allow)).toBeNull();
    expect(ignoreReason({ ...ib, channelId: "x" }, allow)).toBeNull();
  });
  it("reports channel_not_allowed for a mention or reply outside the allow list", () => {
    expect(ignoreReason({ ...ib, mentionsBot: true, channelId: "x" }, allow)).toBe(
      "channel_not_allowed",
    );
    expect(ignoreReason({ ...ib, repliesToBot: true, channelId: "x" }, allow)).toBe(
      "channel_not_allowed",
    );
  });
  it("reports not_mention_or_reply when only the name appeared", () => {
    expect(ignoreReason({ ...ib, nameInContent: true }, allow)).toBe("not_mention_or_reply");
    expect(ignoreReason({ ...ib, nameInContent: true, channelId: "x" }, allow)).toBe(
      "not_mention_or_reply",
    );
  });
  it("reports dm_not_member for a DM from a non-member", () => {
    expect(
      ignoreReason({ ...ib, isDm: true, channelId: "x", isMemberOfAllowedGuild: false }, allow),
    ).toBe("dm_not_member");
  });
  it("reports bot_author for another bot that mentions or DMs the bot", () => {
    expect(ignoreReason({ ...ib, authorIsBot: true, mentionsBot: true }, allow)).toBe("bot_author");
    expect(ignoreReason({ ...ib, authorIsBot: true, isDm: true }, allow)).toBe("bot_author");
  });
  it("agrees with shouldForward across every input combination", () => {
    const flags = [false, true];
    for (const authorIsBot of flags)
      for (const isDm of flags)
        for (const mentionsBot of flags)
          for (const repliesToBot of flags)
            for (const nameInContent of flags)
              for (const isMemberOfAllowedGuild of flags)
                for (const channelId of ["c1", "x"]) {
                  const m = {
                    authorIsBot,
                    isDm,
                    mentionsBot,
                    repliesToBot,
                    nameInContent,
                    isMemberOfAllowedGuild,
                    channelId,
                    parentId: null,
                  };
                  const reason = ignoreReason(m, allow);
                  if (shouldForward(m, allow)) expect(reason).toBeNull();
                  else if (isDm || mentionsBot || repliesToBot || nameInContent) {
                    expect(reason).not.toBeNull();
                  } else expect(reason).toBeNull();
                }
  });
});

describe("mentionsBotName", () => {
  it("matches the username or display name case-insensitively", () => {
    expect(mentionsBotName("hey @wizzbrew what is next", ["Wizzbrew", null])).toBe(true);
    expect(mentionsBotName("hey WIZZBREW", [undefined, "Wizzbrew"])).toBe(true);
  });
  it("does not match when no name appears or the names are empty", () => {
    expect(mentionsBotName("what is next", ["Wizzbrew"])).toBe(false);
    expect(mentionsBotName("anything", ["", "  ", null, undefined])).toBe(false);
  });
});

describe("formatIgnoredLog", () => {
  it("writes ids and flags only, with guild=dm for a DM", () => {
    const line = formatIgnoredLog({
      reason: "dm_not_member",
      channelId: "c9",
      guildId: null,
      messageId: "m1",
      authorId: "u1",
      mention: false,
      reply: false,
    });
    expect(line).toBe(
      "ignored reason=dm_not_member channel=c9 guild=dm message=m1 author=u1 mention=false reply=false",
    );
  });
  it("writes the guild id for a guild message", () => {
    const line = formatIgnoredLog({
      reason: "not_mention_or_reply",
      channelId: "c1",
      guildId: "g1",
      messageId: "m2",
      authorId: "u2",
      mention: false,
      reply: true,
    });
    expect(line).toBe(
      "ignored reason=not_mention_or_reply channel=c1 guild=g1 message=m2 author=u2 mention=false reply=true",
    );
  });
});

describe("isBotMention", () => {
  it("counts a user mention", () => {
    expect(isBotMention(true, [], "42")).toBe(true);
  });
  it("counts a mention of the bot's own managed role", () => {
    expect(isBotMention(false, ["42"], "42")).toBe(true);
  });
  it("does not count an unrelated role, including one tagged for another bot", () => {
    expect(isBotMention(false, ["77"], "42")).toBe(false);
  });
  it("does not count no mention (a plain role, @everyone or @here carries no bot tag)", () => {
    expect(isBotMention(false, [], "42")).toBe(false);
  });
});

describe("cleanContent", () => {
  it("removes both mention forms", () => {
    expect(cleanContent("<@42> hello <@!42>", "42")).toBe("hello");
  });
  it("removes the bot's managed role mention but leaves other role mentions", () => {
    expect(cleanContent("<@&900> what is next <@&901>", "42", ["900"])).toBe(
      "what is next <@&901>",
    );
  });
  it("leaves role mentions alone when no bot role is given", () => {
    expect(cleanContent("<@&900> hi", "42")).toBe("<@&900> hi");
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
  it("strips the bot's managed role mention from the forwarded text", () => {
    const msg = buildRelayMessage({
      messageId: "m",
      channelId: "c1",
      guildId: "g",
      isDm: false,
      author: { id: "u", username: "u", globalName: null, nick: null },
      text: "<@&900> when is the next match",
      botId: "42",
      botRoleIds: ["900"],
      chain: [],
    });
    expect(msg.content).toBe("when is the next match");
  });
});

describe("sign", () => {
  it("matches an HMAC computed with node:crypto", () => {
    const secret = "s".repeat(32);
    const expected = createHmac("sha256", secret).update('1700000000.{"a":1}').digest("hex");
    expect(sign(secret, "1700000000", '{"a":1}')).toBe(expected);
  });
});
