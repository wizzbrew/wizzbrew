import { NotImplemented } from "../errors.js";

export const keys: {
  link(discordUserId: string): string; // LinkRecord JSON (its refresh token is sealed)
  oauthState(state: string): string; // PKCE verifier + discord user, 10 min
  botToken(): string; // cached bot access token
  userToken(discordUserId: string): string; // cached user access token
  pending(id: string): string; // PendingAction
  thread(id: string): string; // disambiguation / follow-up context
  spend(day: string): string; // daily USD
  cache(scope: string, hash: string): string; // short-lived Wizzrobe read cache
} = {
  link(_discordUserId: string): string {
    throw new NotImplemented("keys.link");
  },
  oauthState(_state: string): string {
    throw new NotImplemented("keys.oauthState");
  },
  botToken(): string {
    throw new NotImplemented("keys.botToken");
  },
  userToken(_discordUserId: string): string {
    throw new NotImplemented("keys.userToken");
  },
  pending(_id: string): string {
    throw new NotImplemented("keys.pending");
  },
  thread(_id: string): string {
    throw new NotImplemented("keys.thread");
  },
  spend(_day: string): string {
    throw new NotImplemented("keys.spend");
  },
  cache(_scope: string, _hash: string): string {
    throw new NotImplemented("keys.cache");
  },
};
