import { log } from "../log.js";
import type { RoutingDecision } from "../types.js";
import { findSubjectsInText } from "./catalog.js";

const MAX_SUBJECTS = 4;

// A safety net after the router, in code: when the router sent a question to chat but the text
// names a dungeon, boss or item of a game, the question goes to the game route instead. Any other
// route stays as the router chose it, and so does a chat question that names nothing. The routine
// is read the way slices.ts reads it (dungeon for an area or boss, items for an item), the
// subjects are the matched names, and the game comes from the first hit.
export function overrideChatToGame(
  decision: RoutingDecision,
  question: string,
  requestId: string,
): RoutingDecision {
  if (decision.route !== "chat") return decision;
  const hits = findSubjectsInText(question);
  const first = hits[0];
  if (first === undefined) return decision;
  log("info", "router.override", { requestId, from: "chat", to: "game" });
  return {
    route: "game",
    confidence: decision.confidence,
    params: {
      routine: hits.some((h) => h.kind === "area") ? "dungeon" : "items",
      subjects: hits.slice(0, MAX_SUBJECTS).map((h) => h.name),
      game: first.game,
    },
    reason: `${decision.reason}; chat question names a game subject`,
  };
}
