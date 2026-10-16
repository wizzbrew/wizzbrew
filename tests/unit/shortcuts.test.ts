import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { describe, expect, it } from "vitest";
import { UserInputError } from "../../src/errors.js";
import { shortcutRequest } from "../../src/handlers/shortcuts.js";

const NOW = new Date("2026-10-15T18:00:00Z");

function cmd(
  name: string,
  options: { name: string; type: number; value: string }[] = [],
  resolved?: unknown,
): APIChatInputApplicationCommandInteraction {
  return { data: { name, type: 1, options, resolved } } as never;
}

describe("shortcutRequest", () => {
  it("live", () => {
    const r = shortcutRequest(cmd("live"), NOW);
    expect(r?.decision).toEqual({
      route: "live",
      confidence: 1,
      params: {},
      reason: "shortcut /live",
    });
    expect(r?.question).toBe("What is live on each stage now, and what is next");
  });

  it("standings", () => {
    const r = shortcutRequest(
      cmd("standings", [{ name: "tournament", type: 3, value: "ALttPR" }]),
      NOW,
    );
    expect(r?.decision.route).toBe("standings");
    expect(r?.decision.params).toEqual({ tournament: "ALttPR" });
    expect(r?.question).toBe("Standings for ALttPR");
  });

  it("player by name", () => {
    const r = shortcutRequest(cmd("player", [{ name: "name", type: 3, value: "Zed" }]), NOW);
    expect(r?.decision.route).toBe("players");
    expect(r?.decision.params).toEqual({ player: "Zed" });
    expect(r?.question).toBe("Matches and results for Zed");
  });

  it("player from a user option prefers nick, then global name, then username", () => {
    const opt = [{ name: "user", type: 6, value: "42" }];
    const nick = shortcutRequest(
      cmd("player", opt, {
        users: { "42": { username: "u", global_name: "G" } },
        members: { "42": { nick: "N" } },
      }),
      NOW,
    );
    expect(nick?.decision.params.player).toBe("N");
    const global = shortcutRequest(
      cmd("player", opt, { users: { "42": { username: "u", global_name: "G" } } }),
      NOW,
    );
    expect(global?.decision.params.player).toBe("G");
    const plain = shortcutRequest(
      cmd("player", opt, { users: { "42": { username: "u", global_name: null } } }),
      NOW,
    );
    expect(plain?.decision.params.player).toBe("u");
  });

  it("player with nothing throws", () => {
    expect(() => shortcutRequest(cmd("player"), NOW)).toThrow(UserInputError);
  });

  it("me", () => {
    const r = shortcutRequest(cmd("me"), NOW);
    expect(r?.decision.route).toBe("my_stuff");
    expect(r?.decision.reason).toBe("shortcut /me");
    expect(r?.question).toBe("Show my upcoming matches, signups, volunteer shifts and requests.");
  });

  it("schedule with parts", () => {
    const r = shortcutRequest(
      cmd("schedule", [
        { name: "day", type: 3, value: "2026-10-17" },
        { name: "stage", type: 3, value: "Main" },
        { name: "tournament", type: 3, value: "Beer League" },
      ]),
      NOW,
    );
    expect(r?.decision.route).toBe("schedule");
    expect(r?.decision.params).toEqual({
      day: "2026-10-17",
      stage: "Main",
      tournament: "Beer League",
    });
    expect(r?.question).toContain("Show the schedule");
    expect(r?.question).toContain("Main");
  });

  it("plain schedule", () => {
    const r = shortcutRequest(cmd("schedule"), NOW);
    expect(r?.decision.params).toEqual({});
    expect(r?.question).toBe("Show the schedule");
  });

  it("bad day throws", () => {
    expect(() =>
      shortcutRequest(cmd("schedule", [{ name: "day", type: 3, value: "someday" }]), NOW),
    ).toThrow(UserInputError);
  });

  it("other commands are null", () => {
    expect(shortcutRequest(cmd("ask"), NOW)).toBeNull();
    expect(shortcutRequest(cmd("link"), NOW)).toBeNull();
  });
});
