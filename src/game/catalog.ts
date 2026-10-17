import type { RoutingDecision } from "../types.js";

// The names the game route understands, per game. Adding a game means adding its id to the
// params type, an entry in GAME_NAMES and its areas, bosses and items below; nothing else in
// src/game reads a game by name. Data for a game lives under prompts/<game>/ (see
// scripts/build-game.ts), with one file per area at dungeons/<key>.md whatever the game calls it.
export type GameId = NonNullable<RoutingDecision["params"]["game"]>;

export const GAME_NAMES: Record<GameId, string> = {
  alttp: "A Link to the Past",
  sm: "Super Metroid",
  z1r: "Zelda 1 Randomizer",
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

const sm = <T extends Omit<CatalogEntry, "game">>(entry: T): T & { game: "sm" } => ({
  ...entry,
  game: "sm",
});

const z1r = <T extends Omit<CatalogEntry, "game">>(entry: T): T & { game: "z1r" } => ({
  ...entry,
  game: "z1r",
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

// Super Metroid. The seven keys are the files under prompts/sm/dungeons and prompts/sm/logic.
// "norfair" alone is written by people who mean either half, so it names both. The two letter
// names (hj, sj, pb, mb, g4) work in a name list and are ignored inside a sentence.
const SM_AREAS: readonly Area[] = [
  sm({ key: "crateria", name: "Crateria", aliases: ["crateria"] }),
  sm({
    key: "brinstar",
    name: "Brinstar",
    aliases: [
      "brinstar",
      "green brinstar",
      "pink brinstar",
      "red brinstar",
      "blue brinstar",
      "red tower",
    ],
  }),
  sm({
    key: "norfair_upper",
    name: "Upper Norfair",
    aliases: ["upper norfair", "norfair upper", "bubble norfair", "norfair"],
  }),
  sm({
    key: "norfair_lower",
    name: "Lower Norfair",
    aliases: ["lower norfair", "norfair lower", "norfair"],
  }),
  sm({ key: "wrecked_ship", name: "Wrecked Ship", aliases: ["wrecked ship", "the ship"] }),
  sm({ key: "maridia", name: "Maridia", aliases: ["maridia"] }),
  sm({ key: "tourian", name: "Tourian", aliases: ["tourian"] }),
];

const SM_BOSSES: readonly Boss[] = [
  sm({ key: "bomb_torizo", name: "Bomb Torizo", area: "crateria", aliases: ["bomb torizo"] }),
  sm({
    key: "golden_four",
    name: "Golden Four",
    area: "crateria",
    aliases: ["golden four", "golden 4", "g4"],
  }),
  sm({
    key: "spore_spawn",
    name: "Spore Spawn",
    area: "brinstar",
    aliases: ["spore spawn", "sporespawn"],
  }),
  sm({ key: "kraid", name: "Kraid", area: "brinstar", aliases: ["kraid", "kraid's lair"] }),
  sm({ key: "crocomire", name: "Crocomire", area: "norfair_upper", aliases: ["crocomire"] }),
  sm({
    key: "golden_torizo",
    name: "Golden Torizo",
    area: "norfair_lower",
    aliases: ["golden torizo", "gold torizo"],
  }),
  sm({ key: "ridley", name: "Ridley", area: "norfair_lower", aliases: ["ridley"] }),
  sm({ key: "phantoon", name: "Phantoon", area: "wrecked_ship", aliases: ["phantoon"] }),
  sm({ key: "botwoon", name: "Botwoon", area: "maridia", aliases: ["botwoon"] }),
  sm({ key: "draygon", name: "Draygon", area: "maridia", aliases: ["draygon"] }),
  sm({
    key: "mother_brain",
    name: "Mother Brain",
    area: "tourian",
    aliases: ["mother brain", "mb"],
  }),
];

const SM_ITEMS: readonly Item[] = [
  sm({
    key: "morph",
    name: "Morph Ball",
    aliases: ["morph ball", "morph", "morphing ball", "morphball"],
  }),
  sm({ key: "bombs", name: "Bombs", aliases: ["bombs", "bomb", "morph ball bombs"] }),
  sm({ key: "charge", name: "Charge Beam", aliases: ["charge beam", "charge"] }),
  sm({ key: "ice", name: "Ice Beam", aliases: ["ice beam", "ice"] }),
  sm({ key: "wave", name: "Wave Beam", aliases: ["wave beam", "wave"] }),
  sm({ key: "spazer", name: "Spazer", aliases: ["spazer", "spazer beam"] }),
  sm({ key: "plasma", name: "Plasma Beam", aliases: ["plasma beam", "plasma"] }),
  sm({ key: "varia", name: "Varia Suit", aliases: ["varia suit", "varia"] }),
  sm({ key: "gravity", name: "Gravity Suit", aliases: ["gravity suit", "gravity"] }),
  sm({
    key: "hi_jump",
    name: "Hi-Jump Boots",
    aliases: ["hi-jump boots", "hi-jump", "hijump", "high jump boots", "high jump", "hj"],
  }),
  sm({ key: "space_jump", name: "Space Jump", aliases: ["space jump", "spacejump", "sj"] }),
  sm({
    key: "speed",
    name: "Speed Booster",
    aliases: ["speed booster", "speedbooster", "speed"],
  }),
  sm({ key: "spring_ball", name: "Spring Ball", aliases: ["spring ball", "springball"] }),
  sm({ key: "screw", name: "Screw Attack", aliases: ["screw attack", "screw"] }),
  sm({
    key: "grapple",
    name: "Grappling Beam",
    aliases: ["grappling beam", "grapple beam", "grapple"],
  }),
  sm({ key: "xray", name: "X-Ray Scope", aliases: ["x-ray scope", "x-ray", "xray"] }),
  sm({ key: "power_beam", name: "Power Beam", aliases: ["power beam"] }),
  sm({ key: "hyper_beam", name: "Hyper Beam", aliases: ["hyper beam"] }),
  sm({
    key: "missiles",
    name: "Missiles",
    aliases: ["missiles", "missile", "missile pack", "missile packs"],
  }),
  sm({
    key: "super_missiles",
    name: "Super Missiles",
    aliases: ["super missiles", "super missile", "super missile pack", "supers", "super"],
  }),
  sm({
    key: "power_bombs",
    name: "Power Bombs",
    aliases: ["power bombs", "power bomb", "power bomb pack", "pbs", "pb"],
  }),
  sm({
    key: "energy_tank",
    name: "Energy Tank",
    aliases: ["energy tank", "energy tanks", "e-tank", "e-tanks", "etank", "etanks"],
  }),
  sm({
    key: "reserve_tank",
    name: "Reserve Tank",
    aliases: ["reserve tank", "reserve tanks", "reserves", "reserve"],
  }),
];

// The Legend of Zelda on the NES and its randomizer (Z1R). The nine keys are the files under
// prompts/z1r/dungeons and prompts/z1r/logic. Each level has a first quest shape name that
// people use for it. The two letter names (l1 to l9) work in a name list and are ignored inside a
// sentence. A boss points at its vanilla level: Aquamentus and Gleeok each appear twice in the
// first quest, and the catalog keeps their first level.
const Z1R_LEVELS: readonly [string, string, string, string][] = [
  ["level1", "1", "one", "Eagle"],
  ["level2", "2", "two", "Moon"],
  ["level3", "3", "three", "Manji"],
  ["level4", "4", "four", "Snake"],
  ["level5", "5", "five", "Lizard"],
  ["level6", "6", "six", "Dragon"],
  ["level7", "7", "seven", "Demon"],
  ["level8", "8", "eight", "Lion"],
  ["level9", "9", "nine", "Death Mountain"],
];

const Z1R_AREAS: readonly Area[] = Z1R_LEVELS.map(([key, digit, word, shape]) =>
  z1r({
    key,
    name: `Level ${digit} (${shape})`,
    aliases: [
      `level ${digit}`,
      `level ${word}`,
      `l${digit}`,
      `lvl ${digit}`,
      `dungeon ${digit}`,
      `dungeon ${word}`,
      shape.toLowerCase(),
      ...(shape === "Death Mountain" ? [] : [`${shape.toLowerCase()} dungeon`]),
      ...(shape === "Manji" ? ["kanji"] : []),
    ],
  }),
);

const Z1R_BOSSES: readonly Boss[] = [
  z1r({ key: "aquamentus", name: "Aquamentus", area: "level1", aliases: ["aquamentus"] }),
  z1r({ key: "dodongo", name: "Dodongo", area: "level2", aliases: ["dodongo"] }),
  z1r({ key: "manhandla", name: "Manhandla", area: "level3", aliases: ["manhandla"] }),
  z1r({ key: "gleeok", name: "Gleeok", area: "level4", aliases: ["gleeok"] }),
  z1r({ key: "digdogger", name: "Digdogger", area: "level5", aliases: ["digdogger"] }),
  z1r({ key: "gohma", name: "Gohma", area: "level6", aliases: ["gohma"] }),
  z1r({
    key: "hungry_goriya",
    name: "Hungry Goriya",
    area: "level7",
    aliases: ["hungry goriya"],
  }),
  z1r({ key: "patra", name: "Patra", area: "level9", aliases: ["patra"] }),
  z1r({ key: "ganon", name: "Ganon", area: "level9", aliases: ["ganon", "gannon"] }),
];

const Z1R_ITEMS: readonly Item[] = [
  z1r({ key: "raft", name: "Raft", aliases: ["raft"] }),
  z1r({
    key: "stepladder",
    name: "Stepladder",
    aliases: ["stepladder", "step ladder", "ladder"],
  }),
  z1r({ key: "recorder", name: "Recorder", aliases: ["recorder", "whistle"] }),
  z1r({
    key: "power_bracelet",
    name: "Power Bracelet",
    aliases: ["power bracelet", "bracelet"],
  }),
  z1r({ key: "bow", name: "Bow", aliases: ["bow"] }),
  z1r({ key: "arrows", name: "Arrows", aliases: ["arrows", "arrow"] }),
  z1r({
    key: "silver_arrows",
    name: "Silver Arrows",
    aliases: ["silver arrows", "silver arrow"],
  }),
  z1r({ key: "bombs", name: "Bombs", aliases: ["bombs", "bomb"] }),
  z1r({ key: "blue_candle", name: "Blue Candle", aliases: ["blue candle"] }),
  z1r({ key: "red_candle", name: "Red Candle", aliases: ["red candle"] }),
  z1r({ key: "candle", name: "Candle", aliases: ["candle"] }),
  z1r({ key: "magic_key", name: "Magic Key", aliases: ["magic key", "magical key", "key"] }),
  z1r({ key: "bait", name: "Bait", aliases: ["bait"] }),
  z1r({ key: "letter", name: "Letter", aliases: ["letter"] }),
  z1r({
    key: "magic_wand",
    name: "Magic Wand",
    aliases: ["magic wand", "wand", "magical rod", "magic rod"],
  }),
  z1r({
    key: "magic_book",
    name: "Magic Book",
    aliases: ["magic book", "magical book", "book of magic", "book"],
  }),
  z1r({ key: "blue_ring", name: "Blue Ring", aliases: ["blue ring"] }),
  z1r({ key: "red_ring", name: "Red Ring", aliases: ["red ring"] }),
  z1r({ key: "ring", name: "Ring", aliases: ["ring"] }),
  z1r({
    key: "boomerang",
    name: "Boomerang",
    aliases: ["boomerang", "wooden boomerang", "wood boomerang"],
  }),
  z1r({
    key: "magical_boomerang",
    name: "Magical Boomerang",
    aliases: ["magical boomerang", "magic boomerang"],
  }),
  z1r({ key: "wood_sword", name: "Wood Sword", aliases: ["wood sword", "wooden sword"] }),
  z1r({ key: "white_sword", name: "White Sword", aliases: ["white sword"] }),
  z1r({
    key: "magical_sword",
    name: "Magical Sword",
    aliases: ["magical sword", "magic sword"],
  }),
  z1r({ key: "sword", name: "Sword", aliases: ["sword"] }),
  z1r({
    key: "magic_shield",
    name: "Magic Shield",
    aliases: ["magic shield", "magical shield", "shield"],
  }),
  z1r({ key: "heart_container", name: "Heart Container", aliases: ["heart container", "heart"] }),
  z1r({
    key: "triforce",
    name: "Triforce",
    aliases: ["triforce", "triforce piece", "triforce fragment", "tringle"],
  }),
];

export const AREAS: readonly Area[] = [...ALTTP_AREAS, ...SM_AREAS, ...Z1R_AREAS];
export const BOSSES: readonly Boss[] = [...ALTTP_BOSSES, ...SM_BOSSES, ...Z1R_BOSSES];
export const ITEMS: readonly Item[] = [...ALTTP_ITEMS, ...SM_ITEMS, ...Z1R_ITEMS];

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
  name: string; // the name of the entry the phrase belongs to; a boss keeps its own
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
  for (const a of AREAS) {
    add([a.name, ...a.aliases], { kind: "area", game: a.game, key: a.key, name: a.name });
  }
  for (const b of BOSSES) {
    add([b.name, ...b.aliases], { kind: "area", game: b.game, key: b.area, name: b.name });
  }
  for (const i of ITEMS) {
    add([i.name, ...i.aliases], { kind: "item", game: i.game, key: i.key, name: i.name });
  }
  indexCache = { byPhrase, longest };
  return indexCache;
}

// One matched phrase: every entry it names, in every game. A phrase several games share (bombs)
// names each. With a game filter a phrase only another game knows still counts as matched, with
// nothing left in it, so its words are not read again as something shorter (Ice Palace is not
// an Ice Beam). Callers skip the empty ones.
type Match = Target[];

// Scans words for the longest known phrase at every position. With a game given, only that
// game's entries are kept. With text set, the single words that say nothing in a sentence are
// stepped over: the two letter codes and the everyday words.
function scan(words: readonly string[], game: GameId | undefined, text: boolean): Match[] {
  const { byPhrase, longest } = index();
  const out: Match[] = [];
  for (let at = 0; at < words.length; ) {
    let advanced = 0;
    for (let len = Math.min(longest, words.length - at); len >= 1 && advanced === 0; len--) {
      const slice = words.slice(at, at + len);
      const [only] = slice;
      if (
        text &&
        len === 1 &&
        only !== undefined &&
        (only.length <= 2 || EVERYDAY_WORDS.has(only))
      ) {
        continue;
      }
      const phrase = slice.join(" ");
      const named = byPhrase.get(phrase);
      if (named === undefined) continue;
      // In a sentence, a game's own skipped phrases drop out; what is left is what the phrase
      // still names in the other games, and a phrase with nothing left is stepped over.
      const targets = text ? named.filter((t) => !SKIPPED_IN_TEXT[t.game]?.has(phrase)) : named;
      if (targets.length === 0) continue;
      out.push(game === undefined ? targets : targets.filter((t) => t.game === game));
      advanced = len;
    }
    at += advanced === 0 ? 1 : advanced;
  }
  return out;
}

// The game a set of matches points at. The first area or boss settles it. With none, the game
// with the most items that only it has; an item several games have (bombs) votes for none. With
// no vote, A Link to the Past.
function pickGame(matches: readonly Match[]): GameId {
  for (const targets of matches) {
    const area = targets.find((t) => t.kind === "area");
    if (area !== undefined) return area.game;
  }
  const votes = new Map<GameId, number>();
  for (const targets of matches) {
    const games = new Set(targets.map((t) => t.game));
    const [only] = [...games];
    if (games.size === 1 && only !== undefined) votes.set(only, (votes.get(only) ?? 0) + 1);
  }
  let best: GameId = GAME_IDS[0];
  let most = 0;
  for (const id of GAME_IDS) {
    const n = votes.get(id) ?? 0;
    if (n > most) {
      best = id;
      most = n;
    }
  }
  return best;
}

export interface Resolved {
  dungeons: Hit[]; // areas named directly or through their boss, in the order found, no repeats
  items: Hit[];
  unresolved: string[]; // the names, as written, that matched nothing
}

// Finds the areas, bosses and items a list of names refers to. Each name is scanned for the
// longest known phrase at every position, so a name with extra words around a known one still
// resolves, and "mirror shield" is the shield, not the mirror. With a game given, only that
// game's entries count; a name that only another game knows comes back unresolved. Without one,
// a name several games share (bombs) resolves in each.
export function resolveSubjects(names: readonly string[], game?: GameId): Resolved {
  const out: Resolved = { dungeons: [], items: [], unresolved: [] };
  const push = (list: Hit[], hit: Hit): void => {
    if (!list.some((h) => h.game === hit.game && h.key === hit.key)) list.push(hit);
  };
  for (const name of names) {
    let found = false;
    for (const targets of scan(tokens(name), game, false)) {
      for (const t of targets) {
        push(t.kind === "area" ? out.dungeons : out.items, { game: t.game, key: t.key });
        found = true;
      }
    }
    if (!found) {
      const trimmed = name.trim();
      if (trimmed !== "") out.unresolved.push(trimmed);
    }
  }
  return out;
}

// The game a request is about: the router's choice, else the game the names point at (the first
// area or boss, then the items only one game has), else A Link to the Past.
export function inferGame(chosen: GameId | undefined, names: readonly string[]): GameId {
  if (chosen) return chosen;
  return pickGame(names.flatMap((name) => scan(tokens(name), undefined, false)));
}

// A hit found in free text: the catalog hit, whether it is an area (or a boss, which names its
// area) or an item, and the name of the entry that matched.
export interface TextHit extends Hit {
  kind: "area" | "item";
  name: string;
}

// One word nicknames that are also everyday words. Inside a sentence they say nothing about the
// game, so the text scan ignores them; the router still reads them in a name list.
const EVERYDAY_WORDS: ReadonlySet<string> = new Set([
  "net",
  "bow",
  "book",
  "mail",
  "lamp",
  "pod",
  "blind",
  "ice",
  "wave",
  "charge",
  "speed",
  "screw",
  "super",
  "gravity",
  "reserve",
  "plasma",
]);

// Phrases one game's catalog uses that say nothing about the game inside a sentence, because
// they are everyday words or names other Zelda games share. They are kept per game, so the same
// word still counts for the games that do not list it (bombs, sword and shield stay A Link to the
// Past, bombs also Super Metroid). Written as people write them; matched in the form tokens()
// gives. The router still reads them in a name list.
const SKIPPED_IN_TEXT: Partial<Record<GameId, ReadonlySet<string>>> = {
  z1r: new Set(
    [
      "raft",
      "ladder",
      "stepladder",
      "candle",
      "bait",
      "letter",
      "key",
      "ring",
      "wand",
      "book",
      "bow",
      "arrows",
      "bombs",
      "shield",
      "sword",
      "heart",
      "triforce",
      "recorder",
      "whistle",
      "eagle",
      "moon",
      "snake",
      "lizard",
      "dragon",
      "demon",
      "lion",
      "death mountain",
    ].map((phrase) => tokens(phrase).join(" ")),
  ),
};

// Scans a question for game names the router did not pick up. Whole words only, any case, and
// the longest phrase wins at each position. Full area, boss and item names and nicknames of three
// letters or more count; the two letter codes never do, because they collide with ordinary
// words, and neither do the everyday words above or a game's own skipped phrases. Hits come back
// in the order found, once each. A question that names things from several games is read as the
// one game pickGame chooses, and only that game's hits come back, so what follows never looks
// for a name in the wrong game.
export function findSubjectsInText(text: string): TextHit[] {
  const matches = scan(tokens(text), undefined, true);
  const game = pickGame(matches);
  const out: TextHit[] = [];
  for (const targets of matches) {
    for (const t of targets) {
      if (t.game !== game) continue;
      if (!out.some((h) => h.kind === t.kind && h.game === t.game && h.key === t.key)) {
        out.push({ game: t.game, key: t.key, kind: t.kind, name: t.name });
      }
    }
  }
  return out;
}
