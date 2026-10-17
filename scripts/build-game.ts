// Turns prompts/<game>/ into src/game/data.ts, a TS constant the game route imports. Vercel's
// bundler cannot be trusted to ship loose markdown, so the text travels as code. Every file under
// prompts/<game>/ is read (markdown and logic/keys.json), and logic/<key>.md is rendered from
// keys.json here, never written by hand, followed by the location requirements from
// logic/requirements.json (and the Hybrid Major Glitches differences from
// logic/requirements-hmg.json) when they exist. Those two files only feed the rendering, so they
// stay out of data.ts. prompts/event/*.md (event facts, not a game) is read too, under the keys
// "event/<file>". Run with: npm run build:game
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { AREAS, GAME_IDS, type GameId } from "../src/game/catalog.js";

export const PROMPTS_DIR = fileURLToPath(new URL("../prompts", import.meta.url));
export const GAME_TS = fileURLToPath(new URL("../src/game/data.ts", import.meta.url));

const HEADER =
  "// Generated from prompts/ by scripts/build-game.ts. Do not edit; edit the markdown or logic/keys.json and run npm run build:game.";
// The formatter picks its quote style from the content, so the generated statement opts out of
// formatting; that keeps the output the same bytes whatever the text says.
const IGNORE = "// biome-ignore format: generated file, each string is one line by design";

const KEYS_FILE = "logic/keys.json";
const REQUIREMENTS_FILE = "logic/requirements.json";
const REQUIREMENTS_HMG_FILE = "logic/requirements-hmg.json";
// Inputs to the rendered logic files only; no code reads them, so they never reach data.ts.
const RENDER_ONLY = [REQUIREMENTS_FILE, REQUIREMENTS_HMG_FILE];

// A rendered logic/<key>.md stays under this many characters. Over it, identical requirement
// lines are grouped, then the dungeon's own name is dropped from location names; a file still
// over it fails the build.
export const LOGIC_FILE_CAP = 6000;

// The one folder under prompts/ that is not a game: event facts as flat markdown files.
export const EVENT_DIR = "event";

// What tools/export-key-logic.py writes. Checked here because the file is read from disk.
const Chests = z.union([z.string(), z.array(z.string()).min(1)]);
const Rule = z.union([
  z.number().int().nonnegative(),
  z
    .object({
      keys: z.number().int().nonnegative(),
      small_key_in: Chests.optional(),
      with_small_key: z.number().int().nonnegative().optional(),
      big_key_in: Chests.optional(),
      with_big_key: z.number().int().nonnegative().optional(),
    })
    .strict()
    .refine((r) => (r.small_key_in === undefined) === (r.with_small_key === undefined), {
      message: "small_key_in and with_small_key come together",
    })
    .refine((r) => (r.big_key_in === undefined) === (r.with_big_key === undefined), {
      message: "big_key_in and with_big_key come together",
    }),
]);
export const KeyTable = z.object({
  source: z.string(),
  dungeons: z.record(z.string(), z.record(z.string(), Rule)),
  constants: z.record(z.string(), z.unknown()),
});
export type KeyTable = z.infer<typeof KeyTable>;

function list(chests: string | string[]): string {
  return (Array.isArray(chests) ? chests : [chests]).join(" or ");
}

function countText(rule: z.infer<typeof Rule>): string {
  if (typeof rule === "number") return String(rule);
  const parts = [String(rule.keys)];
  if (rule.small_key_in !== undefined && rule.with_small_key !== undefined) {
    parts.push(`${rule.with_small_key} when a small key is in ${list(rule.small_key_in)}`);
  }
  if (rule.big_key_in !== undefined && rule.with_big_key !== undefined) {
    parts.push(`${rule.with_big_key} when the big key is in ${list(rule.big_key_in)}`);
  }
  return parts.join(", or ");
}

