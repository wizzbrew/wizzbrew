import type { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";
import { NotImplemented } from "../errors.js";
import type { RoutingDecision } from "../types.js";

export function shortcutRequest(
  _i: APIChatInputApplicationCommandInteraction,
  _now: Date,
): { question: string; decision: RoutingDecision } | null {
  throw new NotImplemented("shortcuts.shortcutRequest");
}
