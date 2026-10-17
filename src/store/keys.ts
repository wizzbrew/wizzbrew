const PREFIX = "wb:v1";
const DISCORD_ID = /^\d+$/;
const TOKEN_PART = /^[A-Za-z0-9_.-]{1,128}$/;
const EVENT = /^[a-z0-9_.-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Returns the value when it matches; throws without echoing the value.
function part(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new Error(`invalid ${what}`);
  return value;
}

export const keys: {
  link(discordUserId: string): string; // LinkRecord JSON (its refresh token is sealed)
  linkOwner(wizzrobeUserId: number): string; // discord id that owns a Wizzrobe user link
  oauthState(state: string): string; // PKCE verifier + discord user, 10 min
  botToken(): string; // cached bot access token
  userToken(discordUserId: string): string; // cached user access token
  pending(id: string): string; // PendingAction
  thread(id: string): string; // disambiguation / follow-up context
  spend(day: string): string; // daily USD
  cache(scope: string, hash: string): string; // short-lived Wizzrobe read cache
  lock(discordUserId: string): string; // per-user in-flight lock, 120 s
  kill(): string; // kill switch: any value pauses the bot
  alert(event: string): string; // staff-alert rate limit, 600 s
  dmLog(day: string): string; // list of JSON lines, one per DM question that day, 14 days
  dmCount(day: string): string; // hash of discord id to DM questions that day, 14 days
} = {
  link(discordUserId: string): string {
    return `${PREFIX}:link:${part(discordUserId, DISCORD_ID, "discord id")}`;
  },
  linkOwner(wizzrobeUserId: number): string {
    if (!Number.isSafeInteger(wizzrobeUserId) || wizzrobeUserId < 0) {
      throw new Error("invalid wizzrobe user id");
    }
    return `${PREFIX}:linkowner:${wizzrobeUserId}`;
  },
  oauthState(state: string): string {
    return `${PREFIX}:oauth:${part(state, TOKEN_PART, "oauth state")}`;
  },
  botToken(): string {
    return `${PREFIX}:token:bot`;
  },
  userToken(discordUserId: string): string {
    return `${PREFIX}:token:user:${part(discordUserId, DISCORD_ID, "discord id")}`;
  },
  pending(id: string): string {
    return `${PREFIX}:pending:${part(id, TOKEN_PART, "pending id")}`;
  },
  thread(id: string): string {
    return `${PREFIX}:thread:${part(id, TOKEN_PART, "thread id")}`;
  },
  spend(day: string): string {
    return `${PREFIX}:spend:${part(day, DAY, "day")}`;
  },
  cache(scope: string, hash: string): string {
    const s = part(scope, TOKEN_PART, "cache scope");
    const h = part(hash, TOKEN_PART, "cache hash");
    return `${PREFIX}:cache:${s}:${h}`;
  },
  lock(discordUserId: string): string {
    return `${PREFIX}:lock:${part(discordUserId, DISCORD_ID, "discord id")}`;
  },
  kill(): string {
    return `${PREFIX}:kill`;
  },
  alert(event: string): string {
    return `${PREFIX}:alert:${part(event, EVENT, "alert event")}`;
  },
  dmLog(day: string): string {
    return `${PREFIX}:dmlog:${part(day, DAY, "day")}`;
  },
  dmCount(day: string): string {
    return `${PREFIX}:dmcount:${part(day, DAY, "day")}`;
  },
};
