import { describe, expect, it } from "vitest";
import {
  AREAS,
  BOSSES,
  findSubjectsInText,
  GAME_IDS,
  GAME_NAMES,
  type GameId,
  ITEMS,
  inferGame,
  resolveSubjects,
} from "../../src/game/catalog.js";

const keysOf = (hits: { key: string }[]): string[] => hits.map((h) => h.key);

describe("resolveSubjects dungeons", () => {
  const cases: [string, string][] = [
    ["Ice Palace", "ip"],
    ["ICE PALACE?!", "ip"],
    ["ip", "ip"],
    ["Ganon's Tower", "gt"],
    ["ganons tower", "gt"],
    ["GT", "gt"],
    ["Thieves' Town", "tt"],
    ["thieves town", "tt"],
    ["Thieves Towns", "tt"],
    ["Misery Mire", "mm"],
    ["mire", "mm"],
    ["Mire's boss", "mm"],
    ["Swamp Palace's", "sp"],
    ["tower of hera", "toh"],
    ["Hera", "toh"],
    ["Palace of Darkness", "pod"],
    ["PoD", "pod"],
    ["Turtle Rock", "tr"],
    ["TRock", "tr"],
    ["Skull Woods", "sw"],
    ["Eastern Palace", "ep"],
    ["desert palace", "dp"],
    ["Hyrule Castle", "hc"],
    ["the sewers", "hc"],
    ["Agahnim's Tower", "ct"],
    ["Castle Tower", "ct"],
  ];
  for (const [written, key] of cases) {
    it(`reads ${JSON.stringify(written)} as ${key}`, () => {
      const out = resolveSubjects([written]);
      expect(out.dungeons).toEqual([{ game: "alttp", key }]);
      expect(out.items).toEqual([]);
      expect(out.unresolved).toEqual([]);
    });
  }
});

describe("resolveSubjects bosses", () => {
  const cases: [string, string][] = [
    ["Armos Knights", "ep"],
    ["armos", "ep"],
    ["Lanmolas", "dp"],
    ["Moldorm", "toh"],
    ["Helmasaur King", "pod"],
    ["Arrghus", "sp"],
    ["Mothula", "sw"],
    ["Blind the Thief", "tt"],
    ["Kholdstare", "ip"],
    ["Vitreous", "mm"],
    ["Trinexx", "tr"],
    ["Agahnim", "ct"],
    ["Agahnim 2", "gt"],
    ["Ganon", "gt"],
    ["Ball & Chain Guard", "hc"],
  ];
  for (const [written, key] of cases) {
    it(`sends the boss ${JSON.stringify(written)} to its dungeon ${key}`, () => {
      expect(resolveSubjects([written]).dungeons).toEqual([{ game: "alttp", key }]);
    });
  }
});

describe("resolveSubjects items", () => {
  it("reads items by name, plural and possessive", () => {
    const names = ["Hookshot", "Pegasus Boots", "boots", "Titan's Mitts", "Fire Rod", "bombs"];
    const out = resolveSubjects(names);
    expect(keysOf(out.items)).toEqual(["hookshot", "boots", "mitts", "fire_rod", "bombs"]);
    expect(out.dungeons).toEqual([]);
    expect(out.unresolved).toEqual([]);
  });

  it("takes the longest phrase, so the mirror shield is a shield and not the mirror", () => {
    expect(keysOf(resolveSubjects(["Mirror Shield"]).items)).toEqual(["shield"]);
    expect(keysOf(resolveSubjects(["Magic Mirror"]).items)).toEqual(["mirror"]);
    expect(resolveSubjects(["Ice Rod"]).dungeons).toEqual([]);
    expect(keysOf(resolveSubjects(["Ice Rod"]).items)).toEqual(["ice_rod"]);
  });

  it("tags every hit with its game", () => {
    const out = resolveSubjects(["Hookshot", "Ice Palace"]);
    expect(out.items).toEqual([{ game: "alttp", key: "hookshot" }]);
    expect(out.dungeons).toEqual([{ game: "alttp", key: "ip" }]);
  });
});

describe("resolveSubjects mixed input", () => {
  it("finds several names inside one string, in order, without repeats", () => {
    const out = resolveSubjects(["mire and turtle rock", "Misery Mire"]);
    expect(keysOf(out.dungeons)).toEqual(["mm", "tr"]);
  });

  it("returns names it cannot place, as written and trimmed", () => {
    const out = resolveSubjects(["  Kakariko Well ", "Ice Palace", "", "   "]);
    expect(keysOf(out.dungeons)).toEqual(["ip"]);
    expect(out.unresolved).toEqual(["Kakariko Well"]);
  });

  it("returns nothing for no names", () => {
    expect(resolveSubjects([])).toEqual({ dungeons: [], items: [], unresolved: [] });
  });

  it("restricts to a game when given one", () => {
    expect(resolveSubjects(["Hookshot", "Ice Palace"], "sm")).toEqual({
      dungeons: [],
      items: [],
      unresolved: ["Hookshot", "Ice Palace"],
    });
    expect(keysOf(resolveSubjects(["Ice Palace"], "alttp").dungeons)).toEqual(["ip"]);
  });
});

