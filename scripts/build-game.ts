// Turns prompts/<game>/ into src/game/data.ts, a TS constant the game route imports. Vercel's
// bundler cannot be trusted to ship loose markdown, so the text travels as code. Every file under
// prompts/<game>/ is read (markdown and logic/keys.json), and logic/<key>.md is rendered from
// keys.json here, never written by hand. prompts/event/*.md (event facts, not a game) is read too,
// under the keys "event/<file>". Run with: npm run build:game
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
    const raw = sources[`${game}/${KEYS_FILE}`];
    if (raw === undefined) continue;
    const table = KeyTable.parse(JSON.parse(raw));
    const areas = AREAS.filter((a) => a.game === (game as GameId));
    for (const code of Object.keys(table.dungeons)) {
      if (!areas.some((a) => a.key === code)) {
        throw new Error(`${game}/${KEYS_FILE} names ${code}, which is not an area in the catalog`);
      }
    }
    for (const area of areas) {
      data[`${game}/logic/${area.key}.md`] = renderLogic(
        area.name,
        area.key,
        table.dungeons[area.key],
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
