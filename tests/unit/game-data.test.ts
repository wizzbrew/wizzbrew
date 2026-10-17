import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildGameData,
  EVENT_DIR,
  GAME_TS,
  KeyTable,
  LOGIC_FILE_CAP,
  RequirementTable,
  readGameSources,
  renderGameDataModule,
  renderLogic,
} from "../../scripts/build-game.js";
import { AREAS, BOSSES, GAME_IDS } from "../../src/game/catalog.js";
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

// The per-location requirements exported from the door randomizer (tools/export-dungeon-logic.py).
// The tables feed the rendering only, so they are read from prompts/, not from the data.
describe("rendered location requirements", () => {
  const sources = readGameSources();
  const ng = RequirementTable.parse(JSON.parse(sources["alttp/logic/requirements.json"] ?? "{}"));
  const hmg = RequirementTable.parse(
    JSON.parse(sources["alttp/logic/requirements-hmg.json"] ?? "{}"),
  );
  const logic = (key: string): string => GAME_DATA[`alttp/logic/${key}.md`] ?? "";

  it("was exported with static key logic, no glitches and Hybrid Major Glitches", () => {
    for (const [table, mode] of [
      [ng, "noglitches"],
      [hmg, "hybridglitches"],
    ] as const) {
      expect(table.settings.logic).toBe(mode);
      expect(table.settings.key_logic_algorithm).toBe("static");
      expect(table.settings.door_shuffle).toBe("vanilla");
      expect(table.settings.mode).toBe("open");
      expect(Object.keys(table.dungeons).sort()).toEqual([...DUNGEONS].sort());
      for (const [key, dungeon] of Object.entries(table.dungeons)) {
        expect(dungeon.unreachable, key).toEqual([]);
        expect(dungeon.locations.length, key).toBeGreaterThan(4);
      }
    }
  });

  it("stays out of the data, which carries the rendered files instead", () => {
    expect(GAME_DATA["alttp/logic/requirements.json"]).toBeUndefined();
    expect(GAME_DATA["alttp/logic/requirements-hmg.json"]).toBeUndefined();
  });

  it("gives every dungeon an entry line, every location a line, and the glitched differences", () => {
    for (const key of DUNGEONS) {
      const text = logic(key);
      const start = text.indexOf("## Location requirements");
      const glitched = text.indexOf("## Hybrid Major Glitches");
      expect(start, key).toBeGreaterThan(text.indexOf("key door table"));
      expect(glitched, key).toBeGreaterThan(start);
      expect(text.slice(start), key).toContain("\n- Entry: ");
      for (const location of ng.dungeons[key]?.locations ?? []) {
        const short = location.name.replace(/^[^-]+ - /, "");
        expect(text.includes(location.name) || text.includes(short), location.name).toBe(true);
      }
      expect(text.trimEnd(), key).toMatch(/match(es)? no glitches\.$/);
    }
  });

  it("keeps every logic file under the cap", () => {
    for (const key of DUNGEONS) expect(logic(key).length, key).toBeLessThan(LOGIC_FILE_CAP);
  });

  it("states the rules the engine gives for well known locations", () => {
    expect(logic("ep")).toContain("\n- Eastern Palace - Boss: Bow, Lamp; big key\n");
    expect(logic("ip")).toContain(
      "\n- Ice Palace - Boss: Hammer, Moon Pearl; either Fire Rod, or Bombos and Sword; 1 small key, 2 if Cane of Somaria is missing; big key\n",
    );
    expect(logic("tr")).toContain("any of Cane of Byrna, Cape or Shield level 3");
    expect(logic("ct")).toContain("\n- Entry: any of Cape or Sword level 2\n");
    expect(logic("ct")).toContain("Sword level 2 is the Master Sword");
    expect(logic("gt")).toContain(
      "\n- Ganons Tower - Big Chest: Moon Pearl; either Cane of Somaria and Fire Rod, or Hammer and Hookshot; 3 small keys; big key\n",
    );
    expect(logic("pod")).toContain(
      "\n- Palace of Darkness - Boss: Bow, Hammer, Lamp; 6 small keys; big key\n",
    );
    expect(logic("mm")).toContain("It starts with Pegasus Boots, so they are never listed.");
  });

  it("has no em or en dashes in any rendered logic file", () => {
    for (const key of DUNGEONS) {
      expect(logic(key), key).not.toContain(EM);
      expect(logic(key), key).not.toContain(EN);
    }
  });
});

const SM_AREAS = [
  "crateria",
  "brinstar",
  "norfair_upper",
  "norfair_lower",
  "wrecked_ship",
  "maridia",
  "tourian",
];