// The key door table of one dungeon as text, door name then count. A plain number is the count of
// small keys that must be held to open the door. A conditional door has its normal count first,
// then the lower count that applies when the named key sits in the named chest.
export function renderLogic(
  name: string,
  key: string,
  doors: KeyTable["dungeons"][string] | undefined,
): string {
  const title = `# ${name} (\`${key}\`): key door table`;
  if (doors === undefined) return `${title}\n\nThis dungeon has no entry in the key door table.\n`;
  const lines = Object.entries(doors).map(([door, rule]) => `- ${door}: ${countText(rule)}`);
  return [
    title,
    "",
    "Each line is a key door and the number of small keys that must be held to open it. Where a second count follows, it is the lower number that applies when the named key is in the named chest.",
    "",
    ...lines,
    "",
  ].join("\n");
}

// What tools/export-dungeon-logic.py writes, one file per logic. A requirement is its needs (each
// item required), its any-of groups (one item of each group required) and, where groups share
// items, the same groups written as alternatives (either: one whole set of items is enough).
const Names = z.array(z.string().min(1));
const Either = z
  .object({
    groups: z.array(z.number().int().nonnegative()).min(2),
    terms: z.array(Names.min(1)).min(1),
  })
  .strict();
const Requirement = z
  .object({ needs: Names, any_of: z.array(Names.min(2)), either: z.array(Either).optional() })
  .strict();
const LocationRequirement = Requirement.extend({
  name: z.string().min(1),
  region: z.string().min(1),
  small_keys: z.number().int().nonnegative(),
  big_key: z.boolean(),
  small_keys_without: z.record(z.string(), z.number().int().positive()).optional(),
}).strict();
const DungeonRequirements = z
  .object({
    entry: Requirement,
    locations: z.array(LocationRequirement),
    unreachable: z.array(z.string()),
  })
  .strict();
export const RequirementTable = z.object({
  source: z.string(),
  settings: z.record(z.string(), z.unknown()),
  levels: z.record(z.string(), z.array(z.string()).min(1)),
  dungeons: z.record(z.string(), DungeonRequirements),
});
export type RequirementTable = z.infer<typeof RequirementTable>;
type Requirement = z.infer<typeof Requirement>;
type LocationRequirement = z.infer<typeof LocationRequirement>;
type DungeonRequirements = z.infer<typeof DungeonRequirements>;

// How a requirement section is written: one line per location, or identical lines grouped, and
// with the dungeon's own name kept in location names or dropped.
export type SectionStyle = { group: boolean; shortNames: boolean };
const STYLES: SectionStyle[] = [
  { group: false, shortNames: false },
  { group: true, shortNames: false },
  { group: true, shortNames: true },
];

function orList(names: string[], last = "or"): string {
  if (names.length < 3) return names.join(` ${last} `);
  return `${names.slice(0, -1).join(", ")} ${last} ${names[names.length - 1]}`;
}

function keyCount(count: number): string {
  return `${count} small key${count === 1 ? "" : "s"}`;
}

// The item part of a requirement: needs, then each any-of group, with a block of groups that
// share items written once, where the first of them stood, as its alternatives.
function itemParts(req: Requirement, where: string): string[] {
  const blockAt = new Map<number, string[][]>();
  const covered = new Set<number>();
  for (const block of req.either ?? []) {
    for (const index of block.groups) {
      if (index >= req.any_of.length || covered.has(index)) {
        throw new Error(
          `${where}: an either block names group ${index}, which is missing or taken`,
        );
      }
      covered.add(index);
    }
    blockAt.set(Math.min(...block.groups), block.terms);
  }
  const parts = req.needs.length > 0 ? [req.needs.join(", ")] : [];
  req.any_of.forEach((group, index) => {
    const terms = blockAt.get(index);
    if (terms !== undefined)
      parts.push(`either ${terms.map((t) => t.join(" and ")).join(", or ")}`);
    else if (!covered.has(index)) parts.push(`any of ${orList(group)}`);
  });
  return parts;
}

