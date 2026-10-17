import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGameData,
  EVENT_DIR,
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

  it("keys every path with its game or the event folder, in a stable order", () => {
    const paths = Object.keys(GAME_DATA);
    expect(paths).toEqual([...paths].sort());
    for (const path of paths) {
      const top = path.split("/")[0] ?? "";
      expect([...GAME_IDS, EVENT_DIR] as readonly string[], path).toContain(top);
    }
  });

  it("compiles prompts/event/*.md under event/<file>", () => {
    expect(Object.keys(sources).filter((p) => p.startsWith("event/"))).toEqual(["event/sgl26.md"]);
    expect(GAME_DATA["event/sgl26.md"]).toBe(
      readFileSync(new URL("../../prompts/event/sgl26.md", import.meta.url), "utf8"),
    );
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

  it("holds the event facts and stays under 4500 characters", () => {
    const facts = GAME_DATA["event/sgl26.md"] ?? "";
    expect(facts.length).toBeGreaterThan(1000);
    expect(facts.length).toBeLessThan(4500);
    for (const s of [
      "run by SpeedGaming",
      "Thursday October 22 to Sunday October 25, 2026",
      "DoubleTree by Hilton Washington Dulles Airport",
      "13869 Park Center Road, Herndon, VA 20171",
      "+1 703-478-2900",
      "https://www.hilton.com/en/attend-my-event/iaddddt-sgt-dbdc1c4d-2085-440e-abcd-94c590cebeee/",
      "$129 per night",
      "arrival is Wednesday October 21",
      "departure is Monday October 26",
      "adjust the dates in the form",
      "Daily, $40",
      "Base, $80",
      "VIP, $110",
      "SUPER VIP, $160",
      "The online tournaments need no ticket",
      "https://matcherino.com/t/sglive26",
      "https://matcherino.com/t/sglive26?contribute=true",
      "name the game it supports",
      "https://forms.gle/DSseFRkwKffPynN9A",
      "8 hours or more comps your badge",
      "https://twitch.tv/SpeedGaming2",
      "https://discord.com/invite/T6qzxNJ",
      "https://speedgaming.challonge.com/",
      "https://speedgaming.org/sgl26",
      "Reviewed 2026-10-17 from sglive.speedgaming.org",
    ]) {
      expect(facts, s).toContain(s);
    }
    for (const slug of [
      "sgl26alttpr",
      "sgl26hybrid",
      "sgl26nmg",
      "sgl26smany",
      "sgl26smmap",
      "sgl26z1r",
    ]) {
      expect(facts, slug).toContain(slug);
    }
    for (const slug of ["ffmqr", "smb3r", "z2r", "ctjets", "aosr", "crys", "proto", "mm7"]) {
      expect(facts, slug).toContain(slug);
    }
  });

  it("leaves out what the builder ruled out of the event facts", () => {
    const facts = GAME_DATA["event/sgl26.md"] ?? "";
    expect(facts).not.toContain("October 27");
    expect(facts).not.toContain("gg/YGzQsUp");
    expect(facts).not.toContain("check-in opens");
    expect(facts).not.toContain("tournament room");
    expect(facts).not.toMatch(/donor|donation|182107/i);
    expect(facts).not.toContain("$15,140");
  });

  it("reads event markdown and refuses anything else in the event folder", () => {
    const root = mkdtempSync(join(tmpdir(), "wb-event-"));
    try {
      mkdirSync(join(root, EVENT_DIR));
      writeFileSync(join(root, EVENT_DIR, "b.md"), "B\n");
      writeFileSync(join(root, EVENT_DIR, "a.md"), "A\n");
      expect(readGameSources(root)).toEqual({ "event/a.md": "A\n", "event/b.md": "B\n" });
      expect(buildGameData(readGameSources(root))).toEqual({
        "event/a.md": "A\n",
        "event/b.md": "B\n",
      });
      writeFileSync(join(root, EVENT_DIR, "notes.txt"), "x");
      expect(() => readGameSources(root)).toThrow(/notes\.txt is not a markdown file/);
    } finally {
      rmSync(root, { recursive: true, force: true });
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
