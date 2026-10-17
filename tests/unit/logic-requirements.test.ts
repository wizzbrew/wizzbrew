import { describe, expect, it } from "vitest";
import {
  buildGameData,
  LOGIC_FILE_CAP,
  RequirementTable,
  renderLocationRequirements,
  renderLogicFile,
  requirementText,
} from "../../scripts/build-game.js";

// Small hand-made tables in the shape tools/export-dungeon-logic.py writes. Nothing here comes
// from the engine; the real export is checked in game-data.test.ts.
const LEVELS = {
  Sword: ["Fighter Sword", "Master Sword", "Tempered Sword", "Golden Sword"],
  Glove: ["Power Glove", "Titans Mitts"],
};
const PLAIN = { group: false, shortNames: false };

type Loc = {
  name: string;
  region: string;
  needs: string[];
  any_of: string[][];
  either?: { groups: number[]; terms: string[][] }[];
  small_keys: number;
  big_key: boolean;
  small_keys_without?: Record<string, number>;
};

function loc(name: string, extra: Partial<Loc> = {}): Loc {
  return {
    name,
    region: "Some Room",
    needs: [],
    any_of: [],
    small_keys: 0,
    big_key: false,
    ...extra,
  };
}

function dungeon(locations: Loc[], entry: Partial<Loc> = {}, unreachable: string[] = []) {
  return {
    entry: { needs: [], any_of: [], ...entry },
    locations,
    unreachable,
  };
}

function table(dungeons: Record<string, ReturnType<typeof dungeon>>, settings = {}) {
  return RequirementTable.parse({ source: "fixture", settings, levels: LEVELS, dungeons });
}

describe("requirementText", () => {
  it("says free when a location needs nothing beyond entry", () => {
    expect(requirementText(loc("A"), "a")).toBe("free");
    expect(requirementText({ needs: [], any_of: [] }, "entry")).toBe("free");
  });

  it("lists needs, then any-of groups, then small keys, then the big key", () => {
    const text = requirementText(
      loc("A", {
        needs: ["Hammer", "Lamp"],
        any_of: [
          ["Fire Rod", "Lamp"],
          ["Cane of Byrna", "Cape", "Shield level 3"],
        ],
        small_keys: 2,
        big_key: true,
      }),
      "a",
    );
    expect(text).toBe(
      "Hammer, Lamp; any of Fire Rod or Lamp; any of Cane of Byrna, Cape or Shield level 3; 2 small keys; big key",
    );
    expect(requirementText(loc("B", { small_keys: 1 }), "b")).toBe("1 small key");
  });

  it("writes groups that share items once, as their alternatives, where the first stood", () => {
    const text = requirementText(
      loc("A", {
        needs: ["Moon Pearl"],
        any_of: [
          ["Bombos", "Fire Rod"],
          ["Hookshot", "Pegasus Boots"],
          ["Fire Rod", "Sword"],
        ],
        either: [{ groups: [0, 2], terms: [["Fire Rod"], ["Bombos", "Sword"]] }],
      }),
      "a",
    );
    expect(text).toBe(
      "Moon Pearl; either Fire Rod, or Bombos and Sword; any of Hookshot or Pegasus Boots",
    );
  });

  it("keeps two blocks of alternatives apart", () => {
    const text = requirementText(
      {
        needs: [],
        any_of: [
          ["Glove", "Ocarina"],
          ["Hammer", "Magic Mirror"],
          ["Hookshot", "Magic Mirror"],
          ["Lamp", "Ocarina"],
        ],
        either: [
          { groups: [0, 3], terms: [["Ocarina"], ["Glove", "Lamp"]] },
          { groups: [1, 2], terms: [["Magic Mirror"], ["Hammer", "Hookshot"]] },
        ],
      },
      "entry",
    );
    expect(text).toBe(
      "either Ocarina, or Glove and Lamp; either Magic Mirror, or Hammer and Hookshot",
    );
  });

  it("refuses an alternatives block that names a missing or reused group", () => {
    const missing = loc("A", {
      any_of: [["A", "B"]],
      either: [{ groups: [0, 3], terms: [["A"]] }],
    });
    expect(() => requirementText(missing, "x")).toThrow(/group 3/);
    const reused = loc("A", {
      any_of: [
        ["A", "B"],
        ["B", "C"],
      ],
      either: [
        { groups: [0, 1], terms: [["B"]] },
        { groups: [1, 0], terms: [["B"]] },
      ],
    });
    expect(() => requirementText(reused, "x")).toThrow(/missing or taken/);
  });

  it("gives the higher key count that applies when an item is missing", () => {
    expect(
      requirementText(
        loc("Boss", { small_keys: 1, small_keys_without: { "Cane of Somaria": 2 }, big_key: true }),
        "a",
      ),
    ).toBe("1 small key, 2 if Cane of Somaria is missing; big key");
    expect(requirementText(loc("Bridge", { small_keys_without: { Bow: 1, Hammer: 1 } }), "a")).toBe(
      "1 small key if Bow or Hammer is missing",
    );
    expect(
      requirementText(loc("C", { small_keys_without: { Hookshot: 3, Bow: 1, Hammer: 1 } }), "a"),
    ).toBe("1 small key if Bow or Hammer is missing, 3 if Hookshot is missing");
    expect(() =>
      requirementText(loc("D", { small_keys: 2, small_keys_without: { Bow: 2 } }), "d"),
    ).toThrow(/does not raise/);
  });
});

