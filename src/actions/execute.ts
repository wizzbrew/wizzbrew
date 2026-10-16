import { z } from "zod";
import { UserInputError } from "../errors.js";
import { log } from "../log.js";
import type { PendingAction, WriteTool } from "../types.js";
import { callTool } from "../wizzrobe/mcp.js";
import { bookBracketGame, createRescheduleRequest } from "../wizzrobe/rest.js";
import { userAccessToken } from "../wizzrobe/tokens.js";

const id = z.number().int().positive();
const role = z.enum(["commentator", "tracker"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const matchOnly = z.object({ match_id: id }).strict();
const matchRole = z.object({ match_id: id, role }).strict();
const tournamentOnly = z.object({ tournament_id: id }).strict();

export const WRITE_ARGS: Record<WriteTool, z.ZodType> = {
  acknowledge_match: matchOnly,
  offer_match_for_stream: matchOnly,
  withdraw_stream_offer: matchOnly,
  watch_match: matchOnly,
  unwatch_match: matchOnly,
  signup_as_crew: matchRole,
  withdraw_crew_signup: matchRole,
  sign_up_for_tournament: tournamentOnly,
  withdraw_from_tournament: tournamentOnly,
  submit_match_request: z
    .object({
      tournament_id: id,
      scheduled_date: date,
      scheduled_time: time,
      player_ids: z.array(id).min(2),
      comment: z.string().max(500).optional(),
    })
    .strict(),
  rest_create_reschedule_request: z
    .object({
      match_id: id,
      kind: z.enum(["reschedule", "cancel"]),
      reason: z.string().min(1).max(500),
      proposed_at: z.string().datetime().optional(),
    })
    .strict(),
  rest_book_bracket_game: z
    .object({
      bracket_match_id: id,
      scheduled_date: date,
      scheduled_time: time,
      comment: z.string().max(500).optional(),
    })
    .strict(),
};

type Args = Record<string, unknown>;

function resultLine(tool: WriteTool, a: Args): string {
  switch (tool) {
    case "acknowledge_match":
      return `Acknowledged match ${a.match_id}.`;
    case "offer_match_for_stream":
      return `Offered match ${a.match_id} for stream. Stream managers decide what goes on air.`;
    case "withdraw_stream_offer":
      return `Withdrew your stream offer for match ${a.match_id}.`;
    case "watch_match":
      return `You'll get Wizzrobe DMs when match ${a.match_id} changes.`;
    case "unwatch_match":
      return `Stopped watching match ${a.match_id}.`;
    case "signup_as_crew":
      return `Signed you up as ${a.role} for match ${a.match_id}. Staff may need to approve it.`;
    case "withdraw_crew_signup":
      return `Withdrew your ${a.role} signup for match ${a.match_id}.`;
    case "sign_up_for_tournament":
      return `Entered you in tournament ${a.tournament_id}.`;
    case "withdraw_from_tournament":
      return `Withdrew you from tournament ${a.tournament_id}.`;
    case "submit_match_request":
      return `Sent your match request for ${a.scheduled_date} ${a.scheduled_time}. Staff will approve or decline it.`;
    case "rest_create_reschedule_request":
      return `Sent your ${a.kind} request for match ${a.match_id}. Staff will decide.`;
    case "rest_book_bracket_game":
      return `Booked the next game for ${a.scheduled_date} ${a.scheduled_time}.`;
  }
}

// Runs a confirmed write as the person who confirmed it, never with the bot's token.
export async function executeAction(p: PendingAction): Promise<string> {
  const parsed = WRITE_ARGS[p.tool].safeParse(p.args);
  if (!parsed.success) {
    log("warn", "action.invalid_args", {
      tool: p.tool,
      paths: parsed.error.issues.map((i) => i.path.join(".")),
    });
    throw new UserInputError("That request no longer looks right. Ask again.");
  }
  const args = parsed.data as Args;
  const token = await userAccessToken(p.discordUserId);

  if (p.tool === "rest_create_reschedule_request") {
    await createRescheduleRequest(token, args.match_id as number, {
      kind: args.kind as "reschedule" | "cancel",
      reason: args.reason as string,
      proposedAt: args.proposed_at as string | undefined,
    });
  } else if (p.tool === "rest_book_bracket_game") {
    await bookBracketGame(token, args.bracket_match_id as number, {
      scheduledDate: args.scheduled_date as string,
      scheduledTime: args.scheduled_time as string,
      comment: args.comment as string | undefined,
    });
  } else {
    await callTool(token, p.tool, args);
  }
  log("info", "action.executed", { tool: p.tool, ok: true });
  return resultLine(p.tool, args);
}
