import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildGameData,
  GAME_TS,
  KeyTable,
  readGameSources,
  renderGameDataModule,
  renderLogic,
} from "../../scripts/build-game.js";
import { AREAS, GAME_IDS } from "../../src/game/catalog.js";
import { GAME_DATA } from "../../src/game/data.js";

// Built from char codes so this file passes the dash scan.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const DUNGEONS = ["hc", "ct", "ep", "dp", "toh", "pod", "sp", "sw", "tt", "ip", "mm", "tr", "gt"];

// Building the game data is a manual step: npm run build:game. These tests fail when a file under
// prompts/ was edited without rerunning it.
describe("game data", () => {
  const sources = readGameSources();
  const built = buildGameData(sources);

  it("matches what the build script would produce from prompts/", () => {
    expect(GAME_DATA).toEqual(built);
  });

  it("is exactly the file the build script would write", () => {
    expect(readFileSync(GAME_TS, "utf8")).toBe(renderGameDataModule(built));
  });

  it("renders a header, then one constant mapping each path to its text", () => {
    const sample = { "alttp/a.md": 'a "quoted" line\n→ arrow and `ticks` and back\\slash\n' };
    const out = renderGameDataModule(sample);
    expect(out.startsWith("// Generated from prompts/ by scripts/build-game.ts")).toBe(true);
    expect(out).toContain("Do not edit; edit the markdown or logic/keys.json");
    expect(out).toContain("// biome-ignore format");
    const start = out.indexOf("{\n") + 2;
    const body = out.slice(start, out.lastIndexOf("};"));
    const line = body.trim().replace(/,$/, "");
    const colon = line.indexOf('": ') + 1;
    expect(JSON.parse(line.slice(0, colon))).toBe("alttp/a.md");
    expect(JSON.parse(line.slice(colon + 2))).toBe(sample["alttp/a.md"]);
  });

  it("keys every path with its game, in a stable order", () => {
    const paths = Object.keys(GAME_DATA);
    expect(paths).toEqual([...paths].sort());
    for (const path of paths) {
      expect(GAME_IDS as readonly string[], path).toContain(path.split("/")[0]);
    }
  });

  it("holds the orientation, the overworld, the items, the key table and every dungeon", () => {
    for (const path of [
      "alttp/general.md",
      "alttp/overworld.md",
      "alttp/items.md",
      "alttp/logic/keys.json",
    ]) {
      expect(GAME_DATA[path], path).toBeDefined();
    }
    for (const key of DUNGEONS) {
      expect(GAME_DATA[`alttp/dungeons/${key}.md`], key).toBeDefined();
      expect(GAME_DATA[`alttp/logic/${key}.md`], key).toBeDefined();
    }
    expect(
      AREAS.filter((a) => a.game === "alttp")
        .map((a) => a.key)
        .sort(),
    ).toEqual([...DUNGEONS].sort());
  });

  it("keeps the orientation short", () => {
    const general = GAME_DATA["alttp/general.md"] ?? "";
    expect(general.length).toBeGreaterThan(1000);
    expect(general.length).toBeLessThan(2000);
  });

  it("gives every dungeon its overview row, boss notes and a heading with its code", () => {
    for (const key of DUNGEONS) {
      const text = GAME_DATA[`alttp/dungeons/${key}.md`] ?? "";
      expect(text.startsWith("# "), key).toBe(true);
      expect(text.split("\n")[0], key).toContain(`\`${key}\``);
      expect(text, key).toContain("## Overview row");
      expect(text, key).toContain(`(\`${key}\`) |`);
      expect(text, key).toContain("- **Boss:**");
      expect(text, key).toContain("- **Difficulty:**");
    }
    expect(GAME_DATA["alttp/dungeons/gt.md"]).toContain("| **Ganon** |");
    expect(GAME_DATA["alttp/dungeons/gt.md"]).toContain("| **Agahnim 2** |");
    expect(GAME_DATA["alttp/dungeons/ct.md"]).toContain("| **Agahnim** |");
    expect(GAME_DATA["alttp/dungeons/ep.md"]).toContain("Red Eyegore");
  });

  it("puts the entrance requirement of every dungeon in the overworld notes", () => {
    const overworld = GAME_DATA["alttp/overworld.md"] ?? "";
    for (const key of DUNGEONS) expect(overworld, key).toContain(`(\`${key}\`):`);
    expect(overworld).toContain("Medallions and special entry requirements");
    expect(overworld).toContain("Caves and interiors");
  });

  it("holds the items table and the glossary", () => {
    const items = GAME_DATA["alttp/items.md"] ?? "";
    expect(items).toContain("| **Hookshot** |");
    expect(items).toContain("## Glossary of game mechanics and terms");
    expect(items).toContain("**Crystal Switch**");
  });

  it("has no em or en dashes in any data file", () => {
    for (const [path, text] of Object.entries(GAME_DATA)) {
      expect(text, path).not.toContain(EM);
      expect(text, path).not.toContain(EN);
    }
  });

  it("refuses a prompts folder that is not a known game", () => {
    expect(() => readGameSources(new URL("../fixtures", import.meta.url).pathname)).toThrow(
      /not a known game id|not inside a game folder/,
    );
  });
});

