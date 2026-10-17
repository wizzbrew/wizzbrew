import type { RoutingDecision } from "../types.js";

// The names the game route understands, per game. Adding a game means adding its id to the
// params type, an entry in GAME_NAMES and its areas, bosses and items below; nothing else in
// src/game reads a game by name. Data for a game lives under prompts/<game>/ (see
// scripts/build-game.ts), with one file per area at dungeons/<key>.md whatever the game calls it.
export type GameId = NonNullable<RoutingDecision["params"]["game"]>;

export const GAME_NAMES: Record<GameId, string> = {
  alttp: "A Link to the Past",
  sm: "Super Metroid",
};

export const GAME_IDS = Object.keys(GAME_NAMES) as [GameId, ...GameId[]];

export interface CatalogEntry {
  game: GameId;
  key: string; // short code, unique within the game
  name: string;
  aliases: readonly string[]; // other ways to write it; matching ignores case and punctuation
}

// A dungeon or a region: the unit that has its own notes file.
export type Area = CatalogEntry;
// A boss resolves to the area that holds it.
export interface Boss extends CatalogEntry {
  area: string; // key of an Area in the same game
}
export type Item = CatalogEntry;

export interface Hit {
  game: GameId;
  key: string;
}

const alttp = <T extends Omit<CatalogEntry, "game">>(entry: T): T & { game: "alttp" } => ({
  ...entry,
  game: "alttp",
});

const ALTTP_AREAS: readonly Area[] = [
  alttp({
    key: "hc",
    name: "Hyrule Castle",
    aliases: ["hc", "hyrule castle", "hyrule castle sewers", "hyrule castle escape", "sewers"],
  }),
  alttp({
    key: "ct",
    name: "Castle Tower",
    aliases: ["ct", "castle tower", "agahnim's tower", "aga tower", "agatower"],
  }),
  alttp({ key: "ep", name: "Eastern Palace", aliases: ["ep", "eastern palace", "eastern"] }),
  alttp({ key: "dp", name: "Desert Palace", aliases: ["dp", "desert palace", "desert"] }),
  alttp({ key: "toh", name: "Tower of Hera", aliases: ["toh", "tower of hera", "hera"] }),
  alttp({
    key: "pod",
    name: "Palace of Darkness",
    aliases: ["pod", "palace of darkness", "dark palace"],
  }),
  alttp({ key: "sp", name: "Swamp Palace", aliases: ["sp", "swamp palace", "swamp"] }),
  alttp({ key: "sw", name: "Skull Woods", aliases: ["sw", "skull woods", "skull"] }),
  alttp({
    key: "tt",
    name: "Thieves' Town",
    aliases: ["tt", "thieves town", "thieves", "thief town"],
  }),
  alttp({ key: "ip", name: "Ice Palace", aliases: ["ip", "ice palace"] }),
  alttp({ key: "mm", name: "Misery Mire", aliases: ["mm", "misery mire", "mire"] }),
  alttp({ key: "tr", name: "Turtle Rock", aliases: ["tr", "turtle rock", "turtle", "trock"] }),
  alttp({
    key: "gt",
    name: "Ganon's Tower",
    aliases: ["gt", "ganon's tower", "ganon tower", "gtower"],
  }),
];

