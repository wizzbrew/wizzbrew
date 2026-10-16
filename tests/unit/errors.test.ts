import { describe, expect, it } from "vitest";
import {
  BudgetExceededError,
  DiscordError,
  ModelOutputError,
  NotImplemented,
  NotLinkedError,
  UserInputError,
  userMessageFor,
  WizzrobeError,
} from "../../src/errors.js";

// Built from code points so this file itself holds no dash characters.
const EM_OR_EN_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe("userMessageFor", () => {
  it("UserInputError: its own message", () => {
    expect(userMessageFor(new UserInputError("I couldn't read that time."))).toBe(
      "I couldn't read that time.",
    );
  });

  it("NotLinkedError: its message when non-empty", () => {
    expect(userMessageFor(new NotLinkedError("Link first, then ask again."))).toBe(
      "Link first, then ask again.",
    );
  });

  it("NotLinkedError: the default when the message is empty", () => {
    expect(userMessageFor(new NotLinkedError())).toBe(
      "Run /link first to connect your Wizzrobe account.",
    );
  });

  it("BudgetExceededError", () => {
    expect(userMessageFor(new BudgetExceededError("cap hit"))).toBe(
      "I've hit today's usage limit. Try again tomorrow.",
    );
  });

  it("WizzrobeError 429", () => {
    expect(userMessageFor(new WizzrobeError(429, "slow down", 30))).toBe(
      "Wizzrobe is busy, try again in a minute.",
    );
  });

  it("WizzrobeError 401", () => {
    expect(userMessageFor(new WizzrobeError(401, "token expired"))).toBe(
      "Your Wizzrobe link expired. Run /link to connect again.",
    );
  });

  it("WizzrobeError 403 includes the detail", () => {
    expect(userMessageFor(new WizzrobeError(403, "Staff access required"))).toBe(
      "Your Wizzrobe account can't do that (Staff access required).",
    );
  });

  it("WizzrobeError 404 with 'not enabled' in the detail", () => {
    expect(
      userMessageFor(new WizzrobeError(404, "This feature is not enabled for this community.")),
    ).toBe("That feature is not turned on for this event.");
  });

  it("WizzrobeError 404 otherwise", () => {
    expect(userMessageFor(new WizzrobeError(404, "Match 9 does not exist"))).toBe(
      "Wizzrobe couldn't find that.",
    );
  });

  it("WizzrobeError 400 includes the detail", () => {
    expect(userMessageFor(new WizzrobeError(400, "match already started"))).toBe(
      "Wizzrobe turned that down: match already started",
    );
  });

  it.each([500, 502, 503, 418])("WizzrobeError %i is the generic Wizzrobe message", (status) => {
    expect(userMessageFor(new WizzrobeError(status, "boom"))).toBe(
      "Wizzrobe is having trouble right now. Try again in a minute.",
    );
  });

  it("ModelOutputError", () => {
    expect(userMessageFor(new ModelOutputError("refusal", "model refused"))).toBe(
      "I couldn't put an answer together for that. Try asking another way.",
    );
  });

  it("DiscordError includes the message", () => {
    expect(userMessageFor(new DiscordError(403, "Missing Permissions: Send Messages"))).toBe(
      "I couldn't post that in Discord (Missing Permissions: Send Messages).",
    );
  });

  it.each([
    ["a plain Error", new Error("boom")],
    ["NotImplemented", new NotImplemented("x.y")],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("anything else (%s)", (_label, err) => {
    expect(userMessageFor(err)).toBe("Something went wrong on my side. Try again in a minute.");
  });

  it("no output contains an em or en dash and no raw status code", () => {
    const outputs = [
      userMessageFor(new UserInputError("plain")),
      userMessageFor(new NotLinkedError()),
      userMessageFor(new BudgetExceededError()),
      userMessageFor(new WizzrobeError(429, "x")),
      userMessageFor(new WizzrobeError(401, "x")),
      userMessageFor(new WizzrobeError(403, "x")),
      userMessageFor(new WizzrobeError(404, "not enabled")),
      userMessageFor(new WizzrobeError(404, "x")),
      userMessageFor(new WizzrobeError(400, "x")),
      userMessageFor(new WizzrobeError(500, "x")),
      userMessageFor(new ModelOutputError("max_tokens", "x")),
      userMessageFor(new DiscordError(403, "x")),
      userMessageFor(new Error("x")),
    ];
    for (const out of outputs) {
      expect(out).not.toMatch(EM_OR_EN_DASH);
      expect(out).not.toMatch(/\b(401|403|404|429|500)\b/);
    }
  });
});

describe("error classes", () => {
  it("WizzrobeError keeps status, detail and retryAfterSec", () => {
    const e = new WizzrobeError(429, "slow down", 12);
    expect(e.status).toBe(429);
    expect(e.detail).toBe("slow down");
    expect(e.retryAfterSec).toBe(12);
    expect(e.message).toBe("slow down");
  });

  it("ModelOutputError keeps the stop reason", () => {
    const e = new ModelOutputError("max_tokens", "cut off");
    expect(e.stopReason).toBe("max_tokens");
    expect(e.message).toBe("cut off");
  });

  it("DiscordError keeps the status", () => {
    const e = new DiscordError(403, "Missing Access");
    expect(e.status).toBe(403);
    expect(e.message).toBe("Missing Access");
  });
});