describe("rendered key logic", () => {
  const keys = KeyTable.parse(JSON.parse(GAME_DATA["alttp/logic/keys.json"] ?? "{}"));

  it("lists every door of every dungeon in the exported table, as door name then count", () => {
    expect(Object.keys(keys.dungeons).sort()).toEqual([...DUNGEONS].sort());
    for (const [key, doors] of Object.entries(keys.dungeons)) {
      const text = GAME_DATA[`alttp/logic/${key}.md`] ?? "";
      for (const door of Object.keys(doors))
        expect(text, `${key} ${door}`).toContain(`- ${door}: `);
    }
    expect(GAME_DATA["alttp/logic/pod.md"]).toContain("- PoD Middle Cage N: 1\n");
    expect(GAME_DATA["alttp/logic/ep.md"]).toContain("- Eastern Dark Square Key Door WN: 0\n");
  });

  it("explains the conditional forms in words", () => {
    expect(GAME_DATA["alttp/logic/pod.md"]).toContain(
      "- PoD Basement Ledge Up Stairs: 6, or 3 when a small key is in Palace of Darkness - Big Key Chest\n",
    );
    expect(GAME_DATA["alttp/logic/mm.md"]).toContain(
      "- Mire Hub WS: 3, or 2 when the big key is in Misery Mire - Compass Chest or Misery Mire - Big Key Chest\n",
    );
    expect(GAME_DATA["alttp/logic/gt.md"]).toContain(
      "- GT Hookshot ES: 4, or 3 when a small key is in Ganons Tower - Map Chest, or 3 when the big key is in Ganons Tower - Map Chest\n",
    );
    expect(GAME_DATA["alttp/logic/toh.md"]).toContain(
      "- Hera Lobby Key Stairs: 1, or 0 when a small key is in Tower of Hera - Big Key Chest\n",
    );
    expect(GAME_DATA["alttp/logic/pod.md"]).toContain("lower number that applies");
  });

  it("says so when a dungeon has no entry", () => {
    const text = renderLogic("Eastern Palace", "ep", undefined);
    expect(text).toContain("# Eastern Palace (`ep`): key door table");
    expect(text).toContain("This dungeon has no entry in the key door table.");
    expect(text).not.toContain("- ");
  });

  it("renders from a table that leaves a dungeon out", () => {
    const sources = {
      "alttp/logic/keys.json": JSON.stringify({
        source: "x",
        dungeons: { hc: { "Door A": 2 } },
        constants: {},
      }),
    };
    const data = buildGameData(sources);
    expect(data["alttp/logic/hc.md"]).toContain("- Door A: 2");
    expect(data["alttp/logic/ep.md"]).toContain("no entry");
  });

  it("refuses a table that names a dungeon the catalog does not have", () => {
    const sources = {
      "alttp/logic/keys.json": JSON.stringify({
        source: "x",
        dungeons: { zz: { "Door A": 2 } },
        constants: {},
      }),
    };
    expect(() => buildGameData(sources)).toThrow(/zz/);
  });

  it("refuses a conditional rule with half its pair", () => {
    const bad = {
      source: "x",
      dungeons: { hc: { "Door A": { keys: 2, small_key_in: "Chest" } } },
      constants: {},
    };
    expect(KeyTable.safeParse(bad).success).toBe(false);
  });

  it("carries the constants the export found", () => {
    expect(Object.keys(keys.constants).sort()).toEqual([
      "GT_COMPASS",
      "GT_RANDOMIZER",
      "TR_EYE_BRIDGE",
    ]);
  });
});