// One requirement as text: the needs, each any-of group or block of alternatives, the small keys
// (and the higher count when an item is missing), then the big key. The parts are separated by
// semicolons so a block of alternatives never runs into the next part. Nothing at all reads
// "free".
export function requirementText(req: Requirement | LocationRequirement, where: string): string {
  const parts = itemParts(req, where);
  if ("small_keys" in req) {
    const base = req.small_keys;
    const keys = base > 0 ? [keyCount(base)] : [];
    const byCount = new Map<number, string[]>();
    for (const [item, count] of Object.entries(req.small_keys_without ?? {})) {
      if (count <= base) throw new Error(`${where}: ${item} does not raise the key count`);
      byCount.set(count, [...(byCount.get(count) ?? []), item]);
    }
    const counts = [...byCount.keys()].sort((a, b) => a - b);
    counts.forEach((count, i) => {
      const what = base > 0 || i > 0 ? String(count) : keyCount(count);
      keys.push(`${what} if ${orList(byCount.get(count) ?? [])} is missing`);
    });
    if (keys.length > 0) parts.push(keys.join(", "));
    if (req.big_key) parts.push("big key");
  }
  return parts.length === 0 ? "free" : parts.join("; ");
}

type Row = { name: string; text: string };

function rowsOf(dungeon: DungeonRequirements, key: string): Row[] {
  return dungeon.locations.map((loc) => ({
    name: loc.name,
    text: requirementText(loc, `${key} ${loc.name}`),
  }));
}

// The part of a location name before " - " that most of the dungeon's locations share.
function commonPrefix(names: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const name of names) {
    const cut = name.indexOf(" - ");
    if (cut > 0) counts.set(name.slice(0, cut), (counts.get(name.slice(0, cut)) ?? 0) + 1);
  }
  let best: string | undefined;
  for (const [prefix, count] of counts) {
    if (best === undefined || count > (counts.get(best) ?? 0)) best = prefix;
  }
  return best;
}

function lines(rows: Row[], style: SectionStyle, prefix: string | undefined): string[] {
  const named = rows.map((row) => ({
    name:
      style.shortNames && prefix !== undefined && row.name.startsWith(`${prefix} - `)
        ? row.name.slice(prefix.length + 3)
        : row.name,
    text: row.text,
  }));
  if (!style.group) return named.map((row) => `- ${row.name}: ${row.text}`);
  const byText = new Map<string, string[]>();
  for (const row of named) byText.set(row.text, [...(byText.get(row.text) ?? []), row.name]);
  return [...byText].map(([text, names]) => `- ${names.join(", ")}: ${text}`);
}

const LEVEL = /\b([A-Z][a-z]+) level (\d+)\b/g;
const HEART = "Boss Heart Container";

// Explains the level labels and the heart stand-in that the given text uses, and nothing else.
function legend(text: string, levels: RequirementTable["levels"]): string {
  const used = new Map<string, string>();
  for (const [label, family = "", level = ""] of text.matchAll(LEVEL)) {
    const name = levels[family]?.[Number(level) - 1];
    if (name === undefined) throw new Error(`no level name for ${label}`);
    used.set(label, `${label} is the ${name}`);
  }
  const sentences: string[] = [];
  if (used.size > 0) {
    const named = [...used].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, s]) => s);
    sentences.push(`A level counts copies of a progressive item: ${named.join(", ")}.`);
  }
  if (text.includes(HEART)) sentences.push(`${HEART} stands for a fourth heart.`);
  return sentences.map((s) => ` ${s}`).join("");
}

const SECTION_INTRO =
  "What the door randomizer's own logic needs for each location, read from the engine with its static key logic on (vanilla doors and entrances, open mode). Entry is what getting into the dungeon needs; each location lists only what it needs beyond entry, and free means nothing more. Semicolons separate the parts of a line, and every part applies. Any of needs one item of the group; either lists whole sets, any one of which is enough. Small keys count the chest keys held, as in the key door table.";

