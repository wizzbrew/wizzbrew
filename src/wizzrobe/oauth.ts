import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { configFor } from "../config.js";
import { UserInputError, WizzrobeError } from "../errors.js";
import { seal } from "../store/crypto.js";
import { keys } from "../store/keys.js";
import { kv } from "../store/kv.js";
import { saveLink } from "./identity.js";
import { callTool } from "./mcp.js";

const STATE_TTL_SEC = 600;
const REQUEST_TIMEOUT_MS = 10_000;
const SCOPE = "wizzrobe:read wizzrobe:write";
const FAILED = "oauth request failed";

const MetadataSchema = z.object({
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  revocation_endpoint: z.string().url(),
});

export type OauthMetadata = z.infer<typeof MetadataSchema>;

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number(),
});

const WhoamiSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  can_write: z.boolean(),
  tenants: z.array(z.object({ slug: z.string(), roles: z.array(z.string()) })),
});

const StateRecordSchema = z.object({
  verifier: z.string().min(1),
  discordUserId: z.string().min(1),
});

export interface TokenGrant {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

// RFC 7636 S256: the verifier is 32 random bytes, the challenge its unpadded SHA-256.
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

// Seconds from a Retry-After header, or undefined when absent or not a plain number.
function retryAfterSec(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (raw === null) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

// Never echoes the response body beyond the server's own error fields.
async function failure(res: Response): Promise<WizzrobeError> {
  let detail = FAILED;
  try {
    const body: unknown = await res.json();
    const parsed = z
      .object({ error: z.string().optional(), error_description: z.string().optional() })
      .safeParse(body);
    if (parsed.success) detail = parsed.data.error_description ?? parsed.data.error ?? FAILED;
  } catch {
    // not JSON; keep the generic detail
  }
  return new WizzrobeError(res.status, detail, retryAfterSec(res));
}

// Transport errors are replaced, not wrapped: their text can carry request details.
async function send(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new WizzrobeError(502, "Wizzrobe could not be reached");
  }
  if (!res.ok) throw await failure(res);
  return res;
}

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  return send(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });
}

// One metadata fetch per base URL per process. A failed fetch is not cached.
const metadataCache = new Map<string, Promise<OauthMetadata>>();

async function fetchMetadata(baseUrl: string): Promise<OauthMetadata> {
  const url = new URL("/.well-known/oauth-authorization-server", baseUrl).toString();
  const res = await send(url, { method: "GET", headers: { accept: "application/json" } });
  const parsed = MetadataSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new WizzrobeError(502, "Wizzrobe sent unreadable OAuth metadata");
  return parsed.data;
}

// The endpoints come from the metadata; their host may differ from the base URL's host.
export async function discoverMetadata(): Promise<OauthMetadata> {
  const { wizzrobeBaseUrl } = configFor("wizzrobeBaseUrl");
  const cached = metadataCache.get(wizzrobeBaseUrl);
  if (cached) return cached;
  const pending = fetchMetadata(wizzrobeBaseUrl);
  metadataCache.set(wizzrobeBaseUrl, pending);
  pending.catch(() => {
    if (metadataCache.get(wizzrobeBaseUrl) === pending) metadataCache.delete(wizzrobeBaseUrl);
  });
  return pending;
}

async function readGrant(res: Response): Promise<TokenGrant> {
  const parsed = TokenResponseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new WizzrobeError(502, "Wizzrobe sent an unreadable token response");
  const { access_token, refresh_token, expires_in } = parsed.data;
  return { accessToken: access_token, refreshToken: refresh_token, expiresIn: expires_in };
}

// Authorization code to tokens (client_secret_post). The refresh token may be absent.
export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenGrant> {
  const { wizzrobeMcpUrl, wizzrobeOauthClientId, wizzrobeOauthClientSecret } = configFor(
    "wizzrobeMcpUrl",
    "wizzrobeOauthClientId",
    "wizzrobeOauthClientSecret",
  );
  const meta = await discoverMetadata();
  const res = await postForm(meta.token_endpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: wizzrobeOauthClientId,
    client_secret: wizzrobeOauthClientSecret,
    code_verifier: verifier,
    resource: wizzrobeMcpUrl,
  });
  return readGrant(res);
}

