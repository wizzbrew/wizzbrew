import { describe, expect, it } from "vitest";
import {
  AREAS,
  BOSSES,
  findSubjectsInText,
  GAME_NAMES,
  ITEMS,
  inferGame,
  resolveSubjects,
} from "../../src/game/catalog.js";

const keysOf = (hits: { key: string }[]): string[] => hits.map((h) => h.key);

describe("Zelda 1 Randomizer catalog", () => {
  const z1r = (names: string[]) => resolveSubjects(names, "z1r");
  const hit = (key: string) => ({ game: "z1r", key });
  const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `level${n}`);

  it("is named, has nine levels, nine bosses and twenty eight items", () => {
    expect(GAME_NAMES.z1r).toBe("Zelda 1 Randomizer");
    expect(AREAS.filter((a) => a.game === "z1r").map((a) => a.key)).toEqual(LEVELS);
    expect(BOSSES.filter((b) => b.game === "z1r")).toHaveLength(9);
    expect(ITEMS.filter((i) => i.game === "z1r")).toHaveLength(28);
  });

  const areas: [string, string][] = [
    ["Level 1", "level1"],
    ["level one", "level1"],
    ["L1", "level1"],
    ["LVL 2", "level2"],
    ["Dungeon 3", "level3"],
    ["dungeon three", "level3"],
    ["Level 4?", "level4"],
    ["Eagle", "level1"],
    ["the Moon dungeon", "level2"],
    ["Manji", "level3"],
    ["Kanji", "level3"],
    ["Snake", "level4"],
    ["Lizard", "level5"],
    ["Dragon dungeon", "level6"],
    ["Demon", "level7"],
    ["Lion", "level8"],
    ["Death Mountain", "level9"],
    ["level nine", "level9"],
    ["Level 9 (Death Mountain)", "level9"],
  ];
  for (const [written, key] of areas) {
    it(`reads the area ${JSON.stringify(written)} as ${key}`, () => {
      expect(z1r([written])).toEqual({ dungeons: [hit(key)], items: [], unresolved: [] });
    });
  }

  const bosses: [string, string][] = [
    ["Aquamentus", "level1"],
    ["Dodongo", "level2"],
    ["Manhandla", "level3"],
    ["Gleeok", "level4"],
    ["Digdogger", "level5"],
    ["Gohma", "level6"],
    ["Hungry Goriya", "level7"],
    ["Patra", "level9"],
    ["Ganon", "level9"],
    ["Gannon", "level9"],
    ["Ganon's", "level9"],
  ];
  for (const [written, area] of bosses) {
    it(`sends the boss ${JSON.stringify(written)} to ${area}`, () => {
      expect(z1r([written])).toEqual({ dungeons: [hit(area)], items: [], unresolved: [] });
    });
  }

  const items: [string, string][] = [
    ["Raft", "raft"],
    ["Stepladder", "stepladder"],
    ["Ladder", "stepladder"],
    ["Recorder", "recorder"],
    ["whistle", "recorder"],
    ["Power Bracelet", "power_bracelet"],
    ["Bow", "bow"],
    ["Arrows", "arrows"],
    ["Silver Arrows", "silver_arrows"],
    ["Bombs", "bombs"],
    ["Blue Candle", "blue_candle"],
    ["Red Candle", "red_candle"],
    ["Magic Key", "magic_key"],
    ["Bait", "bait"],
    ["Letter", "letter"],
    ["Magic Wand", "magic_wand"],
    ["Wand", "magic_wand"],
    ["Magic Book", "magic_book"],
    ["Book", "magic_book"],
    ["Blue Ring", "blue_ring"],
    ["Red Ring", "red_ring"],
    ["Boomerang", "boomerang"],
    ["Magical Boomerang", "magical_boomerang"],
    ["Wood Sword", "wood_sword"],
    ["White Sword", "white_sword"],
    ["Magical Sword", "magical_sword"],
    ["Magic Shield", "magic_shield"],
    ["Heart Container", "heart_container"],
    ["Triforce", "triforce"],
    ["Triforce pieces", "triforce"],
    ["candle", "candle"],
    ["sword", "sword"],
    ["ring", "ring"],
  ];
  for (const [written, key] of items) {
    it(`reads the item ${JSON.stringify(written)} as ${key}`, () => {
      expect(z1r([written])).toEqual({ dungeons: [], items: [hit(key)], unresolved: [] });
    });
  }

  it("takes the longest phrase, so a named sword or arrow is not the plain one", () => {
    expect(keysOf(z1r(["Magical Sword"]).items)).toEqual(["magical_sword"]);
    expect(keysOf(z1r(["Silver Arrows"]).items)).toEqual(["silver_arrows"]);
    expect(keysOf(z1r(["Magical Boomerang"]).items)).toEqual(["magical_boomerang"]);
  });

  it("finds several names in one string, and an item beside a level", () => {
    const out = z1r(["gohma and the bow in level 6", "the raft from level three"]);
    expect(keysOf(out.dungeons)).toEqual(["level6", "level3"]);
    expect(keysOf(out.items)).toEqual(["bow", "raft"]);
  });

  it("returns names of other games unresolved", () => {
    expect(z1r(["Ice Palace", "Kraid", "Hookshot"]).unresolved).toEqual([
      "Ice Palace",
      "Kraid",
      "Hookshot",
    ]);
  });
});

