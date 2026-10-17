import { describe, expect, it } from "vitest";
import {
  AREAS,
  BOSSES,
  type CatalogEntry,
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
    // Bombs is also a Super Metroid item, so this A Link to the Past case names its game.
    const out = resolveSubjects(names, "alttp");
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
    // Every entry of a game that writes the phrase the same way. More than one is allowed only
    // for the phrases listed here, which people use for either of two areas on purpose.
    const sharedInGame = new Map([["sm:norfair", ["norfair_lower", "norfair_upper"]]]);
    const ownersOf = (game: GameId, text: string): { dungeons: string[]; items: string[] } => {
      const same = (e: CatalogEntry): boolean =>
        e.game === game &&
        [e.name, ...e.aliases].some((t) => t.toLowerCase() === text.toLowerCase());
      return {
        dungeons: [
          ...new Set([
            ...AREAS.filter(same).map((a) => a.key),
            ...BOSSES.filter(same).map((b) => b.area),
          ]),
        ].sort(),
        items: ITEMS.filter(same)
          .map((i) => i.key)
          .sort(),
      };
    };
    const check = (game: GameId, text: string, where: "dungeons" | "items", key: string): void => {
      const out = resolveSubjects([text], game);
      const owned = ownersOf(game, text);
      expect(keysOf(out.dungeons).sort(), text).toEqual(owned.dungeons);
      expect(keysOf(out.items).sort(), text).toEqual(owned.items);
      expect(keysOf(out[where]), text).toContain(key);
      expect(
        [...out.dungeons, ...out.items].every((h) => h.game === game),
        text,
      ).toBe(true);
      if (owned.dungeons.length + owned.items.length > 1) {
        expect(sharedInGame.get(`${game}:${text.toLowerCase()}`), text).toEqual(owned.dungeons);
        expect(owned.items, text).toEqual([]);
      }
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

describe("Super Metroid catalog", () => {
  const sm = (names: string[]) => resolveSubjects(names, "sm");
  const hit = (key: string) => ({ game: "sm", key });

  it("has seven areas, eleven bosses and twenty three items", () => {
    expect(AREAS.filter((a) => a.game === "sm").map((a) => a.key)).toEqual([
      "crateria",
      "brinstar",
      "norfair_upper",
      "norfair_lower",
      "wrecked_ship",
      "maridia",
      "tourian",
    ]);
    expect(BOSSES.filter((b) => b.game === "sm")).toHaveLength(11);
    expect(ITEMS.filter((i) => i.game === "sm")).toHaveLength(23);
  });

  const areas: [string, string][] = [
    ["Crateria", "crateria"],
    ["Brinstar", "brinstar"],
    ["Pink Brinstar", "brinstar"],
    ["Red Tower", "brinstar"],
    ["Upper Norfair", "norfair_upper"],
    ["upper norfair?", "norfair_upper"],
    ["Bubble Norfair", "norfair_upper"],
    ["Lower Norfair", "norfair_lower"],
    ["Wrecked Ship", "wrecked_ship"],
    ["the ship", "wrecked_ship"],
    ["Maridia", "maridia"],
    ["Tourian", "tourian"],
  ];
  for (const [written, key] of areas) {
    it(`reads the area ${JSON.stringify(written)} as ${key}`, () => {
      expect(sm([written])).toEqual({ dungeons: [hit(key)], items: [], unresolved: [] });
    });
  }

  const bosses: [string, string][] = [
    ["Bomb Torizo", "crateria"],
    ["Golden Four", "crateria"],
    ["G4", "crateria"],
    ["golden 4", "crateria"],
    ["Spore Spawn", "brinstar"],
    ["Kraid", "brinstar"],
    ["Kraid's Lair", "brinstar"],
    ["Crocomire", "norfair_upper"],
    ["Golden Torizo", "norfair_lower"],
    ["Gold Torizo", "norfair_lower"],
    ["Ridley", "norfair_lower"],
    ["Phantoon", "wrecked_ship"],
    ["Botwoon", "maridia"],
    ["Draygon", "maridia"],
    ["Mother Brain", "tourian"],
    ["MB", "tourian"],
  ];
  for (const [written, area] of bosses) {
    it(`sends the boss ${JSON.stringify(written)} to its area ${area}`, () => {
      expect(sm([written])).toEqual({ dungeons: [hit(area)], items: [], unresolved: [] });
    });
  }

  const items: [string, string][] = [
    ["Morph", "morph"],
    ["Morph Ball", "morph"],
    ["Bombs", "bombs"],
    ["Charge", "charge"],
    ["Ice", "ice"],
    ["Ice Beam", "ice"],
    ["Wave", "wave"],
    ["Spazer", "spazer"],
    ["Plasma", "plasma"],
    ["Varia", "varia"],
    ["Gravity Suit", "gravity"],
    ["HJ", "hi_jump"],
    ["Hi-Jump Boots", "hi_jump"],
    ["SJ", "space_jump"],
    ["Space Jump", "space_jump"],
    ["Speed", "speed"],
    ["Speed Booster", "speed"],
    ["Spring Ball", "spring_ball"],
    ["Screw", "screw"],
    ["Grapple", "grapple"],
    ["X-Ray", "xray"],
    ["Power Beam", "power_beam"],
    ["Hyper Beam", "hyper_beam"],
    ["Missiles", "missiles"],
    ["Supers", "super_missiles"],
    ["Super Missile", "super_missiles"],
    ["PBs", "power_bombs"],
    ["Power Bomb", "power_bombs"],
    ["E-tanks", "energy_tank"],
    ["Energy Tank", "energy_tank"],
    ["Reserves", "reserve_tank"],
    ["Reserve Tank", "reserve_tank"],
  ];
  for (const [written, key] of items) {
    it(`reads the item ${JSON.stringify(written)} as ${key}`, () => {
      expect(sm([written])).toEqual({ dungeons: [], items: [hit(key)], unresolved: [] });
    });
  }

  it("lets Norfair on its own name both halves", () => {
    expect(keysOf(sm(["Norfair"]).dungeons)).toEqual(["norfair_upper", "norfair_lower"]);
    expect(resolveSubjects(["Norfair"]).dungeons.every((h) => h.game === "sm")).toBe(true);
  });

  it("lets a name carry words around a known one, and finds several in one string", () => {
    const out = sm(["Kraid's boss fight", "ridley and the screw attack", "Mother Brain"]);
    expect(keysOf(out.dungeons)).toEqual(["brinstar", "norfair_lower", "tourian"]);
    expect(keysOf(out.items)).toEqual(["screw"]);
  });
});

describe("names both games know", () => {
  it("keeps one entry per game for bombs", () => {
    expect(resolveSubjects(["bombs"]).items).toEqual([
      { game: "alttp", key: "bombs" },
      { game: "sm", key: "bombs" },
    ]);
    expect(resolveSubjects(["bombs"], "alttp").items).toEqual([{ game: "alttp", key: "bombs" }]);
    expect(resolveSubjects(["Bomb"], "sm").items).toEqual([{ game: "sm", key: "bombs" }]);
  });

  it("returns only the filtered game's hit and never reports the name unresolved", () => {
    for (const game of ["alttp", "sm"] as const) {
      const out = resolveSubjects(["Bombs"], game);
      expect(out.unresolved).toEqual([]);
      expect(out.dungeons).toEqual([]);
      expect(out.items).toEqual([{ game, key: "bombs" }]);
    }
  });

  it("reads the longest phrase before a shared word", () => {
    expect(resolveSubjects(["Bomb Torizo"]).items).toEqual([]);
    expect(resolveSubjects(["Bomb Torizo"]).dungeons).toEqual([{ game: "sm", key: "crateria" }]);
    expect(resolveSubjects(["Power Bombs"]).items).toEqual([{ game: "sm", key: "power_bombs" }]);
    expect(resolveSubjects(["Morph Ball Bombs"]).items).toEqual([{ game: "sm", key: "bombs" }]);
  });

  it("does not read the start of another game's longer name as a short name of its own", () => {
    expect(resolveSubjects(["Ice Palace"], "sm")).toEqual({
      dungeons: [],
      items: [],
      unresolved: ["Ice Palace"],
    });
    expect(resolveSubjects(["Ice Rod"], "sm").items).toEqual([]);
    expect(resolveSubjects(["Ice Beam"], "alttp").items).toEqual([]);
    expect(resolveSubjects(["Ice Palace"]).dungeons).toEqual([{ game: "alttp", key: "ip" }]);
    expect(resolveSubjects(["Ice Palace"]).items).toEqual([]);
    expect(resolveSubjects(["Ice"]).items).toEqual([{ game: "sm", key: "ice" }]);
  });
});

describe("inferGame with two games", () => {
  it("lets an area or boss outrank items, whatever the order", () => {
    expect(inferGame(undefined, ["Kraid"])).toBe("sm");
    expect(inferGame(undefined, ["Hookshot", "Kraid"])).toBe("sm");
    expect(inferGame(undefined, ["Kraid", "Hookshot"])).toBe("sm");
    expect(inferGame(undefined, ["Varia Suit", "Ice Palace"])).toBe("alttp");
    expect(inferGame(undefined, ["Bomb Torizo", "bombs"])).toBe("sm");
    expect(inferGame(undefined, ["bombs", "Ridley"])).toBe("sm");
  });

  it("takes the first area or boss when each game has one", () => {
    expect(inferGame(undefined, ["Ice Palace", "Kraid"])).toBe("alttp");
    expect(inferGame(undefined, ["Kraid", "Ice Palace"])).toBe("sm");
  });

  it("reads items only one game has, and lets a shared item decide nothing", () => {
    expect(inferGame(undefined, ["Varia Suit"])).toBe("sm");
    expect(inferGame(undefined, ["bombs", "Varia Suit"])).toBe("sm");
    expect(inferGame(undefined, ["Varia Suit", "bombs"])).toBe("sm");
    expect(inferGame(undefined, ["Hookshot", "Varia Suit", "Gravity Suit"])).toBe("sm");
    expect(inferGame(undefined, ["bombs", "Hookshot"])).toBe("alttp");
  });

  it("falls back to A Link to the Past for a shared item, a tie or no match", () => {
    expect(inferGame(undefined, ["bombs"])).toBe("alttp");
    expect(inferGame(undefined, ["Hookshot", "Varia Suit"])).toBe("alttp");
    expect(inferGame(undefined, ["xyzzy"])).toBe("alttp");
    expect(inferGame(undefined, [])).toBe("alttp");
  });

  it("keeps the router's choice over everything", () => {
    expect(inferGame("alttp", ["Kraid"])).toBe("alttp");
    expect(inferGame("sm", ["Ice Palace"])).toBe("sm");
  });
});

describe("findSubjectsInText with two games", () => {
  const found = (text: string): string[] =>
    findSubjectsInText(text).map((h) => `${h.game}:${h.key}`);

  it("finds an area, a boss and an item of Super Metroid inside a sentence", () => {
    expect(findSubjectsInText("how do i beat kraid")).toEqual([
      { game: "sm", key: "brinstar", kind: "area", name: "Kraid" },
    ]);
    expect(findSubjectsInText("is the varia suit worth it before ridley")).toEqual([
      { game: "sm", key: "varia", kind: "item", name: "Varia Suit" },
      { game: "sm", key: "norfair_lower", kind: "area", name: "Ridley" },
    ]);
    expect(found("going through Norfair")).toEqual(["sm:norfair_upper", "sm:norfair_lower"]);
  });

  it("never reads the two letter names of Super Metroid", () => {
    expect(found("hj sj pb mb g4 are all fine in the run")).toEqual([]);
    expect(found("golden four statues")).toEqual(["sm:crateria"]);
  });

  it("leaves the everyday words alone but keeps their full names", () => {
    expect(
      found("ice speed wave charge screw super gravity reserve plasma, i love ice cream"),
    ).toEqual([]);
    expect(found("the ice beam")).toEqual(["sm:ice"]);
    expect(found("a speed booster")).toEqual(["sm:speed"]);
    expect(found("wave beam and the screw attack")).toEqual(["sm:wave", "sm:screw"]);
    expect(found("my super missiles ran out")).toEqual(["sm:super_missiles"]);
    expect(found("a reserve tank")).toEqual(["sm:reserve_tank"]);
  });

  it("returns only one game's hits when the text names both", () => {
    expect(found("bombs for kraid's lair")).toEqual(["sm:bombs", "sm:brinstar"]);
    expect(found("bombs and the ice palace")).toEqual(["alttp:bombs", "alttp:ip"]);
    expect(found("kraid beat me in the ice palace")).toEqual(["sm:brinstar"]);
  });

  it("reads a shared item as A Link to the Past, unless the other words say otherwise", () => {
    expect(found("how many bombs")).toEqual(["alttp:bombs"]);
    expect(found("bombs and the varia suit")).toEqual(["sm:bombs", "sm:varia"]);
    expect(found("power bombs")).toEqual(["sm:power_bombs"]);
  });
});