// The Hybrid Major Glitches lines that differ from no glitches, ending with the line that says
// the rest match.
function glitchedLines(
  key: string,
  dungeon: DungeonRequirements,
  glitched: DungeonRequirements,
  style: SectionStyle,
  prefix: string | undefined,
): string[] {
  const before = new Map(rowsOf(dungeon, key).map((row) => [row.name, row.text]));
  const changed = rowsOf(glitched, key).filter((row) => before.get(row.name) !== row.text);
  const entry = requirementText(glitched.entry, `${key} glitched entry`);
  const out: string[] = [];
  if (entry !== requirementText(dungeon.entry, `${key} entry`)) out.push(`- Entry: ${entry}`);
  out.push(...lines(changed, style, prefix));
  const lost = glitched.unreachable.filter((name) => !dungeon.unreachable.includes(name));
  if (lost.length > 0) out.push(`- Not reachable even with every item: ${lost.join(", ")}`);
  out.push(
    out.length === 0
      ? "- The entry and every location match no glitches."
      : "- Everything else matches no glitches.",
  );
  return out;
}

// The location requirements of one dungeon, then the Hybrid Major Glitches differences when that
// table is given.
export function renderLocationRequirements(
  key: string,
  ng: RequirementTable,
  hmg: RequirementTable | undefined,
  style: SectionStyle,
): string {
  const dungeon = ng.dungeons[key];
  if (dungeon === undefined) {
    return "## Location requirements\n\nThis dungeon has no entry in the location requirements.\n";
  }
  const prefix = commonPrefix(dungeon.locations.map((l) => l.name));
  const body = [
    `- Entry: ${requirementText(dungeon.entry, `${key} entry`)}`,
    ...lines(rowsOf(dungeon, key), style, prefix),
  ];
  if (dungeon.unreachable.length > 0) {
    body.push(`- Not reachable even with every item: ${dungeon.unreachable.join(", ")}`);
  }
  const sections = [["## Location requirements", "", SECTION_INTRO, "", ...body].join("\n")];
  const glitched = hmg?.dungeons[key];
  if (hmg !== undefined && glitched !== undefined) {
    const start = hmg.settings.starting_items;
    const held =
      Array.isArray(start) && start.length > 0
        ? ` It starts with ${orList(start.map(String), "and")}, so they are never listed.`
        : "";
    const intro = `The same rules under Hybrid Major Glitches logic, for the entry and each location whose requirement differs from no glitches.${held}`;
    const diff = glitchedLines(key, dungeon, glitched, style, prefix);
    sections.push(["## Hybrid Major Glitches", "", intro, "", ...diff].join("\n"));
  }
  const all = `${sections.join("\n\n")}\n`;
  const note = legend(all, { ...ng.levels, ...(hmg?.levels ?? {}) });
  return note === "" ? all : all.replace(SECTION_INTRO, `${SECTION_INTRO}${note}`);
}

// A dungeon's whole logic file: the key door table, then its location requirements when a table
// is given, in the first style that keeps the file under LOGIC_FILE_CAP.
export function renderLogicFile(
  name: string,
  key: string,
  doors: KeyTable["dungeons"][string] | undefined,
  ng: RequirementTable | undefined,
  hmg: RequirementTable | undefined,
): string {
  const head = renderLogic(name, key, doors);
  if (ng === undefined) {
    if (hmg !== undefined) throw new Error(`${REQUIREMENTS_HMG_FILE} needs ${REQUIREMENTS_FILE}`);
    return head;
  }
  for (const style of STYLES) {
    const text = `${head}\n${renderLocationRequirements(key, ng, hmg, style)}`;
    if (text.length < LOGIC_FILE_CAP) return text;
  }
  throw new Error(`the logic file for ${key} stays over ${LOGIC_FILE_CAP} characters even grouped`);
}

