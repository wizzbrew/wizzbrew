import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { config } from "../src/config.js";
import { GAME_IDS } from "../src/game/catalog.js";
import { ROUTINE_NAMES } from "../src/game/routines.js";
import { routeQuestion } from "../src/router/router.js";
import { ROUTES } from "../src/router/routes.js";
import { keys } from "../src/store/keys.js";
import { kv } from "../src/store/kv.js";
import { communityDate } from "../src/time/time.js";
import type { AskContext, Route } from "../src/types.js";

// Scores the real router against evals/questions.jsonl. `npm run eval` calls the live API and
// needs the full env. `--validate` only parses the file and needs no key. Never part of `check`.

const MIN_ACCURACY = 0.9;
const ROUTE_NAMES = Object.keys(ROUTES) as [Route, ...Route[]];

const Line = z.object({
  q: z.string().min(1),
  route: z.enum(ROUTE_NAMES),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).optional(),
  linked: z.boolean(),
  note: z.string(),
  // Game lines may also say which routine and game the router should pick. Reported, not gated.
  routine: z.enum(ROUTINE_NAMES).optional(),
  game: z.enum(GAME_IDS).optional(),
});
type Line = z.infer<typeof Line>;

function load(): Line[] {
  const path = fileURLToPath(new URL("./questions.jsonl", import.meta.url));
  const rows = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");
  return rows.map((row, i) => {
    let json: unknown;
    try {
      json = JSON.parse(row);
    } catch {
      throw new Error(`questions.jsonl line ${i + 1} is not JSON`);
    }
    const parsed = Line.safeParse(json);
    if (!parsed.success) {
      throw new Error(`questions.jsonl line ${i + 1}: ${parsed.error.message}`);
    }
    return parsed.data;
  });
}

function contextFor(line: Line, i: number, now: Date): AskContext {
  return {
    requestId: `eval-${i}`,
    asker: {
      discordUserId: "100000000000000001",
      discordName: "evalfriend",
      guildId: "200000000000000001",
      channelId: "300000000000000001",
      linked: line.linked
        ? { wizzrobeUserId: 1, wizzrobeUsername: "evalfriend", roles: [], canWrite: true }
        : null,
    },
    question: line.q,
    now,
    ephemeral: false,
    history: line.history ?? [],
  };
}

async function spent(now: Date): Promise<number> {
  return Number((await kv().get(keys.spend(communityDate(now)))) ?? 0);
}

async function live(lines: Line[]): Promise<number> {
  config(); // fail loud on a missing env var before any call
  const now = new Date();
  const before = await spent(now);
  const confusion = new Map<string, number>();
  const misses: string[] = [];
  const paramMisses: string[] = [];
  let hits = 0;
  let paramChecks = 0;

  for (const [i, line] of lines.entries()) {
    const decision = await routeQuestion(contextFor(line, i, now));
    const got = decision.route;
    if (line.route === "game" && got === "game") {
      for (const [name, want] of [
        ["routine", line.routine],
        ["game", line.game],
      ] as const) {
        if (want === undefined) continue;
        paramChecks += 1;
        const have = decision.params[name];
        if (have !== want) paramMisses.push(`${name}: expected ${want}, got ${have}: "${line.q}"`);
      }
    }
    const key = `${line.route} -> ${got}`;
    confusion.set(key, (confusion.get(key) ?? 0) + 1);
    if (got === line.route) hits += 1;
    else misses.push(`expected ${line.route}, got ${got}: "${line.q}" (${line.note})`);
  }

  console.log("expected -> got");
  for (const [key, n] of [...confusion.entries()].sort()) console.log(`  ${key}: ${n}`);
  const accuracy = hits / lines.length;
  console.log(`\naccuracy: ${hits}/${lines.length} (${(accuracy * 100).toFixed(1)}%)`);
  if (misses.length > 0) {
    console.log("\nmisses:");
    for (const m of misses) console.log(`  ${m}`);
  }
  if (paramChecks > 0) {
    console.log(`\ngame params: ${paramChecks - paramMisses.length}/${paramChecks} (not gated)`);
    for (const m of paramMisses) console.log(`  ${m}`);
  }
  const cost = (await spent(now)) - before;
  console.log(`\ncost: $${cost.toFixed(4)}`);

  if (accuracy < MIN_ACCURACY) {
    console.log(`FAIL: accuracy under ${MIN_ACCURACY * 100}%`);
    return 1;
  }
  return 0;
}

async function main(): Promise<number> {
  const lines = load();
  if (process.argv.includes("--validate")) {
    const withHistory = lines.filter((l) => l.history && l.history.length > 0).length;
    console.log(`ok: ${lines.length} questions, ${withHistory} with history`);
    return 0;
  }
  return live(lines);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
