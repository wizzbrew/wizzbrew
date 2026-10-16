import type { AuthLevel, Route, WriteTool } from "../types.js";

export type ClientTool = "challonge_bracket" | "matches_for_me";

export interface RouteSpec {
  route: Route;
  auth: AuthLevel;
  readTools: string[]; // MCP read tools on the connector (allowlist)
  clientTools: ClientTool[]; // tools the loop runs in code (responders/clientTools.ts)
  writeTools: WriteTool[]; // what propose_action may name; never on the connector
  description: string;
  ephemeral: boolean;
}

// Placeholder entries so the table typechecks. The routes task replaces every entry.
const placeholder = (route: Route): RouteSpec => ({
  route,
  auth: "public",
  readTools: [],
  clientTools: [],
  writeTools: [],
  description: "",
  ephemeral: false,
});

export const ROUTES: Record<Route, RouteSpec> = {
  schedule: placeholder("schedule"),
  streams: placeholder("streams"),
  standings: placeholder("standings"),
  players: placeholder("players"),
  tournaments: placeholder("tournaments"),
  my_stuff: placeholder("my_stuff"),
  crew: placeholder("crew"),
  player_actions: placeholder("player_actions"),
  help: placeholder("help"),
  staff: placeholder("staff"),
  chat: placeholder("chat"),
};
