import { NotImplemented } from "../errors.js";

export interface BracketSummary {
  tournament: string;
  bracketUrl: string;
  rulesUrl: string | null;
  state: string | null; // Challonge tournament state
  alive: string[];
  eliminated: string[]; // participant display names
  recent: { round: string; players: [string, string]; winner: string | null }[];
  source: "challonge" | "link_only"; // link_only when no key or the fetch failed
}

export async function bracketFor(_tournamentId: number): Promise<BracketSummary> {
  throw new NotImplemented("challonge.bracketFor");
}