describe("inferGame", () => {
  it("prefers the router's choice", () => {
    expect(inferGame("sm", ["Ice Palace"])).toBe("sm");
    expect(inferGame("alttp", [])).toBe("alttp");
  });

  it("reads the game from what the names resolve to", () => {
    expect(inferGame(undefined, ["Kholdstare"])).toBe("alttp");
    expect(inferGame(undefined, ["Hookshot"])).toBe("alttp");
  });

  it("falls back to A Link to the Past", () => {
    expect(inferGame(undefined, [])).toBe("alttp");
    expect(inferGame(undefined, ["nothing known"])).toBe("alttp");
  });
});

describe("catalog", () => {
  it("names every game id", () => {
    expect([...GAME_IDS].sort()).toEqual(Object.keys(GAME_NAMES).sort());
  });

  it("gives every entry a game, a key unique within its kind and game, and a name", () => {
    for (const list of [AREAS, BOSSES, ITEMS]) {
      const seen = new Set<string>();
      for (const e of list) {
        expect(GAME_IDS as readonly string[], e.key).toContain(e.game);
        expect(e.name.length, e.key).toBeGreaterThan(0);
        expect(e.aliases.length, e.key).toBeGreaterThan(0);
        const id = `${e.game}/${e.key}`;
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it("has the 13 dungeons of A Link to the Past", () => {
    expect(AREAS.filter((a) => a.game === "alttp")).toHaveLength(13);
  });

  it("points every boss at an area of the same game", () => {
    for (const b of BOSSES) {
      expect(
        AREAS.some((a) => a.game === b.game && a.key === b.area),
        b.key,
      ).toBe(true);
    }
  });

  it("resolves every name and alias to exactly the entry that owns it", () => {
    const check = (game: GameId, text: string, where: "dungeons" | "items", key: string): void => {
      const out = resolveSubjects([text], game);
      const other = where === "dungeons" ? out.items : out.dungeons;
      expect(other, text).toEqual([]);
      expect(out[where], text).toEqual([{ game, key }]);
    };
    for (const a of AREAS)
      for (const t of [a.name, ...a.aliases]) check(a.game, t, "dungeons", a.key);
    for (const b of BOSSES)
      for (const t of [b.name, ...b.aliases]) check(b.game, t, "dungeons", b.area);
    for (const i of ITEMS) for (const t of [i.name, ...i.aliases]) check(i.game, t, "items", i.key);
  });
});

describe("findSubjectsInText", () => {
  const found = (text: string): string[] => findSubjectsInText(text).map((h) => h.key);

  it("finds a dungeon nickname, a boss name and an item name inside a sentence", () => {
    expect(findSubjectsInText("anyone know how hard mire is?")).toEqual([
      { game: "alttp", key: "mm", kind: "area", name: "Misery Mire" },
    ]);
    expect(findSubjectsInText("kholdstare keeps killing me")).toEqual([
      { game: "alttp", key: "ip", kind: "area", name: "Kholdstare" },
    ]);
    expect(findSubjectsInText("is the hookshot worth it")).toEqual([
      { game: "alttp", key: "hookshot", kind: "item", name: "Hookshot" },
    ]);
  });

  it("matches whole words in any case, with plurals and possessives", () => {
    expect(found("GANON'S TOWER is next")).toEqual(["gt"]);
    expect(found("Thieves' Town and the Pegasus Boots")).toEqual(["tt", "boots"]);
    expect(found("my bombs ran out")).toEqual(["bombs"]);
    expect(found("the swampy road")).toEqual([]);
    expect(found("meretriceps")).toEqual([]);
  });

  it("takes the longest phrase and lists each hit once, in order", () => {
    expect(found("the mirror shield, then the magic mirror, then mirror shield again")).toEqual([
      "shield",
      "mirror",
    ]);
    expect(found("ice palace and ice rod")).toEqual(["ip", "ice_rod"]);
    expect(found("kholdstare is in the ice palace")).toEqual(["ip"]);
  });

  it("never reads the two letter codes", () => {
    expect(found("tt mm ip hc ct ep dp sp sw tr gt")).toEqual([]);
    expect(found("how do i do it in tr")).toEqual([]);
  });

  it("leaves everyday words alone but keeps their full names", () => {
    expect(found("i need to book a flight and check my mail on the net, then bow out")).toEqual([]);
    expect(found("the Book of Mudora")).toEqual(["book"]);
    expect(found("a Bug Net")).toEqual(["net"]);
    expect(found("blind the thief")).toEqual(["tt"]);
  });

  it("finds nothing in a greeting or plain chatter", () => {
    expect(found("hey wizzbrew, thanks for the help!")).toEqual([]);
    expect(found("")).toEqual([]);
  });
});
