import { NotImplemented } from "../errors.js";

export async function createRescheduleRequest(
  _token: string,
  _matchId: number,
  _body: { kind: "reschedule" | "cancel"; reason: string; proposedAt?: string },
): Promise<unknown> {
  throw new NotImplemented("rest.createRescheduleRequest");
}

export async function bookBracketGame(
  _token: string,
  _bracketMatchId: number,
  _body: { scheduledDate: string; scheduledTime: string; comment?: string },
): Promise<unknown> {
  throw new NotImplemented("rest.bookBracketGame");
}

export async function myOpenBracketMatches(
  _token: string,
  _tournamentId?: number,
): Promise<unknown[]> {
  throw new NotImplemented("rest.myOpenBracketMatches");
}