const ALTTP_BOSSES: readonly Boss[] = [
  alttp({
    key: "ball_chain_guard",
    name: "Ball & Chain Guard",
    area: "hc",
    aliases: ["ball and chain guard", "ball & chain guard", "ball chain guard"],
  }),
  alttp({ key: "agahnim", name: "Agahnim", area: "ct", aliases: ["agahnim", "aga", "agahnim 1"] }),
  alttp({
    key: "armos",
    name: "Armos Knights",
    area: "ep",
    aliases: ["armos knights", "armos knight", "armos"],
  }),
  alttp({ key: "lanmolas", name: "Lanmolas", area: "dp", aliases: ["lanmolas", "lanmola"] }),
  alttp({ key: "moldorm", name: "Moldorm", area: "toh", aliases: ["moldorm"] }),
  alttp({
    key: "helmasaur",
    name: "Helmasaur King",
    area: "pod",
    aliases: ["helmasaur king", "helmasaur"],
  }),
  alttp({ key: "arrghus", name: "Arrghus", area: "sp", aliases: ["arrghus"] }),
  alttp({ key: "mothula", name: "Mothula", area: "sw", aliases: ["mothula"] }),
  alttp({
    key: "blind",
    name: "Blind the Thief",
    area: "tt",
    aliases: ["blind", "blind the thief"],
  }),
  alttp({ key: "kholdstare", name: "Kholdstare", area: "ip", aliases: ["kholdstare", "khold"] }),
  alttp({ key: "vitreous", name: "Vitreous", area: "mm", aliases: ["vitreous"] }),
  alttp({ key: "trinexx", name: "Trinexx", area: "tr", aliases: ["trinexx"] }),
  alttp({
    key: "agahnim2",
    name: "Agahnim 2",
    area: "gt",
    aliases: ["agahnim 2", "aga 2", "agahnim two"],
  }),
  alttp({ key: "ganon", name: "Ganon", area: "gt", aliases: ["ganon"] }),
];

const ALTTP_ITEMS: readonly Item[] = [
  alttp({
    key: "sword",
    name: "Sword",
    aliases: ["sword", "master sword", "fighter sword", "tempered sword", "golden sword"],
  }),
  alttp({
    key: "bow",
    name: "Bow",
    aliases: ["bow", "arrows", "silver arrows", "silvers", "bow and arrows"],
  }),
  alttp({
    key: "boomerang",
    name: "Boomerang",
    aliases: ["boomerang", "blue boomerang", "red boomerang"],
  }),
  alttp({ key: "hookshot", name: "Hookshot", aliases: ["hookshot", "hook shot"] }),
  alttp({ key: "bombs", name: "Bombs", aliases: ["bombs", "bomb"] }),
  alttp({ key: "fire_rod", name: "Fire Rod", aliases: ["fire rod"] }),
  alttp({ key: "ice_rod", name: "Ice Rod", aliases: ["ice rod"] }),
  alttp({
    key: "somaria",
    name: "Cane of Somaria",
    aliases: ["cane of somaria", "somaria", "red cane"],
  }),
  alttp({ key: "byrna", name: "Cane of Byrna", aliases: ["cane of byrna", "byrna", "blue cane"] }),
  alttp({ key: "hammer", name: "Hammer", aliases: ["hammer", "magic hammer"] }),
  alttp({ key: "bombos", name: "Bombos Medallion", aliases: ["bombos", "bombos medallion"] }),
  alttp({ key: "ether", name: "Ether Medallion", aliases: ["ether", "ether medallion"] }),
  alttp({ key: "quake", name: "Quake Medallion", aliases: ["quake", "quake medallion"] }),
  alttp({ key: "medallion", name: "Medallions", aliases: ["medallion", "medallions"] }),
  alttp({ key: "lantern", name: "Lantern", aliases: ["lantern", "lamp"] }),
  alttp({ key: "mirror", name: "Magic Mirror", aliases: ["magic mirror", "mirror"] }),
  alttp({ key: "boots", name: "Pegasus Boots", aliases: ["pegasus boots", "boots"] }),
  alttp({
    key: "glove",
    name: "Power Glove",
    aliases: ["power glove", "glove", "gloves", "power gloves"],
  }),
  alttp({
    key: "mitts",
    name: "Titan's Mitts",
    aliases: ["titan's mitts", "titan mitts", "mitts", "mitt"],
  }),
  alttp({ key: "flippers", name: "Flippers", aliases: ["flippers", "zora's flippers"] }),
  alttp({ key: "pearl", name: "Moon Pearl", aliases: ["moon pearl", "pearl"] }),
  alttp({ key: "cape", name: "Magic Cape", aliases: ["magic cape", "cape"] }),
  alttp({ key: "net", name: "Bug Net", aliases: ["bug net", "net"] }),
  alttp({ key: "book", name: "Book of Mudora", aliases: ["book of mudora", "book", "mudora"] }),
  alttp({ key: "bottle", name: "Bottles", aliases: ["bottle", "bottles"] }),
  alttp({
    key: "shield",
    name: "Shield",
    aliases: ["shield", "fighter shield", "fire shield", "mirror shield"],
  }),
  alttp({
    key: "mail",
    name: "Mail",
    aliases: ["mail", "green mail", "blue mail", "red mail", "tunic"],
  }),
  alttp({ key: "half_magic", name: "Half Magic", aliases: ["half magic", "magic meter"] }),
  alttp({ key: "flute", name: "Flute", aliases: ["flute", "ocarina"] }),
];

