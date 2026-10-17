import { describe, expect, it } from "vitest";
import { ROUTINE_NAMES, ROUTINE_PROMPTS } from "../../src/game/routines.js";

const dashes = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`);
const NOT_COVERED =
  "When the loaded material does not cover it, say so in one line rather than guessing.";

describe("ROUTINE_PROMPTS", () => {
  it("has one prompt for each routine", () => {
    expect([...ROUTINE_NAMES].sort()).toEqual([
      "dungeon",
      "general",
      "items",
      "logic",
      "overworld",
    ]);
    expect(Object.keys(ROUTINE_PROMPTS).sort()).toEqual([...ROUTINE_NAMES].sort());
  });

  it("is one short paragraph that ends by admitting a gap in one line", () => {
    for (const [name, text] of Object.entries(ROUTINE_PROMPTS)) {
      expect(text, name).not.toContain("\n");
      expect(text.length, name).toBeLessThan(700);
      expect(text.endsWith(NOT_COVERED), name).toBe(true);
      expect(text.startsWith(`Routine: ${name}`), name).toBe(true);
    }
  });

  it("has no sample phrasing, trailing question mark or dash", () => {
    for (const [name, text] of Object.entries(ROUTINE_PROMPTS)) {
      for (const bad of ["e.g.", "for example", "such as", '"', "“"]) {
        expect(text.toLowerCase(), `${name}: ${bad}`).not.toContain(bad);
      }
      expect(text.trimEnd().endsWith("?"), name).toBe(false);
      expect(dashes.test(text), name).toBe(false);
    }
  });

  it("states no setting, layout or shuffle assumption and names no game", () => {
    for (const [name, text] of Object.entries(ROUTINE_PROMPTS)) {
      for (const word of [
        "assum",
        "vanilla",
        "shuffle",
        "inverted",
        "standard mode",
        "alttp",
        "zelda",
        "metroid",
        "link to the past",
        "wizzrobe",
      ]) {
        expect(text.toLowerCase(), `${name}: ${word}`).not.toContain(word);
      }
    }
  });

  it("points the logic routine at the key door table and the others at their material", () => {
    expect(ROUTINE_PROMPTS.logic).toContain("key door table");
    expect(ROUTINE_PROMPTS.logic).toContain("no preamble");
    expect(ROUTINE_PROMPTS.dungeon).toContain("layout, boss, keys and enemies");
    expect(ROUTINE_PROMPTS.overworld).toContain("entrance lines");
    expect(ROUTINE_PROMPTS.items).toContain("upgrades or levels");
    expect(ROUTINE_PROMPTS.general).toContain("orientation summary");
  });
});
