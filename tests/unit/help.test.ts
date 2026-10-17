import { describe, expect, it } from "vitest";
import { COMMANDS } from "../../src/discord/commands.js";
import { helpText } from "../../src/discord/help.js";

// Built from code points so this file itself holds no dash characters.
const EM_OR_EN_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe("helpText", () => {
  it("names and describes every registered command except help", () => {
    const text = helpText();
    const others = COMMANDS.filter((c) => c.name !== "help");
    expect(others.length).toBeGreaterThan(0);
    for (const command of others) {
      expect(text).toContain(`/${command.name}`);
      expect(text).toContain(command.description);
    }
    expect(text).not.toContain("/help");
  });

  it("stays under 1800 characters", () => {
    expect(helpText().length).toBeLessThan(1800);
  });

  it("has no em or en dash and no broadcast mention", () => {
    const text = helpText();
    expect(text).not.toMatch(EM_OR_EN_DASH);
    expect(text).not.toContain("@everyone");
    expect(text).not.toContain("@here");
  });

  it("explains how else to reach the bot, linking, privacy and what it reads", () => {
    const text = helpText();
    expect(text).toContain("@mention");
    expect(text).toContain("Reply to one of my messages");
    expect(text).toContain("DM");
    expect(text).toContain("**/link**");
    expect(text).toContain("visible only to the person who asked");
    expect(text).toContain("only read messages that mention me, reply to me, or are sent to me");
  });

  it("is deterministic", () => {
    expect(helpText()).toBe(helpText());
  });
});
