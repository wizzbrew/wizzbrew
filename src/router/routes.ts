import type { AuthLevel, Route, WriteTool } from "../types.js";

export type ClientTool = "challonge_bracket" | "matches_for_me" | "event_participants";

export interface RouteSpec {
  route: Route;
  auth: AuthLevel;
  readTools: string[]; // MCP read tools on the connector (allowlist)
  clientTools: ClientTool[]; // tools the loop runs in code (responders/clientTools.ts)
  writeTools: WriteTool[]; // what propose_action may name; never on the connector
  description: string;
  ephemeral: boolean;
}

// Bracket, qualifier and race room tools are off for sgl26, so no list names them.
export const ROUTES: Record<Route, RouteSpec> = {
  schedule: {
    route: "schedule",
    auth: "public",
    readTools: [
      "get_schedule",
      "list_matches",
      "get_match",
      "list_stages",
      "get_stage",
      "list_tournaments",
    ],
    clientTools: ["matches_for_me"],
    writeTools: [],
    description:
      "Who plays when, on which day, stage or tournament, and the asker's own next matches.",
    ephemeral: false,
  },
  streams: {
    route: "streams",
    auth: "public",
    readTools: ["list_stages", "get_stage", "get_schedule", "list_matches", "get_match"],
    clientTools: [],
    writeTools: [],
    description:
      "Which stage or stream shows a match, what is live now and what comes next on a stage.",
    ephemeral: false,
  },
  standings: {
    route: "standings",
    auth: "public",
    readTools: ["list_tournaments", "get_tournament", "list_matches", "get_match"],
    clientTools: ["challonge_bracket"],
    writeTools: [],
    description: "Results, standings, brackets and who advanced in a tournament.",
    ephemeral: false,
  },
  players: {
    route: "players",
    auth: "public",
    readTools: ["list_matches", "get_match", "get_schedule", "list_tournaments"],
    clientTools: ["challonge_bracket", "event_participants"],
    writeTools: [],
    description: "A named player: their matches, opponents, results and where they play next.",
    ephemeral: false,
  },
  tournaments: {
    route: "tournaments",
    auth: "public",
    readTools: ["list_tournaments", "get_tournament", "list_randomizers"],
    clientTools: [],
    writeTools: [],
    description: "What tournaments exist, their rules, format, randomizer and dates.",
    ephemeral: false,
  },
  my_stuff: {
    route: "my_stuff",
    auth: "linked",
    readTools: [
      "get_user",
      "list_tournament_signups",
      "my_volunteer_shifts",
      "my_reschedule_requests",
      "my_equipment_checkouts",
      "get_player_availability",
      "list_matches",
      "get_match",
    ],
    clientTools: [],
    writeTools: [],
    description:
      "The asker's own signups, volunteer shifts, reschedule requests, gear and availability.",
    ephemeral: true,
  },
  crew: {
    route: "crew",
    auth: "linked",
    readTools: ["list_matches", "get_match", "get_schedule"],
    clientTools: [],
    writeTools: ["signup_as_crew", "withdraw_crew_signup"],
    description: "Signing up for or withdrawing from a commentary or tracking slot on a match.",
    ephemeral: true,
  },
  player_actions: {
    route: "player_actions",
    auth: "linked",
    readTools: [
      "list_matches",
      "get_match",
      "get_schedule",
      "list_tournament_signups",
      "suggest_match_time",
    ],
    clientTools: [],
    writeTools: [
      "acknowledge_match",
      "offer_match_for_stream",
      "withdraw_stream_offer",
      "watch_match",
      "unwatch_match",
      "sign_up_for_tournament",
      "withdraw_from_tournament",
      "submit_match_request",
      "rest_create_reschedule_request",
    ],
    description:
      "Doing something as a player: acknowledge, offer for stream, watch, enter, book or ask to reschedule.",
    ephemeral: true,
  },
  help: {
    route: "help",
    auth: "public",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description: "How Wizzrobe, the event or the bot works and where to find things.",
    ephemeral: false,
  },
  game: {
    route: "game",
    auth: "public",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description:
      "The games being played and their randomizers: items, areas, bosses, mechanics, logic, tricks and settings.",
    ephemeral: false,
  },
  staff: {
    route: "staff",
    auth: "staff",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description: "Staff tooling and admin requests.",
    ephemeral: true,
  },
  chat: {
    route: "chat",
    auth: "public",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description: "Anything off topic, unclear or just conversation.",
    ephemeral: false,
  },
  live: {
    route: "live",
    auth: "public",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description: "what is on each stage right now and next",
    ephemeral: false,
  },
  account: {
    route: "account",
    auth: "public",
    readTools: [],
    clientTools: [],
    writeTools: [],
    description: "connect or disconnect the asker's Wizzrobe account",
    ephemeral: true,
  },
};