function walk(dir: string, rel: string, out: Record<string, string>): void {
  const entries = readdirSync(join(dir, rel), { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) walk(dir, child, out);
    else if (entry.isFile()) out[child] = readFileSync(join(dir, child), "utf8");
  }
}

// The markdown files directly inside prompts/event/. Anything else there is an error, so a stray
// file or folder cannot ship silently.
function readEventSources(dir: string, out: Record<string, string>): void {
  const entries = readdirSync(join(dir, EVENT_DIR), { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      throw new Error(`prompts/${EVENT_DIR}/${entry.name} is not a markdown file`);
    }
    const path = `${EVENT_DIR}/${entry.name}`;
    out[path] = readFileSync(join(dir, path), "utf8");
  }
}

// Every file under prompts/<game>/, as paths relative to prompts/ with forward slashes, plus the
// event facts under prompts/event/. A directory that is not a known game id is an error, so a
// typo cannot ship silently.
export function readGameSources(dir: string = PROMPTS_DIR): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) throw new Error(`prompts/${entry.name} is not inside a game folder`);
    if (entry.name === EVENT_DIR) {
      readEventSources(dir, out);
      continue;
    }
    if (!(GAME_IDS as readonly string[]).includes(entry.name)) {
      throw new Error(`prompts/${entry.name} is not a known game id`);
    }
    walk(dir, entry.name, out);
  }
  return out;
}

// The sources plus every rendered logic/<key>.md, keyed by path, in a stable order.
export function buildGameData(sources: Record<string, string>): Record<string, string> {
  const data: Record<string, string> = { ...sources };
  for (const game of GAME_IDS) {
    for (const file of RENDER_ONLY) delete data[`${game}/${file}`];
    const rawKeys = sources[`${game}/${KEYS_FILE}`];
    const rawNg = sources[`${game}/${REQUIREMENTS_FILE}`];
    const rawHmg = sources[`${game}/${REQUIREMENTS_HMG_FILE}`];
    if (rawKeys === undefined && rawNg === undefined && rawHmg === undefined) continue;
    const table = rawKeys === undefined ? undefined : KeyTable.parse(JSON.parse(rawKeys));
    const ng = rawNg === undefined ? undefined : RequirementTable.parse(JSON.parse(rawNg));
    const hmg = rawHmg === undefined ? undefined : RequirementTable.parse(JSON.parse(rawHmg));
    const areas = AREAS.filter((a) => a.game === (game as GameId));
    const named: [string, string[]][] = [
      [KEYS_FILE, Object.keys(table?.dungeons ?? {})],
      [REQUIREMENTS_FILE, Object.keys(ng?.dungeons ?? {})],
      [REQUIREMENTS_HMG_FILE, Object.keys(hmg?.dungeons ?? {})],
    ];
    for (const [file, codes] of named) {
      for (const code of codes) {
        if (!areas.some((a) => a.key === code)) {
          throw new Error(`${game}/${file} names ${code}, which is not an area in the catalog`);
        }
      }
    }
    for (const area of areas) {
      data[`${game}/logic/${area.key}.md`] = renderLogicFile(
        area.name,
        area.key,
        table?.dungeons[area.key],
        ng,
        hmg,
      );
    }
  }
  return Object.fromEntries(Object.entries(data).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function renderGameDataModule(data: Record<string, string>): string {
  const body = Object.entries(data)
    .map(([path, text]) => `  ${JSON.stringify(path)}: ${JSON.stringify(text)},`)
    .join("\n");
  return `${HEADER}\n${IGNORE}\nexport const GAME_DATA: Readonly<Record<string, string>> = {\n${body}\n};\n`;
}

const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (invokedDirectly) {
  const data = buildGameData(readGameSources());
  writeFileSync(GAME_TS, renderGameDataModule(data));
  const chars = Object.values(data).reduce((n, t) => n + t.length, 0);
  console.log(
    `build-game: wrote src/game/data.ts (${Object.keys(data).length} files, ${chars} characters)`,
  );
}
