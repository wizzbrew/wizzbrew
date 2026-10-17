import { describe, expect, it } from "vitest";
import { buildGameData, readGameSources } from "../../scripts/build-game.js";
import { AREAS, BOSSES } from "../../src/game/catalog.js";
import { GAME_DATA } from "../../src/game/data.js";

// Built from char codes so this file passes the dash scan.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `level${n}`);

// Zelda 1 has no keys.json: its logic/<key>.md files are written by hand and travel as they are.
describe("Zelda 1 Randomizer data", () => {
  const sources = readGameSources();
  const z1rPaths = Object.keys(GAME_DATA).filter((p) => p.startsWith("z1r/"));
  const z1r = (path: string): string => GAME_DATA[`z1r/${path}`] ?? "";

  it("matches what the build script would produce from prompts/", () => {
    expect(GAME_DATA).toEqual(buildGameData(sources));
  });

  it("holds the orientation, the overworld, the items and every level's notes and rules", () => {
    for (const path of ["general.md", "overworld.md", "items.md"]) {
      expect(GAME_DATA[`z1r/${path}`], path).toBeDefined();
    }
    for (const key of LEVELS) {
      expect(GAME_DATA[`z1r/dungeons/${key}.md`], key).toBeDefined();
      expect(GAME_DATA[`z1r/logic/${key}.md`], key).toBeDefined();
    }
    expect(z1rPaths).toHaveLength(3 + 2 * LEVELS.length);
    expect(GAME_DATA["z1r/logic/keys.json"]).toBeUndefined();
    expect(
      AREAS.filter((a) => a.game === "z1r")
        .map((a) => a.key)
        .sort(),
    ).toEqual([...LEVELS].sort());
  });

  it("carries the hand-written logic files exactly as they are on disk", () => {
    for (const key of LEVELS) {
      expect(GAME_DATA[`z1r/logic/${key}.md`], key).toBe(sources[`z1r/logic/${key}.md`]);
    }
  });

  it("gives every file at least a few hundred characters", () => {
    for (const path of z1rPaths) {
      expect((GAME_DATA[path] ?? "").length, path).toBeGreaterThan(300);
    }
  });

  it("keeps the orientation under 8000 characters", () => {
    expect(z1r("general.md").length).toBeGreaterThan(3000);
    expect(z1r("general.md").length).toBeLessThan(8000);
  });

  it("tells the story, the second quest, the talk, the lines, ten fun facts and the randomizer", () => {
    const general = z1r("general.md");
    for (const s of [
      "## The story",
      "## The second quest",
      "## How players talk about it",
      "## The famous lines",
      "## Ten fun facts",
      "10. In Z1R slang",
      "## The randomizer in short",
      "IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
      "Fred Coughlin",
      "closed source",
      "walking every reachable room with the current inventory until nothing new appears",
      "Rookie Rumble 2026",
      "Consternation",
      "version 3.6.4",
      "the Magical Sword at 10 hearts",
      "Triforce Triple Play",
      "racetime.gg/z1r",
      "raceroom.z1rracing.com",
    ]) {
      expect(general, s).toContain(s);
    }
  });

  it("says nothing about the SpeedGaming Live 2026 Zelda 1 flags", () => {
    for (const path of z1rPaths) {
      const text = GAME_DATA[path] ?? "";
      expect(text, path).not.toMatch(/SGL|sgl26|Fall Tournament|z1r2026/);
    }
  });

  it("gives every level a heading with its code and the same set of notes", () => {
    for (const key of LEVELS) {
      const notes = z1r(`dungeons/${key}.md`);
      expect(notes.startsWith("# "), key).toBe(true);
      expect(notes.split("\n")[0], key).toContain(`(\`${key}\`)`);
      for (const s of [
        "- **Shape:**",
        "- **Boss:**",
        "- **Vanilla items:**",
        "- **Vanilla access:**",
        "- **Boss requirement:**",
        "- **Hint phrases:**",
      ]) {
        expect(notes, `${key} ${s}`).toContain(s);
      }
    }
  });

  it("gives every level's rules an entry rule, what is inside and its guarantees", () => {
    for (const key of LEVELS) {
      const rules = z1r(`logic/${key}.md`);
      expect(rules.split("\n")[0], key).toContain(`(\`${key}\`)`);
      expect(rules, key).toContain("## Entry rule");
      expect(rules, key).toContain("## Inside the level");
      expect(rules, key).toContain("## Guarantees that mention this level");
    }
  });

  it("names every boss in the notes of the level the catalog sends it to", () => {
    const bosses = BOSSES.filter((b) => b.game === "z1r");
    expect(bosses).toHaveLength(9);
    for (const boss of bosses) {
      expect(z1r(`dungeons/${boss.area}.md`), boss.key).toContain(boss.name);
    }
  });

  it("holds each level's shape, vanilla items and gate", () => {
    const expected: [string, string[]][] = [
      ["level1", ["Eagle", "Aquamentus", "Bow", "Boomerang", "no item gate"]],
      ["level2", ["Moon", "Dodongo", "Magical Boomerang"]],
      ["level3", ["Manji", "Manhandla", "Raft"]],
      ["level4", ["Snake", "Gleeok", "Stepladder", "the Raft"]],
      ["level5", ["Lizard", "Digdogger", "Recorder"]],
      ["level6", ["Dragon", "Gohma", "Magic Wand", "arrows"]],
      ["level7", ["Demon", "Hungry Goriya", "Red Candle", "Bait", "the Recorder"]],
      ["level8", ["Lion", "Magic Book", "Magic Key", "the Candle", "Gleeok Returns"]],
      ["level9", ["Death Mountain", "Silver Arrows", "Red Ring", "eight Triforce pieces", "Patra"]],
    ];
    for (const [key, words] of expected) {
      for (const w of words) expect(z1r(`dungeons/${key}.md`), `${key} ${w}`).toContain(w);
    }
  });

  it("keeps the guarantees in the logic notes of the level they name", () => {
    expect(z1r("logic/level7.md")).toContain("Ladder");
    expect(z1r("logic/level7.md")).toContain("in unshuffled rooms that covers Level 7");
    expect(z1r("logic/level4.md")).toContain("Raft is never placed on an island");
    expect(z1r("logic/level5.md")).toContain("Digdogger must be killed");
    expect(z1r("logic/level6.md")).toContain("Gohma must be killed");
    expect(z1r("logic/level8.md")).toContain("Magic Key room");
    expect(z1r("logic/level9.md")).toContain("Allow Important Items in 9");
    expect(z1r("logic/level9.md")).toContain("Raft, Ladder, Recorder, Bow and Power Bracelet");
  });

  it("holds the hint tables, the dungeon access table and the Level 9 facts", () => {
    const overworld = z1r("overworld.md");
    for (const s of [
      "## Dungeon access",
      "A Feat of Strength Will Lead To [item]",
      "Sail Not to Save the Princess / Sail Across the Water",
      "Play a Melody to Obtain [item]",
      "Fire the Arrow to Obtain [item]",
      "Step Over the Water to Obtain [item]",
      "Aquamentus Awaits (Level 1)",
      "Gleeok Returns (8)",
      "## Level 9 facts",
      "-ROAR-",
    ]) {
      expect(overworld, s).toContain(s);
    }
  });

  it("holds the items table, the heart thresholds and the item pool", () => {
    const items = z1r("items.md");
    for (const s of [
      "| Magic Key |",
      "| Silver Arrows |",
      "5 in vanilla",
      "12 hearts in vanilla",
      "White Sword to 4 to 6 and the Magical Sword to 10 to 14",
      "## The item pool and start items",
      "Book, Boomerang, Bow, Heart Container, Ladder, Magical Boomerang, Magical Key",
      "0 to 8 Triforces",
    ]) {
      expect(items, s).toContain(s);
    }
  });

  it("drops the confidence tags, the unverified sections and the validator illustration", () => {
    for (const path of z1rPaths) {
      const text = GAME_DATA[path] ?? "";
      expect(text, path).not.toMatch(/\((?:V|I|G|U|V, I|V, G)\)/);
      for (const s of ["Not verified", "unverified", "tetraly", "validator", "(U)"]) {
        expect(text, `${path} ${s}`).not.toContain(s);
      }
    }
  });

  it("has no em or en dashes in any Zelda 1 file", () => {
    expect(z1rPaths.length).toBeGreaterThan(0);
    for (const path of z1rPaths) {
      expect(GAME_DATA[path], path).not.toContain(EM);
      expect(GAME_DATA[path], path).not.toContain(EN);
    }
  });
});
