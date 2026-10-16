import { NotImplemented } from "../errors.js";

export async function startLink(_discordUserId: string): Promise<{ url: string }> {
  throw new NotImplemented("oauth.startLink");
}

export async function finishLink(
  _code: string,
  _state: string,
): Promise<{ discordUserId: string }> {
  throw new NotImplemented("oauth.finishLink");
}

export async function refresh(
  _refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  throw new NotImplemented("oauth.refresh");
}

export async function revoke(_token: string): Promise<void> {
  throw new NotImplemented("oauth.revoke");
}
