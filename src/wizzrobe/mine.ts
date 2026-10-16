import { NotImplemented } from "../errors.js";

export interface MyMatch {
  matchId: number;
  tournament: string;
  scheduledAt: Date;
  status: string;
  stage: string | null;
  streamUrl: string | null;
  opponents: string[];
}

export async function matchesForDiscordUser(
  _discordUserId: string,
  _window: { start: Date; end: Date },
): Promise<MyMatch[] | "id_unreliable"> {
  throw new NotImplemented("mine.matchesForDiscordUser");
}