describe("names the Zelda games share", () => {
  const SHARED: [string, ("alttp" | "sm" | "z1r")[]][] = [
    ["Bow", ["alttp", "z1r"]],
    ["Arrows", ["alttp", "z1r"]],
    ["Silver Arrows", ["alttp", "z1r"]],
    ["Book", ["alttp", "z1r"]],
    ["Boomerang", ["alttp", "z1r"]],
    ["Bombs", ["alttp", "sm", "z1r"]],
    ["Shield", ["alttp", "z1r"]],
    ["Sword", ["alttp", "z1r"]],
    ["Ganon", ["alttp", "z1r"]],
  ];

  for (const [written, games] of SHARED) {
    it(`reads ${JSON.stringify(written)} once in each of ${games.join(", ")}`, () => {
      for (const game of ["alttp", "sm", "z1r"] as const) {
        const out = resolveSubjects([written], game);
        const all = [...out.dungeons, ...out.items];
        if (games.includes(game)) {
          expect(all, game).toHaveLength(1);
          expect(all[0]?.game, game).toBe(game);
          expect(out.unresolved, game).toEqual([]);
        } else {
          expect(all, game).toEqual([]);
          expect(out.unresolved, game).toEqual([written]);
        }
      }
      const open = resolveSubjects([written]);
      expect([...open.dungeons, ...open.items].map((h) => h.game)).toEqual(games);
    });
  }

  it("sends Ganon to the tower or to Level 9 by game", () => {
    expect(resolveSubjects(["Ganon"], "alttp").dungeons).toEqual([{ game: "alttp", key: "gt" }]);
    expect(resolveSubjects(["Ganon"], "z1r").dungeons).toEqual([{ game: "z1r", key: "level9" }]);
    expect(resolveSubjects(["Ganon"]).dungeons).toEqual([
      { game: "alttp", key: "gt" },
      { game: "z1r", key: "level9" },
    ]);
    expect(resolveSubjects(["Ganon's Tower"]).dungeons).toEqual([{ game: "alttp", key: "gt" }]);
    expect(resolveSubjects(["Ganon's Tower"], "z1r")).toEqual({
      dungeons: [],
      items: [],
      unresolved: ["Ganon's Tower"],
    });
  });

  it("keeps another game's longer names out of a Zelda 1 name", () => {
    expect(resolveSubjects(["Mirror Shield"], "z1r").items).toEqual([]);
    expect(resolveSubjects(["Mirror Shield"]).items).toEqual([{ game: "alttp", key: "shield" }]);
    expect(resolveSubjects(["Magic Mirror"], "z1r").items).toEqual([]);
    expect(resolveSubjects(["Magic Cape"], "z1r").items).toEqual([]);
  });
});

