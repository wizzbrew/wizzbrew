import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionDataResolved,
} from "discord-api-types/v10";
import { UserInputError } from "../errors.js";
import { parseUserDate } from "../time/time.js";
import type { RoutingDecision } from "../types.js";

type Options = { name: string; type: number; value?: unknown }[];

function optionString(i: APIChatInputApplicationCommandInteraction, name: string): string | null {
  const options = (i.data.options ?? []) as Options;
  const found = options.find((o) => o.name === name);
  if (!found || typeof found.value !== "string") return null;
  const trimmed = found.value.trim();
  return trimmed === "" ? null : trimmed;
}

function userOptionName(
  userId: string,
  resolved: APIInteractionDataResolved | undefined,
): string | null {
  const nick = resolved?.members?.[userId]?.nick;
  if (nick) return nick;
  const user = resolved?.users?.[userId];
  return user?.global_name ?? user?.username ?? null;
}

function decision(
  name: string,
  route: RoutingDecision["route"],
  params: RoutingDecision["params"],
): RoutingDecision {
  return { route, confidence: 1, params, reason: `shortcut /${name}` };
}

export function shortcutRequest(
  i: APIChatInputApplicationCommandInteraction,
  now: Date,
): { question: string; decision: RoutingDecision } | null {
  const name = i.data.name;
  switch (name) {
    case "live":
      return {
        question: "What is live on each stage now, and what is next",
        decision: decision(name, "live", {}),
      };
    case "standings": {
      const tournament = optionString(i, "tournament") ?? undefined;
      return {
        question: tournament ? `Standings for ${tournament}` : "Standings",
        decision: decision(name, "standings", tournament ? { tournament } : {}),
      };
    }
    case "player": {
      let player = optionString(i, "name");
      if (!player) {
        const userId = optionString(i, "user");
        if (userId) player = userOptionName(userId, i.data.resolved);
      }
      if (!player) throw new UserInputError("Tell me which player, by name or Discord user.");
      return {
        question: `Matches and results for ${player}`,
        decision: decision(name, "players", { player }),
      };
    }
    case "me":
      return {
        question: "Show my upcoming matches, signups, volunteer shifts and requests.",
        decision: decision(name, "my_stuff", {}),
      };
    case "schedule": {
      const dayText = optionString(i, "day");
      const stage = optionString(i, "stage") ?? undefined;
      const tournament = optionString(i, "tournament") ?? undefined;
      const params: RoutingDecision["params"] = {};
      const parts: string[] = [];
      if (dayText) {
        params.day = parseUserDate(dayText, now);
        parts.push(`on ${params.day}`);
      }
      if (stage) {
        params.stage = stage;
        parts.push(`for ${stage}`);
      }
      if (tournament) {
        params.tournament = tournament;
        parts.push(`for ${tournament}`);
      }
      return {
        question: ["Show the schedule", ...parts].join(" "),
        decision: decision(name, "schedule", params),
      };
    }
    default:
      return null;
  }
}
