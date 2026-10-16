import type { Register } from "../personality/voice.js";
import type { Route } from "../types.js";

export interface ResponderSpec {
  route: Route;
  register: Register;
  instructions: string;
}

// Placeholder entries so the table typechecks. The specs task replaces every entry.
const placeholder = (route: Route): ResponderSpec => ({
  route,
  register: "data",
  instructions: "",
});

export const SPECS: Record<Route, ResponderSpec> = {
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
  live: placeholder("live"),
  account: placeholder("account"),
};

export const SHARED_RULES: string = "";