describe("inferGame with Zelda 1", () => {
  it("reads the game from a level, a boss or an item only Zelda 1 has", () => {
    expect(inferGame(undefined, ["Level 7"])).toBe("z1r");
    expect(inferGame(undefined, ["Aquamentus"])).toBe("z1r");
    expect(inferGame(undefined, ["Raft"])).toBe("z1r");
    expect(inferGame(undefined, ["Triforce", "Recorder"])).toBe("z1r");
    expect(inferGame(undefined, ["bombs", "Raft"])).toBe("z1r");
  });

  it("lets a shared name decide nothing and falls back to A Link to the Past", () => {
    expect(inferGame(undefined, ["Ganon"])).toBe("alttp");
    expect(inferGame(undefined, ["Bow"])).toBe("alttp");
    expect(inferGame(undefined, ["Silver Arrows", "Book"])).toBe("alttp");
    expect(inferGame(undefined, ["Raft", "Hookshot"])).toBe("alttp");
  });

  it("takes the first area or boss across three games, then the votes", () => {
    expect(inferGame(undefined, ["Kraid", "Level 3", "Ice Palace"])).toBe("sm");
    expect(inferGame(undefined, ["Level 3", "Kraid"])).toBe("z1r");
    expect(inferGame(undefined, ["Raft", "Gohma", "Ice Palace"])).toBe("z1r");
    expect(inferGame(undefined, ["Hookshot", "Raft", "Ganon"])).toBe("alttp");
    expect(inferGame(undefined, ["Hookshot", "Raft", "Triforce"])).toBe("z1r");
  });

  it("keeps the router's choice", () => {
    expect(inferGame("z1r", ["Ice Palace"])).toBe("z1r");
    expect(inferGame("alttp", ["Aquamentus"])).toBe("alttp");
    expect(inferGame("z1r", [])).toBe("z1r");
  });
});

describe("findSubjectsInText with Zelda 1", () => {
  const found = (text: string): string[] =>
    findSubjectsInText(text).map((h) => `${h.game}:${h.key}`);

  it("finds a boss, a level and a multi-word item inside a sentence", () => {
    expect(findSubjectsInText("how do i beat gohma")).toEqual([
      { game: "z1r", key: "level6", kind: "area", name: "Gohma" },
    ]);
    expect(findSubjectsInText("whats in level 7")).toEqual([
      { game: "z1r", key: "level7", kind: "area", name: "Level 7 (Demon)" },
    ]);
    expect(findSubjectsInText("is the magic key worth it")).toEqual([
      { game: "z1r", key: "magic_key", kind: "item", name: "Magic Key" },
    ]);
    expect(found("red candle or blue candle")).toEqual(["z1r:red_candle", "z1r:blue_candle"]);
    expect(found("the power bracelet and the heart container")).toEqual([
      "z1r:power_bracelet",
      "z1r:heart_container",
    ]);
    expect(found("a step ladder")).toEqual(["z1r:stepladder"]);
    expect(found("Manji looks hard")).toEqual(["z1r:level3"]);
  });

  it("leaves the everyday single words alone", () => {
    const words =
      "raft ladder stepladder candle bait letter key ring wand book bow arrows bombs shield sword heart";
    expect(found(words).filter((h) => h.startsWith("z1r:"))).toEqual([]);
    expect(
      found(
        "i lost my key and my ring, read a letter on the raft by the moon, then met an eagle, a snake, a lizard, a dragon, a demon and a lion",
      ),
    ).toEqual([]);
    expect(found("the whistle, the recorder and the triforce on death mountain")).toEqual([]);
  });

  it("still reads the same words for the games that list them", () => {
    expect(found("how many bombs")).toEqual(["alttp:bombs"]);
    expect(found("sword and shield")).toEqual(["alttp:sword", "alttp:shield"]);
    expect(found("how many arrows")).toEqual(["alttp:bow"]);
    expect(found("bombs for kraid's lair")).toEqual(["sm:bombs", "sm:brinstar"]);
  });

  it("never reads the two letter names", () => {
    expect(found("l1 l2 l3 l4 l5 l6 l7 l8 l9 tonight")).toEqual([]);
  });

  it("reads a shared boss as A Link to the Past, and Gannon as Zelda 1", () => {
    expect(found("how do i beat ganon")).toEqual(["alttp:gt"]);
    expect(found("how do i beat gannon")).toEqual(["z1r:level9"]);
  });

  it("returns only one game's hits when the text names several", () => {
    expect(found("the raft in level 4, not the ice palace")).toEqual(["z1r:level4"]);
    expect(found("ice palace before level 4 and kraid")).toEqual(["alttp:ip"]);
    expect(found("kraid beat me in level 4")).toEqual(["sm:brinstar"]);
  });
});
