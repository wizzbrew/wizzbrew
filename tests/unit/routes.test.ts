import { describe, expect, it } from "vitest";
import { type ClientTool, ROUTES, type RouteSpec } from "../../src/router/routes.js";
import type { AuthLevel, Route, WriteTool } from "../../src/types.js";

// Every WriteTool, as an exhaustive record so a new union member fails the typecheck here.
const WRITE_TOOLS: Record<WriteTool, true> = {
  signup_as_crew: true,
  withdraw_crew_signup: true,
  acknowledge_match: true,
  offer_match_for_stream: true,
  withdraw_stream_offer: true,
  watch_match: true,
  unwatch_match: true,
  sign_up_for_tournament: true,
  withdraw_from_tournament: true,
  submit_match_request: true,
  rest_create_reschedule_request: true,
  rest_book_bracket_game: true,
};

const ALL_ROUTES: Record<Route, true> = {
  schedule: true,
  streams: true,
  standings: true,
  players: true,
  tournaments: true,
  my_stuff: true,
  crew: true,
  player_actions: true,
  help: true,
  staff: true,
  chat: true,
  live: true,
  account: true,
};

type Row = {
  auth: AuthLevel;
  readTools: string[];
  clientTools: ClientTool[];
  writeTools: WriteTool[];
  ephemeral: boolean;
};

const TABLE: Record<Route, Row> = {
  schedule: {
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
    ephemeral: false,
  },
  streams: {
    auth: "public",
    readTools: ["list_stages", "get_stage", "get_schedule", "list_matches", "get_match"],
    clientTools: [],
    writeTools: [],
    ephemeral: false,
  },
  standings: {
    auth: "public",
    readTools: ["list_tournaments", "get_tournament", "list_matches", "get_match"],
    clientTools: ["challonge_bracket"],
    writeTools: [],
    ephemeral: false,
  },
  players: {
    auth: "public",
    readTools: ["list_matches", "get_match", "get_schedule", "list_tournaments"],
    clientTools: ["challonge_bracket"],
    writeTools: [],
    ephemeral: false,
  },
  tournaments: {
    auth: "public",
    readTools: ["list_tournaments", "get_tournament", "list_randomizers"],
    clientTools: [],
    writeTools: [],
    ephemeral: false,
  },
  my_stuff: {
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
    ephemeral: true,
  },
  crew: {
    auth: "linked",
    readTools: ["list_matches", "get_match", "get_schedule"],
    clientTools: [],
    writeTools: ["signup_as_crew", "withdraw_crew_signup"],
    ephemeral: true,
  },
  player_actions: {
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
    ephemeral: true,
  },
  help: { auth: "public", readTools: [], clientTools: [], writeTools: [], ephemeral: false },
  staff: { auth: "staff", readTools: [], clientTools: [], writeTools: [], ephemeral: true },
  chat: { auth: "public", readTools: [], clientTools: [], writeTools: [], ephemeral: false },
  live: { auth: "public", readTools: [], clientTools: [], writeTools: [], ephemeral: false },
  account: { auth: "public", readTools: [], clientTools: [], writeTools: [], ephemeral: true },
};

const specs = Object.values(ROUTES) as RouteSpec[];

describe("ROUTES", () => {
  it("has a spec for every route and nothing else", () => {
    expect(Object.keys(ROUTES).sort()).toEqual(Object.keys(ALL_ROUTES).sort());
    for (const [key, spec] of Object.entries(ROUTES)) {
      expect(spec.route).toBe(key);
    }
  });

  it("matches the route table exactly", () => {
    for (const route of Object.keys(TABLE) as Route[]) {
      const { description: _description, route: _route, ...rest } = ROUTES[route];
      expect(rest, route).toEqual(TABLE[route]);
    }
  });

  it("describes each route in one plain line", () => {
    for (const spec of specs) {
      expect(spec.description.length, spec.route).toBeGreaterThan(0);
      expect(spec.description, spec.route).not.toContain("\n");
    }
  });

  it("names no bracket, qualifier or race room tool", () => {
    const names = specs.flatMap((s) => [...s.readTools, ...s.writeTools]);
    for (const name of names) {
      expect(name).not.toMatch(/bracket|qualifier|race_room/);
    }
  });

  it("lists only real write tools", () => {
    for (const spec of specs) {
      for (const tool of spec.writeTools) {
        expect(WRITE_TOOLS[tool], `${spec.route}:${tool}`).toBe(true);
      }
    }
  });

  it("keeps linked routes and staff ephemeral", () => {
    for (const spec of specs) {
      if (spec.auth === "linked" || spec.auth === "staff") {
        expect(spec.ephemeral, spec.route).toBe(true);
      }
    }
  });

  it("gives write tools only to linked routes", () => {
    for (const spec of specs) {
      if (spec.writeTools.length > 0) expect(spec.auth, spec.route).toBe("linked");
    }
  });
});