describe("renderLocationRequirements", () => {
  const ng = table({
    ep: dungeon(
      [
        loc("Eastern Palace - Cannonball Chest"),
        loc("Eastern Palace - Boss", { needs: ["Bow", "Lamp"], big_key: true }),
        loc("Eastern Palace - Spike Chest", {
          any_of: [["Boss Heart Container", "Cape"]],
        }),
      ],
      { any_of: [["Cape", "Sword level 2"]] },
    ),
  });

  it("opens with the entry line, then one line per location", () => {
    const text = renderLocationRequirements("ep", ng, undefined, PLAIN);
    expect(text.startsWith("## Location requirements\n\n")).toBe(true);
    expect(text).toContain("\n- Entry: any of Cape or Sword level 2\n");
    expect(text).toContain("\n- Eastern Palace - Cannonball Chest: free\n");
    expect(text).toContain("\n- Eastern Palace - Boss: Bow, Lamp; big key\n");
    expect(text).not.toContain("Hybrid Major Glitches");
  });

  it("explains only the level labels and the heart stand-in it uses", () => {
    const text = renderLocationRequirements("ep", ng, undefined, PLAIN);
    expect(text).toContain("Sword level 2 is the Master Sword.");
    expect(text).not.toContain("Titans Mitts");
    expect(text).toContain("Boss Heart Container stands for a fourth heart.");
  });

  it("refuses a level the table has no name for", () => {
    const bad = table({ ep: dungeon([loc("A", { needs: ["Bow level 2"] })]) });
    expect(() => renderLocationRequirements("ep", bad, undefined, PLAIN)).toThrow(/Bow level 2/);
  });

  it("names the locations the full inventory could not reach", () => {
    const text = renderLocationRequirements(
      "ep",
      table({ ep: dungeon([loc("A")], {}, ["Eastern Palace - Lost Chest"]) }),
      undefined,
      PLAIN,
    );
    expect(text).toContain("- Not reachable even with every item: Eastern Palace - Lost Chest\n");
  });

  it("says so when the table has no entry for the dungeon", () => {
    expect(renderLocationRequirements("hc", ng, undefined, PLAIN)).toContain(
      "This dungeon has no entry in the location requirements.",
    );
  });

  it("adds a Hybrid Major Glitches section with only what differs, and a line for the rest", () => {
    const hmg = table(
      {
        ep: dungeon(
          [
            loc("Eastern Palace - Cannonball Chest"),
            loc("Eastern Palace - Boss", { needs: ["Lamp"], big_key: true }),
            loc("Eastern Palace - Spike Chest", { any_of: [["Boss Heart Container", "Cape"]] }),
          ],
          { any_of: [["Cape", "Sword level 2"]] },
        ),
      },
      { starting_items: ["Pegasus Boots"] },
    );
    const text = renderLocationRequirements("ep", ng, hmg, PLAIN);
    const glitched = text.slice(text.indexOf("## Hybrid Major Glitches"));
    expect(glitched).toContain("It starts with Pegasus Boots, so they are never listed.");
    expect(glitched).toContain("\n- Eastern Palace - Boss: Lamp; big key\n");
    expect(glitched).not.toContain("Cannonball");
    expect(glitched).not.toContain("- Entry:");
    expect(glitched.trimEnd().endsWith("- Everything else matches no glitches.")).toBe(true);
  });

  it("shows a changed entry, and says when nothing differs", () => {
    const freeEntry = table({
      ep: dungeon(
        [
          loc("Eastern Palace - Cannonball Chest"),
          loc("Eastern Palace - Boss", { needs: ["Bow", "Lamp"], big_key: true }),
          loc("Eastern Palace - Spike Chest", { any_of: [["Boss Heart Container", "Cape"]] }),
        ],
        {},
      ),
    });
    const changed = renderLocationRequirements("ep", ng, freeEntry, PLAIN);
    expect(changed.slice(changed.indexOf("## Hybrid"))).toContain("\n- Entry: free\n");
    const same = renderLocationRequirements("ep", ng, ng, PLAIN);
    expect(same.trimEnd().endsWith("- The entry and every location match no glitches.")).toBe(true);
  });
});