export async function startLink(discordUserId: string): Promise<{ url: string }> {
  const { wizzrobeOauthClientId, wizzrobeOauthRedirectUri, wizzrobeMcpUrl } = configFor(
    "wizzrobeOauthClientId",
    "wizzrobeOauthRedirectUri",
    "wizzrobeMcpUrl",
  );
  const meta = await discoverMetadata();
  const { verifier, challenge } = pkcePair();
  const state = base64url(randomBytes(16));
  await kv().set(keys.oauthState(state), { verifier, discordUserId }, STATE_TTL_SEC);
  const url = new URL(meta.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", wizzrobeOauthClientId);
  url.searchParams.set("redirect_uri", wizzrobeOauthRedirectUri);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", wizzrobeMcpUrl);
  return { url: url.toString() };
}

const EXPIRED = "That link request expired. Run /link again.";
const NOT_IN_COMMUNITY =
  "Your Wizzrobe account isn't in this event's community yet. Join it on Wizzrobe, then run /link again.";

// A state that cannot be a key is treated as unknown, not as a server error.
function stateKey(state: string): string {
  try {
    return keys.oauthState(state);
  } catch {
    throw new UserInputError(EXPIRED);
  }
}

export async function finishLink(code: string, state: string): Promise<{ discordUserId: string }> {
  const { wizzrobeOauthRedirectUri, wizzrobeTenant } = configFor(
    "wizzrobeOauthRedirectUri",
    "wizzrobeTenant",
  );
  const key = stateKey(state);
  const stored = StateRecordSchema.safeParse(await kv().get<unknown>(key));
  if (!stored.success) throw new UserInputError(EXPIRED);
  // Single use: gone before the exchange, so a replayed callback finds nothing.
  await kv().del(key);
  const { verifier, discordUserId } = stored.data;

  const grant = await exchangeCode(code, verifier, wizzrobeOauthRedirectUri);
  if (grant.refreshToken === undefined) {
    throw new WizzrobeError(502, "Wizzrobe sent no refresh token");
  }

  const who = WhoamiSchema.safeParse(await callTool(grant.accessToken, "whoami", {}));
  if (!who.success) throw new WizzrobeError(502, "Wizzrobe sent an unreadable whoami response");
  const tenant = who.data.tenants.find((t) => t.slug === wizzrobeTenant);
  if (tenant === undefined) throw new UserInputError(NOT_IN_COMMUNITY);

  const now = Date.now();
  await saveLink(discordUserId, {
    sealedRefreshToken: await seal(grant.refreshToken),
    wizzrobeUserId: who.data.user_id,
    username: who.data.username,
    roles: tenant.roles,
    canWrite: who.data.can_write,
    linkedAt: now,
    rolesCheckedAt: now,
  });
  return { discordUserId };
}

export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const { wizzrobeMcpUrl, wizzrobeOauthClientId, wizzrobeOauthClientSecret } = configFor(
    "wizzrobeMcpUrl",
    "wizzrobeOauthClientId",
    "wizzrobeOauthClientSecret",
  );
  const meta = await discoverMetadata();
  const res = await postForm(meta.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: wizzrobeOauthClientId,
    client_secret: wizzrobeOauthClientSecret,
    resource: wizzrobeMcpUrl,
  });
  const grant = await readGrant(res);
  return {
    accessToken: grant.accessToken,
    refreshToken: grant.refreshToken ?? refreshToken,
    expiresIn: grant.expiresIn,
  };
}

export async function revoke(token: string): Promise<void> {
  const { wizzrobeOauthClientId, wizzrobeOauthClientSecret } = configFor(
    "wizzrobeOauthClientId",
    "wizzrobeOauthClientSecret",
  );
  const meta = await discoverMetadata();
  await postForm(meta.revocation_endpoint, {
    token,
    token_type_hint: "refresh_token",
    client_id: wizzrobeOauthClientId,
    client_secret: wizzrobeOauthClientSecret,
  });
}
