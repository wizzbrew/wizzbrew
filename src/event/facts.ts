import { GAME_DATA } from "../game/data.js";

// The event facts file, compiled into GAME_DATA by scripts/build-game.ts from prompts/event/.
// A missing file means the build step was skipped, which is a deploy error, so it fails loud.
export const EVENT_FACTS_KEY = "event/sgl26.md";

export function eventFacts(): string {
  const text = GAME_DATA[EVENT_FACTS_KEY];
  if (text === undefined) throw new Error(`game data is missing ${EVENT_FACTS_KEY}`);
  return text;
}