describe("renderLogicFile", () => {
  const doors = { "Door A": 1 };

  it("puts the key door table first and the location requirements after it", () => {
    const ng = table({ ep: dungeon([loc("Eastern Palace - Map Chest")]) });
    const text = renderLogicFile("Eastern Palace", "ep", doors, ng, undefined);
    expect(text.indexOf("- Door A: 1")).toBeLessThan(text.indexOf("## Location requirements"));
    expect(text).toContain("- Eastern Palace - Map Chest: free");
    expect(renderLogicFile("Eastern Palace", "ep", doors, undefined, undefined)).not.toContain(
      "Location requirements",
    );
  });

  it("refuses a glitched table without the no-glitch one", () => {
    const hmg = table({ ep: dungeon([]) });
    expect(() => renderLogicFile("Eastern Palace", "ep", doors, undefined, hmg)).toThrow(
      /requirements-hmg\.json needs/,
    );
  });

  // Locations sharing two requirements, with long names.
  const many = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      loc(`Ganons Tower - Long Room Number ${i} - Corner Chest`, {
        needs: i % 2 === 0 ? ["Hammer", "Hookshot", "Moon Pearl"] : ["Cane of Somaria", "Fire Rod"],
        small_keys: 4,
        big_key: true,
      }),
    );

  it("groups identical requirement lines when one line each would pass the cap", () => {
    const ng = table({ gt: dungeon(many(90)) });
    const plain = `x\n${renderLocationRequirements("gt", ng, undefined, PLAIN)}`;
    expect(plain.length).toBeGreaterThan(LOGIC_FILE_CAP);
    const text = renderLogicFile("Ganon's Tower", "gt", doors, ng, undefined);
    expect(text.length).toBeLessThan(LOGIC_FILE_CAP);
    expect(text).toContain(
      "- Ganons Tower - Long Room Number 0 - Corner Chest, Ganons Tower - Long Room Number 2 - Corner Chest",
    );
    expect(text).toContain(": Hammer, Hookshot, Moon Pearl; 4 small keys; big key\n");
    expect(text).toContain(": Cane of Somaria, Fire Rod; 4 small keys; big key\n");
  });

  it("drops the dungeon's name from location names when grouping alone is not enough", () => {
    const ng = table({ gt: dungeon(many(130)) });
    const grouped = `x\n${renderLocationRequirements("gt", ng, undefined, { group: true, shortNames: false })}`;
    expect(grouped.length).toBeGreaterThan(LOGIC_FILE_CAP);
    const text = renderLogicFile("Ganon's Tower", "gt", doors, ng, undefined);
    expect(text.length).toBeLessThan(LOGIC_FILE_CAP);
    expect(text).toContain(
      "- Long Room Number 0 - Corner Chest, Long Room Number 2 - Corner Chest, Long Room Number 4 - Corner Chest",
    );
    expect(text).not.toContain("- Ganons Tower - Long Room");
  });

  it("fails the build when even grouped lines pass the cap", () => {
    const distinct = Array.from({ length: 120 }, (_, i) =>
      loc(`Ganons Tower - Room ${i}`, { needs: [`Unique Item Number ${i}`, "Moon Pearl"] }),
    );
    const ng = table({ gt: dungeon(distinct) });
    expect(() => renderLogicFile("Ganon's Tower", "gt", doors, ng, undefined)).toThrow(
      /stays over 6000 characters/,
    );
  });
});

describe("buildGameData with requirement tables", () => {
  const keys = JSON.stringify({ source: "x", dungeons: { ep: { "Door A": 1 } }, constants: {} });
  const ng = JSON.stringify(table({ ep: dungeon([loc("Eastern Palace - Map Chest")]) }));

  it("renders the sections into logic/<key>.md and keeps the tables out of the data", () => {
    const data = buildGameData({
      "alttp/logic/keys.json": keys,
      "alttp/logic/requirements.json": ng,
      "alttp/logic/requirements-hmg.json": ng,
    });
    expect(data["alttp/logic/ep.md"]).toContain("- Eastern Palace - Map Chest: free");
    expect(data["alttp/logic/ep.md"]).toContain("## Hybrid Major Glitches");
    expect(data["alttp/logic/hc.md"]).toContain(
      "This dungeon has no entry in the location requirements.",
    );
    expect(data["alttp/logic/requirements.json"]).toBeUndefined();
    expect(data["alttp/logic/requirements-hmg.json"]).toBeUndefined();
    expect(data["alttp/logic/keys.json"]).toBe(keys);
  });

  it("refuses a requirement table that names a dungeon the catalog does not have", () => {
    const bad = JSON.stringify(table({ zz: dungeon([]) }));
    expect(() =>
      buildGameData({ "alttp/logic/keys.json": keys, "alttp/logic/requirements.json": bad }),
    ).toThrow(/requirements\.json names zz/);
  });

  it("refuses a table whose rows do not match the export shape", () => {
    const extra = JSON.parse(ng);
    extra.dungeons.ep.locations[0].note = "x";
    expect(() =>
      buildGameData({
        "alttp/logic/keys.json": keys,
        "alttp/logic/requirements.json": JSON.stringify(extra),
      }),
    ).toThrow();
  });
});