export const AREAS: readonly Area[] = [...ALTTP_AREAS];
export const BOSSES: readonly Boss[] = [...ALTTP_BOSSES];
export const ITEMS: readonly Item[] = [...ALTTP_ITEMS];

// Lowercase, apostrophes dropped (so a possessive joins its word), every other mark a space,
// and a plural s taken off words longer than three letters. Applied to aliases and to what a
// person wrote alike, so the two meet in the middle.
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['‘’ʼ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((t) => t !== "")
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

interface Target {
  kind: "area" | "item";
  game: GameId;
  key: string;
}

let indexCache: { byPhrase: Map<string, Target[]>; longest: number } | undefined;

function index(): { byPhrase: Map<string, Target[]>; longest: number } {
  if (indexCache) return indexCache;
  const byPhrase = new Map<string, Target[]>();
  let longest = 1;
  const add = (aliases: readonly string[], target: Target): void => {
    for (const alias of aliases) {
      const words = tokens(alias);
      if (words.length === 0) continue;
      longest = Math.max(longest, words.length);
      const phrase = words.join(" ");
      const list = byPhrase.get(phrase) ?? [];
      if (
        !list.some((t) => t.kind === target.kind && t.game === target.game && t.key === target.key)
      ) {
        list.push(target);
      }
      byPhrase.set(phrase, list);
    }
  };
  for (const a of AREAS) add([a.name, ...a.aliases], { kind: "area", game: a.game, key: a.key });
  for (const b of BOSSES) {
    add([b.name, ...b.aliases], { kind: "area", game: b.game, key: b.area });
  }
  for (const i of ITEMS) add([i.name, ...i.aliases], { kind: "item", game: i.game, key: i.key });
  indexCache = { byPhrase, longest };
  return indexCache;
}

export interface Resolved {
  dungeons: Hit[]; // areas named directly or through their boss, in the order found, no repeats
  items: Hit[];
  unresolved: string[]; // the names, as written, that matched nothing
}

// Finds the areas, bosses and items a list of names refers to. Each name is scanned for the
// longest known phrase at every position, so a name with extra words around a known one still
// resolves, and "mirror shield" is the shield, not the mirror. With a game given, only that
// game's entries count; a name that only another game knows comes back unresolved.
export function resolveSubjects(names: readonly string[], game?: GameId): Resolved {
  const { byPhrase, longest } = index();
  const out: Resolved = { dungeons: [], items: [], unresolved: [] };
  const push = (list: Hit[], hit: Hit): void => {
    if (!list.some((h) => h.game === hit.game && h.key === hit.key)) list.push(hit);
  };
  for (const name of names) {
    const words = tokens(name);
    let found = false;
    for (let at = 0; at < words.length; ) {
      let advanced = 0;
      for (let len = Math.min(longest, words.length - at); len >= 1 && advanced === 0; len--) {
        const targets = (byPhrase.get(words.slice(at, at + len).join(" ")) ?? []).filter(
          (t) => game === undefined || t.game === game,
        );
        if (targets.length === 0) continue;
        for (const t of targets) {
          push(t.kind === "area" ? out.dungeons : out.items, { game: t.game, key: t.key });
        }
        found = true;
        advanced = len;
      }
      at += advanced === 0 ? 1 : advanced;
    }
    if (!found) {
      const trimmed = name.trim();
      if (trimmed !== "") out.unresolved.push(trimmed);
    }
  }
  return out;
}

// The game a request is about: the router's choice, else the game of the first thing the names
// resolved to, else A Link to the Past.
export function inferGame(chosen: GameId | undefined, names: readonly string[]): GameId {
  if (chosen) return chosen;
  const found = resolveSubjects(names);
  return found.dungeons[0]?.game ?? found.items[0]?.game ?? "alttp";
}
