import { z } from "zod";
import { config } from "../config.js";
import { NotLinkedError, WizzrobeError } from "../errors.js";
import { log } from "../log.js";
import { open, seal } from "../store/crypto.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { deleteLink, getLink, saveLink } from "./identity.js";
import { refresh } from "./oauth.js";

// A token within this long of expiring counts as expired.
const SKEW_MS = 60_000;

const cachedTokenSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number(),
  sealedRefreshToken: z.string().optional(),
});

type CachedToken = z.infer<typeof cachedTokenSchema>;

// A cached entry that is missing or malformed is a miss; the token is re-fetched.
async function readCached(key: string): Promise<CachedToken | null> {
  const parsed = cachedTokenSchema.safeParse(await kv().get<unknown>(key));
  return parsed.success ? parsed.data : null;
}

function isFresh(cached: CachedToken): boolean {
  return cached.expiresAt - SKEW_MS > Date.now();
}

export async function botAccessToken(): Promise<string> {
  const cached = await readCached(keys.botToken());
  if (cached && isFresh(cached)) return cached.accessToken;

  const refreshToken = cached?.sealedRefreshToken
    ? await open(cached.sealedRefreshToken)
    : config().wizzrobeBotRefreshToken;

  let fresh: Awaited<ReturnType<typeof refresh>>;
  try {
    fresh = await refresh(refreshToken);
  } catch (err) {
    log("error", "tokens.bot_refresh_failed", {
      status: err instanceof WizzrobeError ? err.status : undefined,
    });
    throw err;
  }

  // No TTL: Wizzrobe may rotate the refresh token, so the newest one must survive.
  const next: CachedToken = {
    accessToken: fresh.accessToken,
    expiresAt: Date.now() + fresh.expiresIn * 1000,
    sealedRefreshToken: await seal(fresh.refreshToken),
  };
  await kv().set(keys.botToken(), next);
  return fresh.accessToken;
}

export async function userAccessToken(discordUserId: string): Promise<string> {
  const cached = await readCached(keys.userToken(discordUserId));
  if (cached && isFresh(cached)) return cached.accessToken;

  const rec = await getLink(discordUserId);
  if (!rec) throw new NotLinkedError("Run /link first to connect your Wizzrobe account.");

  const currentRefreshToken = await open(rec.sealedRefreshToken);
  let fresh: Awaited<ReturnType<typeof refresh>>;
  try {
    fresh = await refresh(currentRefreshToken);
  } catch (err) {
    if (err instanceof WizzrobeError && (err.status === 400 || err.status === 401)) {
      await deleteLink(discordUserId);
      throw new NotLinkedError("Your Wizzrobe link expired. Run /link to connect again.");
    }
    throw err;
  }

  if (fresh.refreshToken !== currentRefreshToken) {
    await saveLink(discordUserId, {
      ...rec,
      sealedRefreshToken: await seal(fresh.refreshToken),
    });
  }
  const entry: CachedToken = {
    accessToken: fresh.accessToken,
    expiresAt: Date.now() + fresh.expiresIn * 1000,
  };
  await kv().set(keys.userToken(discordUserId), entry, Math.max(fresh.expiresIn - 60, 1));
  return fresh.accessToken;
}