// Super Metroid has no keys.json: its logic/<key>.md files are written by hand and travel as
// they are, so they are sources, not rendered output.
describe("Super Metroid data", () => {
  const sources = readGameSources();
  const smPaths = Object.keys(GAME_DATA).filter((p) => p.startsWith("sm/"));
  const sm = (path: string): string => GAME_DATA[`sm/${path}`] ?? "";

  it("holds the orientation, the overworld, the items and every area's notes and rules", () => {
    for (const path of ["general.md", "overworld.md", "items.md"]) {
      expect(GAME_DATA[`sm/${path}`], path).toBeDefined();
    }
    for (const key of SM_AREAS) {
      expect(GAME_DATA[`sm/dungeons/${key}.md`], key).toBeDefined();
      expect(GAME_DATA[`sm/logic/${key}.md`], key).toBeDefined();
    }
    expect(smPaths).toHaveLength(3 + 2 * SM_AREAS.length);
    expect(GAME_DATA["sm/logic/keys.json"]).toBeUndefined();
    expect(
      AREAS.filter((a) => a.game === "sm")
        .map((a) => a.key)
        .sort(),
    ).toEqual([...SM_AREAS].sort());
  });

  it("carries the hand-written logic files exactly as they are on disk", () => {
    for (const key of SM_AREAS) {
      expect(GAME_DATA[`sm/logic/${key}.md`], key).toBe(sources[`sm/logic/${key}.md`]);
    }
  });

  it("keeps the orientation under 8000 characters", () => {
    expect(sm("general.md").length).toBeGreaterThan(3000);
    expect(sm("general.md").length).toBeLessThan(8000);
  });

  it("tells the story, the two logics, the vocabulary, the routing arguments and ten fun facts", () => {
    const general = sm("general.md");
    for (const s of [
      "## The story in brief",
      "Casual",
      "Tournament",
      "**In logic**",
      "**Placement.**",
      "## Community vocabulary",
      "## Routing arguments",
      "## Ten fun facts",
      "10. Draygon's corpse",
      "samus.link",
    ]) {
      expect(general, s).toContain(s);
    }
    expect(general).toContain("do not mix their facts into these notes");
  });

  it("gives every area a heading with its code, its notes and the entry rule", () => {
    for (const key of SM_AREAS) {
      const notes = sm(`dungeons/${key}.md`);
      expect(notes.startsWith("# "), key).toBe(true);
      expect(notes.split("\n")[0], key).toContain(`(\`${key}\`)`);
      expect(notes, key).toContain("- **Look and mood:**");
      expect(notes, key).toContain("- **Vanilla items:**");
      expect(notes, key).toContain("## Entry rule");
      expect(notes, key).toContain("## Bosses and minibosses");
    }
  });

  it("names every boss in the notes of the area the catalog sends it to", () => {
    const bosses = BOSSES.filter((b) => b.game === "sm");
    expect(bosses).toHaveLength(11);
    for (const boss of bosses) {
      expect(sm(`dungeons/${boss.area}.md`), boss.key).toContain(boss.name);
    }
    expect(sm("dungeons/brinstar.md")).toContain("960 HP");
    expect(sm("dungeons/norfair_lower.md")).toContain("18,000 HP");
    expect(sm("dungeons/crateria.md")).toContain("Kraid (green eyes)");
  });

  it("puts every area's entry rule in the overworld notes and the predicates legend in its logic notes", () => {
    for (const key of SM_AREAS) expect(sm("overworld.md"), key).toContain(`(\`${key}\`)`);
    expect(sm("overworld.md")).toContain("CanDefeatDraygon");
    expect(sm("overworld.md")).toContain("| Infinite bomb jump (IBJ) |");
    for (const key of SM_AREAS.filter((k) => k !== "tourian")) {
      const rules = sm(`logic/${key}.md`);
      expect(rules.split("\n")[0], key).toContain(`(\`${key}\`)`);
      expect(rules, key).toContain("## Entry rule");
      expect(rules, key).toContain("## Legend");
      expect(rules, key).toContain("| CanUsePowerBombs |");
      expect(rules, key).toContain("## Location rules");
    }
    expect(sm("logic/tourian.md")).toContain("not modeled");
  });

  it("keeps the location names and both logics of the rule document", () => {
    expect(sm("logic/crateria.md")).toContain("- Energy Tank, Terminator: free");
    expect(sm("logic/crateria.md")).toContain(
      "- Bombs (Bomb Torizo): C: PASS and RED. T: Morph and RED",
    );
    expect(sm("logic/brinstar.md")).toContain("- Spazer: Morph and Super");
    expect(sm("logic/norfair_upper.md")).toContain(
      "- Grappling Beam: C: Morph and (FLY or (Spd and PB)). T: SJ or Morph or Grap or (HJ and Spd)",
    );
    expect(sm("logic/norfair_lower.md")).toContain("- Energy Tank, Ridley: PB and Super");
    expect(sm("logic/norfair_lower.md")).toContain("- Missile (Gold Torizo): C: PB, SJ, Super.");
    expect(sm("logic/wrecked_ship.md")).toContain(
      "- Energy Tank, Wrecked Ship: C: HJ or SJ or Spd or Gr.",
    );
    expect(sm("logic/maridia.md")).toContain(
      "- Space Jump: C: DRAY. T: DRAY and (FLY or (Spd and HJ))",
    );
    expect(sm("logic/maridia.md")).toContain("- Energy Tank, Botwoon: BOT and (Gr or Ice)");
  });

  it("holds the items table with what each item gives in logic, and the placement rules", () => {
    const items = sm("items.md");
    for (const s of [
      "| Hyper Beam |",
      "| Spazer |",
      "## Tank and ammo totals",
      "## Placement rules",
      "## Base game changes that affect logic",
      "14 Energy Tanks",
      "Placement bans: Gravity not in Crateria or Brinstar",
    ]) {
      expect(items, s).toContain(s);
    }
    expect(items).toContain("Nothing; never referenced by any rule");
  });

  it("drops the verification markers and the sentence that was never confirmed", () => {
    for (const path of smPaths) {
      const text = GAME_DATA[path] ?? "";
      for (const s of [
        "(unverified)",
        "unverified",
        "(?)",
        "Spring Ball dance",
        "## Verification",
        "## Sources",
      ]) {
        expect(text, `${path} ${s}`).not.toContain(s);
      }
    }
  });

  it("has no em or en dashes in any Super Metroid file", () => {
    expect(smPaths.length).toBeGreaterThan(0);
    for (const path of smPaths) {
      expect(GAME_DATA[path], path).not.toContain(EM);
      expect(GAME_DATA[path], path).not.toContain(EN);
    }
  });
});
