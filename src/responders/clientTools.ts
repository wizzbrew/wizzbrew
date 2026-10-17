import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { bracketFor } from "../challonge/challonge.js";
import { sanitizeForPrompt } from "../discord/markup.js";
import { eventParticipants, findParticipants } from "../event/participants.js";
import { log } from "../log.js";
import type { ClientTool } from "../router/routes.js";
import { communityDate, parseWizzrobeTime } from "../time/time.js";
import type { AskContext } from "../types.js";
import { matchesForAsker } from "../wizzrobe/mine.js";

const DAY_MS = 86_400_000;

const matchesInput = z.object({ days_ahead: z.number().int().min(1).max(14) }).strict();
const bracketInput = z.object({ tournament_id: z.number().int() }).strict();
const participantsInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();

const PARTICIPANTS_NOTE = "This is the SGL26 attendee list on Matcherino.";
const PARTICIPANTS_UNAVAILABLE = "participants list unavailable";

const DEFS: Record<ClientTool, BetaTool> = {
  matches_for_me: {
    name: "matches_for_me",
    description: "The asker's own upcoming matches in the next days.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "integer",
          description: "How many days ahead to look, a whole number from 1 to 14",
        },
      },
      required: ["days_ahead"],
      additionalProperties: false,
    },
  },
  challonge_bracket: {
    name: "challonge_bracket",
    description:
      "A tournament's bracket from Challonge: who is alive, eliminated, recent results and upcoming pairings, with the snapshot time.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { tournament_id: { type: "integer" } },
      required: ["tournament_id"],
      additionalProperties: false,
    },
  },
  event_participants: {
    name: "event_participants",
    description:
      "Searches the SGL26 attendee list on Matcherino by display name. Returns the matching display names with the date each joined, and the total number of people on the list.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The person's display name as the asker wrote it, up to 100 characters",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

export function clientToolDefs(names: ClientTool[]): BetaTool[] {
  return names.map((n) => DEFS[n]);
}

function epochOf(iso: string): number {
  return Math.floor(parseWizzrobeTime(iso).getTime() / 1000);
}

const INVALID = JSON.stringify({ error: "invalid input" });

// The day a person joined, on the community clock; null when Matcherino's time is unreadable.
function joinedOn(addedAt: string): string | null {
  try {
    return communityDate(parseWizzrobeTime(addedAt));
  } catch (err) {
    log("warn", "participants.joined_unreadable", {
      error: err instanceof Error ? err.name : "unknown",
    });
    return null;
  }
}

async function runParticipants(input: unknown): Promise<string> {
  const parsed = participantsInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const list = await eventParticipants();
  if (list === null) {
    return JSON.stringify({ matches: [], total: 0, note: PARTICIPANTS_UNAVAILABLE });
  }
  const matches = findParticipants(list.names, parsed.data.name).map((p) => ({
    displayName: sanitizeForPrompt(p.displayName, 100),
    joined: joinedOn(p.addedAt),
  }));
  return JSON.stringify({ matches, total: list.count, note: PARTICIPANTS_NOTE });
}

export async function runClientTool(
  name: ClientTool,
  input: unknown,
  ctx: AskContext,
): Promise<string> {
  if (name === "matches_for_me") {
    const parsed = matchesInput.safeParse(input);
    if (!parsed.success) return INVALID;
    const start = ctx.now;
    const end = new Date(start.getTime() + parsed.data.days_ahead * DAY_MS);
    const result = await matchesForAsker(ctx.asker, { start, end });
    if (result === "id_unreliable") return JSON.stringify({ needs_link: true });
    return JSON.stringify({
      matches: result.matches.map((m) => ({
        match_id: m.matchId,
        tournament: m.tournament,
        scheduled_at: m.scheduledAt.toISOString(),
        scheduled_at_epoch: Math.floor(m.scheduledAt.getTime() / 1000),
        status: m.status,
        stage: m.stage,
        stream_url: m.streamUrl,
        opponents: m.opponents,
      })),
      partial: result.partial,
    });
  }
  if (name === "event_participants") return runParticipants(input);
  const parsed = bracketInput.safeParse(input);
  if (!parsed.success) return INVALID;
  const summary = await bracketFor(parsed.data.tournament_id);
  return JSON.stringify({
    ...summary,
    ...(summary.fetchedAt === null ? {} : { fetchedAt_epoch: epochOf(summary.fetchedAt) }),
  });
}
