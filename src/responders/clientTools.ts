import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { bracketFor } from "../challonge/challonge.js";
import type { ClientTool } from "../router/routes.js";
import type { AskContext } from "../types.js";
import { matchesForAsker } from "../wizzrobe/mine.js";

const DAY_MS = 86_400_000;

const matchesInput = z.object({ days_ahead: z.number().int().min(1).max(14) }).strict();
const bracketInput = z.object({ tournament_id: z.number().int() }).strict();

const DEFS: Record<ClientTool, BetaTool> = {
  matches_for_me: {
    name: "matches_for_me",
    description: "The asker's own upcoming matches in the next days.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { days_ahead: { type: "integer", minimum: 1, maximum: 14 } },
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
};

export function clientToolDefs(names: ClientTool[]): BetaTool[] {
  return names.map((n) => DEFS[n]);
}

const INVALID = JSON.stringify({ error: "invalid input" });

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
        status: m.status,
        stage: m.stage,
        stream_url: m.streamUrl,
        opponents: m.opponents,
      })),
      partial: result.partial,
    });
  }
  const parsed = bracketInput.safeParse(input);
  if (!parsed.success) return INVALID;
  return JSON.stringify(await bracketFor(parsed.data.tournament_id));
}
