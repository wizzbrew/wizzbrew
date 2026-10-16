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

// A short lock keeps concurrent refreshes for one subject from reusing a rotating refresh token.
const LOCK_TTL_SEC = 15;
const WAIT_MS = 300;
const WAIT_TRIES = 10;

const EXPIRED_MESSAGE = "Your Wizzrobe link expired. Ask me to link you again (or use /link).";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Waits for the lock holder to fill the cache. Null when it never does.
async function waitForCached(key: string): Promise<CachedToken | null> {
  for (let n = 0; n < WAIT_TRIES; n++) {
    await sleep(WAIT_MS);
    const cached = await readCached(key);
    if (cached && isFresh(cached)) return cached;
  }
  return null;
}

function isAuthRejection(err: unknown): boolean {
  return err instanceof WizzrobeError && (err.status === 400 || err.status === 401);
}

export async function botAccessToken(): Promise<string> {
  const cached = await readCached(keys.botToken());
  if (cached && isFresh(cached)) return cached.accessToken;

  const lockKey = keys.cache("refresh", "bot");
  const acquired = await kv().setIfAbsent(lockKey, 1, LOCK_TTL_SEC);
  try {
    if (!acquired) {
      const waited = await waitForCached(keys.botToken());
      if (waited) return waited.accessToken;
    }
    return await refreshBot();
  } finally {
    if (acquired) await kv().del(lockKey);
  }
}

async function refreshBot(): Promise<string> {
  const cached = await readCached(keys.botToken());
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

  const lockKey = keys.cache("refresh", discordUserId);
  const acquired = await kv().setIfAbsent(lockKey, 1, LOCK_TTL_SEC);
  try {
    if (!acquired) {
      const waited = await waitForCached(keys.userToken(discordUserId));
      if (waited) return waited.accessToken;
    }
    return await refreshUser(discordUserId);
  } finally {
    if (acquired) await kv().del(lockKey);
  }
}

async function refreshUser(discordUserId: string): Promise<string> {
  const rec = await getLink(discordUserId);
  if (!rec) throw new NotLinkedError("Ask me to link your Wizzrobe account first (or use /link).");

  let current = rec;
  let usedToken = await open(rec.sealedRefreshToken);
  let fresh: Awaited<ReturnType<typeof refresh>>;
  try {
    fresh = await refresh(usedToken);
  } catch (err) {
    if (!isAuthRejection(err)) throw err;
    // Another refresh may have rotated the token since we read it. Retry once with the new one.
    const latest = await getLink(discordUserId);
    const latestToken = latest ? await open(latest.sealedRefreshToken) : null;
    if (!latest || latestToken === null || latestToken === usedToken) {
      if (latest) await deleteLink(discordUserId);
      throw new NotLinkedError(EXPIRED_MESSAGE);
    }
    current = latest;
    usedToken = latestToken;
    try {
      fresh = await refresh(usedToken);
    } catch (retryErr) {
      if (!isAuthRejection(retryErr)) throw retryErr;
      await deleteLink(discordUserId);
      throw new NotLinkedError(EXPIRED_MESSAGE);
    }
  }

  if (fresh.refreshToken !== usedToken) {
    await saveLink(discordUserId, {
      ...current,
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
