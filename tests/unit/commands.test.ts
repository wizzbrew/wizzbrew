import { describe, expect, it } from "vitest";
import { COMMANDS, type CommandName } from "../../src/discord/commands.js";

// Built from code points so this file itself holds no dash characters.
const EM_OR_EN_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

// Compile-time check that this list and the CommandName union stay in step.
const EXPECTED_NAMES: Record<CommandName, true> = {
  ask: true,
  schedule: true,
  live: true,
  standings: true,
  player: true,
  link: true,
  unlink: true,
  me: true,
};

describe("COMMANDS", () => {
  it("matches the snapshot", () => {
    expect(COMMANDS).toMatchSnapshot();
  });

  it("has exactly the names in CommandName", () => {
    expect(COMMANDS.map((c) => c.name).sort()).toEqual(Object.keys(EXPECTED_NAMES).sort());
  });

  it("gives /player an optional name and an optional user option", () => {
    const player = COMMANDS.find((c) => c.name === "player");
    expect(player?.options).toEqual([
      { type: 3, name: "name", description: "The player's name", required: false },
      { type: 6, name: "user", description: "A Discord user", required: false },
    ]);
  });

  it("registers every command as a chat input command for guilds and DMs", () => {
    for (const command of COMMANDS) {
      expect(command.type).toBe(1);
      expect(command.integration_types).toEqual([0, 1]);
      expect(command.contexts).toEqual([0, 1, 2]);
    }
  });

  it("keeps every description under 100 characters with no dashes", () => {
    for (const command of COMMANDS) {
      expect(command.description.length).toBeGreaterThan(0);
      expect(command.description.length).toBeLessThan(100);
      expect(command.description).not.toMatch(EM_OR_EN_DASH);
      expect(command.description).not.toContain("-");
      for (const option of command.options ?? []) {
        expect(option.description.length).toBeGreaterThan(0);
        expect(option.description.length).toBeLessThan(100);
        expect(option.description).not.toMatch(EM_OR_EN_DASH);
        expect(option.description).not.toContain("-");
      }
    }
  });
});
