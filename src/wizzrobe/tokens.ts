import { NotImplemented } from "../errors.js";

export async function botAccessToken(): Promise<string> {
  throw new NotImplemented("tokens.botAccessToken");
}

export async function userAccessToken(_discordUserId: string): Promise<string> {
  throw new NotImplemented("tokens.userAccessToken");
}
