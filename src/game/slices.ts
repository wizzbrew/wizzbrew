import type { BetaTextBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { sanitizeForPrompt } from "../discord/markup.js";
import { voice } from "../personality/voice.js";
import { KNOWLEDGE_FRAMING } from "../responders/fixedtext.js";
import { SHARED_RULES } from "../responders/specs.js";
import type { RoutingDecision } from "../types.js";
import { GAME_NAMES, type GameId, inferGame, resolveSubjects } from "./catalog.js";
import { GAME_DATA } from "./data.js";
import { ROUTINE_PROMPTS, type Routine } from "./routines.js";

// One hour, so a quiet channel still hits the cache. The API wants every one-hour breakpoint
// ahead of any block without cache_control, and the volatile block never has one.
export const CACHE_1H = { type: "ephemeral", ttl: "1h" } as const;

// The most subject blocks a request carries. With the instructions block that is three
// breakpoints ahead of the volatile block, under the API's limit of four.
export const MAX_SUBJECT_BLOCKS = 2;

const SEPARATOR = "\n\n---\n\n";

export interface GamePlan {
  game: GameId;
  routine: Routine;
  blocks: string[]; // subject blocks, at most MAX_SUBJECT_BLOCKS, in a stable order
  unrecognised: string[]; // names the loaded material could not place, as written
  hasReference: boolean; // false when nothing is loaded for the game
}

function file(path: string): string {
  const text = GAME_DATA[path];
  if (text === undefined) throw new Error(`game data is missing ${path}`);
  return text;
}

// Two blocks at most: the first alone, the rest merged into the second.
function limit(blocks: string[]): string[] {
  if (blocks.length <= MAX_SUBJECT_BLOCKS) return blocks;
  return [
    ...blocks.slice(0, MAX_SUBJECT_BLOCKS - 1),
    blocks.slice(MAX_SUBJECT_BLOCKS - 1).join(SEPARATOR),
  ];
}

export function planGame(decision: RoutingDecision): GamePlan {
  const names = decision.params.subjects ?? [];
  const game = inferGame(decision.params.game, names);
  const found = resolveSubjects(names, game);
  const routine: Routine =
    decision.params.routine ??
    (found.dungeons.length > 0 ? "dungeon" : found.items.length > 0 ? "items" : "general");

  const empty = (hasReference: boolean): GamePlan => ({
    game,
    routine,
    blocks: [],
    unrecognised: [],
    hasReference,
  });
  if (GAME_DATA[`${game}/general.md`] === undefined) return empty(false);

  // Only the routines that pick a file by name report names that matched nothing.
  const byName = routine === "dungeon" || routine === "logic" || routine === "items";
  const unrecognised = byName ? found.unresolved : [];

  let blocks: string[];
  if (routine === "overworld") {
    blocks = [file(`${game}/overworld.md`)];
  } else if (routine === "items") {
    blocks = [file(`${game}/items.md`)];
  } else if (routine === "general") {
    blocks = [file(`${game}/general.md`)];
  } else if (found.dungeons.length > 0) {
    const keys = [...new Set(found.dungeons.map((h) => h.key))].sort();
    blocks = limit(
      keys.map((key) => {
        const notes = file(`${game}/dungeons/${key}.md`);
        const rules = routine === "logic" ? GAME_DATA[`${game}/logic/${key}.md`] : undefined;
        return rules === undefined ? notes : `${notes}\n${rules}`;
      }),
    );
  } else if (found.items.length > 0) {
    blocks = [file(`${game}/items.md`)];
  } else {
    blocks = [file(`${game}/general.md`)];
  }
  return { game, routine, blocks, unrecognised, hasReference: true };
}

function instructions(routine: Routine): string {
  return `${voice("help")}\n\n${SHARED_RULES}\n\n${ROUTINE_PROMPTS[routine]}\n\n${KNOWLEDGE_FRAMING}`;
}

// The cached blocks of a game answer, in order: the routine's instructions, then at most two
// subject blocks. Each carries a one hour cache_control, and the caller adds the volatile block
// last without one (L1).
export function gameSystemBlocks(decision: RoutingDecision): BetaTextBlockParam[] {
  const plan = planGame(decision);
  return [instructions(plan.routine), ...plan.blocks].map((text) => ({
    type: "text",
    text,
    cache_control: CACHE_1H,
  }));
}

// Lines for the volatile block: what the loaded material could not place, by name only.
export function gameVolatileLines(decision: RoutingDecision): string[] {
  const plan = planGame(decision);
  const lines: string[] = [];
  if (!plan.hasReference) {
    lines.push(`No reference material is loaded for ${GAME_NAMES[plan.game]}.`);
  }
  if (plan.unrecognised.length > 0) {
    const names = plan.unrecognised
      .map((n) => sanitizeForPrompt(n, 60).replace(/\s+/g, " "))
      .join("; ");
    lines.push(`Names not found in the loaded material: ${names}`);
  }
  return lines;
}
